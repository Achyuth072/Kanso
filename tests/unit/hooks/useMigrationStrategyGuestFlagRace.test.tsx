import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { useMigrationStrategy } from "@/lib/hooks/useMigrationStrategy";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_KEY } from "@/lib/mock/mock-store";
import type { Session, User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/crypto/purge", () => ({
  purgeDeviceContent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/telemetry/client", () => ({
  trackSignupCompleted: vi.fn(),
}));

vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

type MockSupabaseBuilder = Promise<{
  data: unknown;
  error: unknown;
  count: number;
}> & {
  from: Mock;
  select: Mock;
  insert: Mock;
  update: Mock;
  eq: Mock;
};

const mockUser = { id: "real-user-id", email: "real@user.com" } as User;
const mockSession = { user: mockUser } as Session;

function withQueryClient(children: React.ReactNode) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeSupabaseClient(
  results: { data: unknown; error?: unknown; count?: number }[],
) {
  let index = 0;
  const createBuilder = (): MockSupabaseBuilder => {
    const result = results[index++] || { data: [], error: null };
    const promise = Promise.resolve({
      data: result.data,
      error: result.error ?? null,
      count: result.count ?? 0,
    });
    const builder = promise as unknown as MockSupabaseBuilder;
    builder.from = vi.fn(createBuilder);
    builder.select = vi.fn(() => builder);
    builder.insert = vi.fn(() => builder);
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    return builder;
  };

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: mockSession } }),
      onAuthStateChange: vi.fn((callback) => {
        queueMicrotask(() => callback("INITIAL_SESSION", mockSession));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    from: vi.fn(createBuilder),
  };
}

describe("useMigrationStrategy: guest flag cleared before mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.cookie = "kanso_guest_mode=; path=/; max-age=0";
    vi.stubGlobal("location", { reload: vi.fn() });
  });

  it("migrates even though AuthProvider already cleared kanso_guest_mode by the time this hook mounts", async () => {
    const guestData = {
      tasks: [{ id: "g-t1", content: "Task 1", created_at: "2023-01-01" }],
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guestData));
    localStorage.setItem("kanso_guest_mode", "true");
    document.cookie = "kanso_guest_mode=true; path=/";

    const supabaseClient = makeSupabaseClient([
      { data: [] },
      { data: [], count: 0 },
      { data: [], count: 0 },
      { data: [{ id: "s-t1", content: "Task 1", created_at: "2023-01-01" }] },
    ]);
    vi.mocked(createClient).mockReturnValue(
      supabaseClient as unknown as ReturnType<typeof createClient>,
    );

    renderHook(() => useMigrationStrategy(), {
      wrapper: ({ children }) =>
        withQueryClient(
          <AuthProvider initialIsGuest={true}>{children}</AuthProvider>,
        ),
    });

    await waitFor(() => {
      expect(localStorage.getItem("kanso_guest_mode")).toBeNull();
    });

    await waitFor(
      () => {
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(window.location.reload).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );
  });
});
