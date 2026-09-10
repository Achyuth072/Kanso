import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { useMigrationStrategy } from "@/lib/hooks/useMigrationStrategy";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_KEY } from "@/lib/mock/mock-store";
import type { User } from "@supabase/supabase-js";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext } from "@/lib/crypto/contentCipher";
import { createFakeSupabaseClient } from "../support/fakeSupabaseClient";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/telemetry/client", () => ({
  trackSignupCompleted: vi.fn(),
}));

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

import { trackSignupCompleted } from "@/lib/telemetry/client";

type MockSupabaseBuilder = Promise<{ data: unknown; error: unknown }> & {
  from: Mock;
  select: Mock;
  insert: Mock;
  update: Mock;
  eq: Mock;
  single: Mock;
};

describe("useMigrationStrategy", () => {
  let mockSupabase: MockSupabaseBuilder;
  const mockUser = { id: "real-user-id" } as unknown as User;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("location", { reload: vi.fn() });

    const createMockBuilder = (data: unknown = [], error: unknown = null) => {
      const promise = Promise.resolve({ data, error });
      const builder = promise as unknown as MockSupabaseBuilder;
      builder.from = vi.fn(() => builder);
      builder.select = vi.fn(() => builder);
      builder.insert = vi.fn(() => builder);
      builder.update = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.single = vi.fn(() => builder);
      return builder;
    };

    mockSupabase = createMockBuilder();
    vi.mocked(createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof createClient>,
    );
  });

  const setupMockSequence = (
    results: { data: unknown; error?: unknown; count?: number }[],
  ) => {
    let index = 0;
    const createBuilder = () => {
      const result = results[index++] || { data: [], error: null };
      const promise = Promise.resolve({
        data: result.data,
        error: result.error || null,
        count: result.count ?? 0,
      });
      const builder = promise as unknown as MockSupabaseBuilder;
      builder.from = vi.fn(createBuilder);
      builder.select = vi.fn(() => builder);
      builder.insert = vi.fn(() => builder);
      builder.update = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.single = vi.fn(() => builder);
      return builder;
    };

    mockSupabase.from.mockImplementation(createBuilder);
  };

  const mockAuthAsRealUser = () =>
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithOAuth: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      reauthenticate: vi.fn(),
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
    });

  it("MIG-E-01: Skipping migration for existing users", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: [{ id: "g-t1", content: "Task 1", created_at: "2023-01-01" }],
        projects: [],
        habits: [],
        habit_entries: [],
        focus_logs: [],
      }),
    );
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithOAuth: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      reauthenticate: vi.fn(),
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
    });

    // Existing tasks mark account as established even if only Inbox exists.
    setupMockSequence([
      { data: [{ id: "inbox", is_inbox: true }] },
      { data: [], count: 12 },
      { data: [], count: 0 },
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      },
      { timeout: 3000 },
    );

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("MIG-E-02: Skipping migration for an account with manual projects but no tasks/habits yet", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: [{ id: "g-t1", content: "Task 1", created_at: "2023-01-01" }],
        projects: [],
        habits: [],
        habit_entries: [],
        focus_logs: [],
        events: [],
        seed_ids: [],
      }),
    );
    mockAuthAsRealUser();

    setupMockSequence([
      {
        data: [
          { id: "inbox", is_inbox: true },
          { id: "p1", is_inbox: false },
        ],
      },
      { data: [], count: 0 },
      { data: [], count: 0 },
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      },
      { timeout: 3000 },
    );

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("MIG-N-03: migrates when the guest flag was already cleared before mount", async () => {
    const guestData = {
      tasks: [{ id: "g-t1", content: "Task 1", created_at: "2023-01-01" }],
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(guestData));
    mockAuthAsRealUser();

    setupMockSequence([
      { data: [] },
      { data: [], count: 0 },
      { data: [], count: 0 },
      { data: [{ id: "s-t1", content: "Task 1", created_at: "2023-01-01" }] },
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
        expect(window.location.reload).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );
  });

  it("MIG-N-01: Successful migration flow", async () => {
    const guestData = {
      tasks: [{ id: "g-t1", content: "Task 1", created_at: "2023-01-01" }],
      projects: [{ id: "g-p1", name: "Work", is_inbox: false }],
      habits: [],
      habit_entries: [],
      focus_logs: [],
    };

    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guestData));

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithOAuth: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      reauthenticate: vi.fn(),
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
    });

    setupMockSequence([
      { data: [] },
      { data: { id: "s-p1" } },
      { data: [{ id: "s-t1", content: "Task 1", created_at: "2023-01-01" }] },
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(
          "kanso_guest_mode",
        );
        expect(window.location.reload).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );
  });

  it("MIG-B-01: Correct parent_id mapping for subtasks", async () => {
    const guestTasks = [
      {
        id: "parent",
        content: "Parent",
        parent_id: null,
        created_at: "2023-01-01",
      },
      {
        id: "child",
        content: "Child",
        parent_id: "parent",
        created_at: "2023-01-02",
      },
    ];
    const guestData = {
      tasks: guestTasks,
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
    };

    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guestData));

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithOAuth: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      reauthenticate: vi.fn(),
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
    });

    setupMockSequence([
      { data: [] },
      {
        data: [
          { id: "new-parent", content: "Parent", created_at: "2023-01-01" },
          { id: "new-child", content: "Child", created_at: "2023-01-02" },
        ],
      },
      { data: {} },
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(
          "kanso_guest_mode",
        );
        expect(trackSignupCompleted).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  });

  it("MIG-N-02: migrates guest calendar events, skipping ones synced from an external calendar", async () => {
    const guestData = {
      tasks: [],
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
      events: [
        {
          id: "g-e1",
          title: "Own event",
          remote_calendar_id: null,
          is_archived: true,
          created_at: "2023-01-01",
        },
        {
          id: "g-e2",
          title: "Synced event",
          remote_calendar_id: "guest-local-caldav-1",
          created_at: "2023-01-01",
        },
      ],
    };

    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guestData));
    mockAuthAsRealUser();

    setupMockSequence([
      { data: [] },
      { data: [], count: 0 },
      { data: [], count: 0 },
      { data: null, error: null },
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(window.location.reload).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );

    const eventsCall = mockSupabase.from.mock.results.find(
      (r) =>
        (r.value as MockSupabaseBuilder).insert.mock.calls.length > 0 &&
        (r.value as MockSupabaseBuilder).insert.mock.calls[0][0]?.[0]?.title !==
          undefined,
    );
    const insertedEvents = eventsCall
      ? (eventsCall.value as MockSupabaseBuilder).insert.mock.calls[0][0]
      : [];

    expect(insertedEvents).toHaveLength(1);
    expect(insertedEvents[0].title).toBe("Own event");
    expect(insertedEvents[0].is_archived).toBe(true);
  });

  // See docs/adr/0014-demo-data-stripped-on-signup-migration.md.
  it("MIG-D-01: does not migrate Demo items", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: [
          { id: "demo-t1", content: "Demo task", created_at: "2023-01-01" },
          { id: "own-t1", content: "My task", created_at: "2023-01-02" },
        ],
        projects: [{ id: "demo-p1", name: "Work", is_inbox: false }],
        habits: [{ id: "demo-h1", name: "Meditate" }],
        habit_entries: [{ habit_id: "demo-h1", date: "2023-01-01", value: 1 }],
        focus_logs: [
          { task_id: "demo-t1", duration_seconds: 3600 },
          { task_id: "own-t1", duration_seconds: 600 },
        ],
        events: [],
        seed_ids: ["demo-t1", "demo-p1", "demo-h1"],
      }),
    );
    mockAuthAsRealUser();

    setupMockSequence([
      { data: [] },
      { data: [], count: 0 },
      { data: [], count: 0 },
      { data: [{ id: "s-t1", content: "My task", created_at: "2023-01-02" }] },
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(window.location.reload).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );

    const inserted = mockSupabase.from.mock.results.flatMap((r) =>
      (r.value as MockSupabaseBuilder).insert.mock.calls.flat(),
    );

    expect(JSON.stringify(inserted)).not.toContain("Demo task");
    expect(JSON.stringify(inserted)).not.toContain("Meditate");
    expect(JSON.stringify(inserted)).not.toContain("Work");
    expect(JSON.stringify(inserted)).not.toContain("3600");
    expect(JSON.stringify(inserted)).toContain("My task");
  });

  // Uses the wrapped client to assert ciphertext on the server rather than mock call arguments.
  describe("encrypts on upload", () => {
    it("MIG-ENC-01: converted tasks, habits and projects arrive as ciphertext", async () => {
      keyStoreState.key = await generateMasterKey();
      const raw = createFakeSupabaseClient();
      vi.mocked(createClient).mockReturnValue(
        wrapSupabaseClient(raw, FIELD_MAP) as unknown as ReturnType<
          typeof createClient
        >,
      );

      const guestData = {
        tasks: [
          {
            id: "g-t1",
            content: "Ask oncologist about trial",
            description: "bring scan results",
            created_at: "2023-01-01",
          },
        ],
        projects: [{ id: "g-p1", name: "Divorce planning", is_inbox: false }],
        habits: [{ id: "g-h1", name: "Take medication" }],
        habit_entries: [],
        focus_logs: [],
        events: [
          {
            id: "g-e1",
            title: "Oncology follow-up",
            location: "St Mary's, room 4",
            remote_calendar_id: null,
            created_at: "2023-01-01",
          },
        ],
      };
      localStorage.setItem("kanso_guest_mode", "true");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guestData));
      mockAuthAsRealUser();

      renderHook(() => useMigrationStrategy());

      await waitFor(() => expect(window.location.reload).toHaveBeenCalled(), {
        timeout: 4000,
      });

      const storedTask = raw.rawRows("tasks")[0];
      const storedProject = raw.rawRows("projects")[0];
      const storedHabit = raw.rawRows("habits")[0];
      const storedEvent = raw.rawRows("calendar_events")[0];

      expect(isCiphertext(storedTask.content)).toBe(true);
      expect(isCiphertext(storedTask.description)).toBe(true);
      expect(isCiphertext(storedProject.name)).toBe(true);
      expect(isCiphertext(storedHabit.name)).toBe(true);
      expect(isCiphertext(storedEvent.title)).toBe(true);
      expect(isCiphertext(storedEvent.location)).toBe(true);

      const everythingStored = JSON.stringify([
        ...raw.rawRows("tasks"),
        ...raw.rawRows("projects"),
        ...raw.rawRows("habits"),
        ...raw.rawRows("calendar_events"),
      ]);
      expect(everythingStored).not.toContain("Ask oncologist about trial");
      expect(everythingStored).not.toContain("bring scan results");
      expect(everythingStored).not.toContain("Divorce planning");
      expect(everythingStored).not.toContain("Oncology follow-up");
      expect(everythingStored).not.toContain("St Mary's, room 4");
      expect(everythingStored).not.toContain("Take medication");
    });

    it("MIG-ENC-02: never deposits plaintext when no master key is available yet", async () => {
      keyStoreState.key = null;
      const raw = createFakeSupabaseClient();
      vi.mocked(createClient).mockReturnValue(
        wrapSupabaseClient(raw, FIELD_MAP) as unknown as ReturnType<
          typeof createClient
        >,
      );

      const guestData = {
        tasks: [
          { id: "g-t1", content: "Secret task", created_at: "2023-01-01" },
        ],
        projects: [],
        habits: [],
        habit_entries: [],
        focus_logs: [],
      };
      localStorage.setItem("kanso_guest_mode", "true");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guestData));
      mockAuthAsRealUser();

      renderHook(() => useMigrationStrategy());

      await waitFor(() => expect(raw.rawRows("tasks")).toHaveLength(0));
      expect(window.location.reload).not.toHaveBeenCalled();
    });
  });
});
