import { render, waitFor } from "@testing-library/react";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/query-core";
import { describe, it, expect, vi, beforeEach } from "vitest";
import QueryProvider from "@/components/QueryProvider";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const idbStore = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    idbStore.delete(key);
  }),
}));

// Matches the shape @tanstack/react-query-persist-client persists and
// restores — a hand-rolled object without a `timestamp` is treated as
// corrupt and discarded regardless of guest/session state.
function seedPersistedCache() {
  const seedClient = new QueryClient();
  seedClient.setQueryData(["tasks"], [{ id: "1", content: "Buy milk" }]);
  idbStore.set("REACT_QUERY_OFFLINE_CACHE", {
    buster: "",
    timestamp: Date.now(),
    clientState: dehydrate(seedClient),
  });
}

function mockSupabase(session: { user: { id: string } } | null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
    },
  };
}

function TaskContent() {
  const { data } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => Promise.resolve("Buy milk"),
    initialData: "Buy milk",
  });
  return <div data-testid="task-content">{data}</div>;
}

describe("QueryProvider", () => {
  beforeEach(() => {
    idbStore.clear();
    localStorage.clear();
  });

  it("purges the persisted query cache on reload when no valid session and no guest flag are found", async () => {
    localStorage.removeItem("kanso_guest_mode");
    seedPersistedCache();
    vi.mocked(createClient).mockReturnValue(
      mockSupabase(null) as unknown as ReturnType<typeof createClient>,
    );

    render(
      <QueryProvider>
        <TaskContent />
      </QueryProvider>,
    );

    await waitFor(() => {
      expect(idbStore.has("REACT_QUERY_OFFLINE_CACHE")).toBe(false);
    });
  });

  it("leaves the persisted cache alone in guest mode", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    seedPersistedCache();
    vi.mocked(createClient).mockReturnValue(
      mockSupabase(null) as unknown as ReturnType<typeof createClient>,
    );

    render(
      <QueryProvider>
        <TaskContent />
      </QueryProvider>,
    );

    await waitFor(() => {
      expect(createClient).toHaveBeenCalled();
    });
    expect(idbStore.has("REACT_QUERY_OFFLINE_CACHE")).toBe(true);
  });
});
