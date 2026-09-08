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

const getEncryptionKeyRowMock = vi.fn();
vi.mock("@/lib/crypto/keyManager", () => ({
  getEncryptionKeyRow: (...args: unknown[]) => getEncryptionKeyRowMock(...args),
}));

const keyStoreLoadMock = vi.fn();
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: { load: (...args: unknown[]) => keyStoreLoadMock(...args) },
}));

const purgeDeviceContentMock = vi.fn();
vi.mock("@/lib/crypto/purge", () => ({
  purgeDeviceContent: (...args: unknown[]) => purgeDeviceContentMock(...args),
}));

const uiState = { autoLockEnabled: false, autoLockMinutes: 60 };
vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: (selector: (s: typeof uiState) => unknown) => selector(uiState),
}));

const getIdleMsMock = vi.fn(() => 0);
const recordActivityMock = vi.fn();
vi.mock("@/lib/crypto/autoLock", () => ({
  getIdleMs: () => getIdleMsMock(),
  recordActivity: () => recordActivityMock(),
}));

vi.mock("@/lib/hooks/useAutoLockTimer", () => ({
  useAutoLockTimer: () => {},
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
    uiState.autoLockEnabled = false;
    uiState.autoLockMinutes = 60;
    getIdleMsMock.mockReturnValue(0);
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
    getEncryptionKeyRowMock.mockResolvedValue(null);
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-setup"));
  });

  it("resolves to needs-unlock when a key row exists but this device has no cached key", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({ migrated_at: null });
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
  });

  it("resolves to needs-migration when unlocked but the backfill hasn't completed", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({ migrated_at: null });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-migration"));
  });

  it("resolves to unlocked, not needs-migration, when a row cached before migrated_at existed comes back with the field missing", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({} as { migrated_at: null });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });

  it("resolves to unlocked when the device already has the key cached and migration is complete", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });

  it("resolves to unavailable when the key-row check fails with nothing cached", async () => {
    getEncryptionKeyRowMock.mockRejectedValue(new Error("Failed to fetch"));
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("recheck() retries a failed key-row check", async () => {
    getEncryptionKeyRowMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    act(() => result.current.recheck());

    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });

  it("lock() purges device content and flips status to needs-unlock without a network re-check", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));

    getEncryptionKeyRowMock.mockClear();
    await result.current.lock();

    expect(purgeDeviceContentMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
    expect(getEncryptionKeyRowMock).not.toHaveBeenCalled();
  });

  it("locks immediately on mount when auto-lock is enabled and the device has been idle past the interval", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    uiState.autoLockEnabled = true;
    uiState.autoLockMinutes = 30;
    getIdleMsMock.mockReturnValue(31 * 60_000);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });

    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
    expect(purgeDeviceContentMock).toHaveBeenCalledTimes(1);
  });

  it("stays unlocked when auto-lock is enabled but idle time is under the interval", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    uiState.autoLockEnabled = true;
    uiState.autoLockMinutes = 30;
    getIdleMsMock.mockReturnValue(5 * 60_000);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });

    await waitFor(() => expect(result.current.status).toBe("unlocked"));
    expect(purgeDeviceContentMock).not.toHaveBeenCalled();
  });
  it("recheck restarts the idle clock, so finishing a gate screen doesn't immediately re-lock", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    uiState.autoLockEnabled = true;
    uiState.autoLockMinutes = 30;
    getIdleMsMock.mockReturnValue(31 * 60_000);
    recordActivityMock.mockImplementation(() =>
      getIdleMsMock.mockReturnValue(0),
    );

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));

    act(() => result.current.recheck());

    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });
});
