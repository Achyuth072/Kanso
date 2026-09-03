import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const authState = {
  user: { id: "user-1" } as { id: string } | null,
  loading: false,
  isGuestMode: false,
};

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => authState,
}));

const hasEncryptionKeyMock = vi.fn();
vi.mock("@/lib/crypto/keyManager", () => ({
  hasEncryptionKey: (...args: unknown[]) => hasEncryptionKeyMock(...args),
}));

const keyStoreLoadMock = vi.fn();
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: { load: (...args: unknown[]) => keyStoreLoadMock(...args) },
}));

const purgeDeviceContentMock = vi.fn();
vi.mock("@/lib/crypto/purge", () => ({
  purgeDeviceContent: (...args: unknown[]) => purgeDeviceContentMock(...args),
}));

import { useEncryptionGate } from "@/lib/hooks/useEncryptionGate";

function withQueryClient(children: React.ReactNode) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useEncryptionGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "user-1" };
    authState.loading = false;
    authState.isGuestMode = false;
    purgeDeviceContentMock.mockResolvedValue(undefined);
  });

  it("resolves to not-applicable for a guest", async () => {
    authState.isGuestMode = true;
    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("not-applicable"));
  });

  it("resolves to not-applicable when signed out", async () => {
    authState.user = null;
    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("not-applicable"));
  });

  it("resolves to needs-setup when the account has no key row yet", async () => {
    hasEncryptionKeyMock.mockResolvedValue(false);
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-setup"));
  });

  it("resolves to needs-unlock when a key row exists but this device has no cached key", async () => {
    hasEncryptionKeyMock.mockResolvedValue(true);
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
  });

  it("resolves to unlocked when the device already has the key cached", async () => {
    hasEncryptionKeyMock.mockResolvedValue(true);
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });

  it("resolves to unavailable when the key-row check fails with nothing cached", async () => {
    hasEncryptionKeyMock.mockRejectedValue(new Error("Failed to fetch"));
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("recheck() retries a failed key-row check", async () => {
    hasEncryptionKeyMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    hasEncryptionKeyMock.mockResolvedValue(true);
    act(() => result.current.recheck());

    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });

  it("lock() purges device content and flips status to needs-unlock without a network re-check", async () => {
    hasEncryptionKeyMock.mockResolvedValue(true);
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));

    hasEncryptionKeyMock.mockClear();
    await result.current.lock();

    expect(purgeDeviceContentMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
    expect(hasEncryptionKeyMock).not.toHaveBeenCalled();
  });
});
