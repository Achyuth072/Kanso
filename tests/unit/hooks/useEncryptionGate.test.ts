import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

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

import { useEncryptionGate } from "@/lib/hooks/useEncryptionGate";

describe("useEncryptionGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "user-1" };
    authState.loading = false;
    authState.isGuestMode = false;
  });

  it("resolves to not-applicable for a guest", async () => {
    authState.isGuestMode = true;
    const { result } = renderHook(() => useEncryptionGate());
    await waitFor(() => expect(result.current.status).toBe("not-applicable"));
  });

  it("resolves to not-applicable when signed out", async () => {
    authState.user = null;
    const { result } = renderHook(() => useEncryptionGate());
    await waitFor(() => expect(result.current.status).toBe("not-applicable"));
  });

  it("resolves to needs-setup when the account has no key row yet", async () => {
    hasEncryptionKeyMock.mockResolvedValue(false);
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate());
    await waitFor(() => expect(result.current.status).toBe("needs-setup"));
  });

  it("resolves to needs-unlock when a key row exists but this device has no cached key", async () => {
    hasEncryptionKeyMock.mockResolvedValue(true);
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate());
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
  });

  it("resolves to unlocked when the device already has the key cached", async () => {
    hasEncryptionKeyMock.mockResolvedValue(true);
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate());
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });
});
