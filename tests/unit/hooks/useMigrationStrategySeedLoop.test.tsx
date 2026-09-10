import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMigrationStrategy } from "@/lib/hooks/useMigrationStrategy";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_KEY } from "@/lib/mock/mock-store";
import type { User } from "@supabase/supabase-js";

vi.mock("@/components/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/telemetry/client", () => ({ trackSignupCompleted: vi.fn() }));

async function simulatePageLoad() {
  vi.resetModules();
  await import("@/lib/mock/mock-store");
}

describe("migration does not loop on a freshly seeded guest blob", () => {
  const mockUser = { id: "real-user-id" } as unknown as User;
  const reload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("location", { reload });

    const builder = () => {
      const promise = Promise.resolve({ data: [], error: null, count: 0 });
      const b = promise as unknown as Record<string, unknown>;
      b.from = vi.fn(() => b);
      b.select = vi.fn(() => b);
      b.insert = vi.fn(() => b);
      b.update = vi.fn(() => b);
      b.eq = vi.fn(() => b);
      b.single = vi.fn(() => b);
      return b;
    };
    const client = builder();
    (client.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      builder(),
    );
    vi.mocked(createClient).mockReturnValue(
      client as unknown as ReturnType<typeof createClient>,
    );

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("does not reload when the only guest data is self-seeded demo content", async () => {
    await simulatePageLoad();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    renderHook(() => useMigrationStrategy());

    await waitFor(() => {
      expect(reload).not.toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(reload).not.toHaveBeenCalled();
  });
});
