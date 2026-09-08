import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

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

import { purgePersistedQueryCache } from "@/lib/query-cache-purge";

describe("purgePersistedQueryCache", () => {
  beforeEach(() => {
    idbStore.clear();
  });

  it("clears the in-memory query and mutation caches, and removes the persisted IndexedDB blob", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["tasks"], [{ id: "1", content: "Buy milk" }]);
    queryClient.setQueryData(["habits"], [{ id: "2", content: "Meditate" }]);
    queryClient.setQueryData(["events"], [{ id: "3", content: "Dentist" }]);
    queryClient.setMutationDefaults(["createTask"], {
      mutationFn: vi.fn(),
    });
    queryClient.getMutationCache().build(queryClient, {
      mutationFn: vi.fn(),
    });

    idbStore.set("REACT_QUERY_OFFLINE_CACHE", {
      clientState: {
        queries: [
          { queryKey: ["tasks"], state: { data: [{ content: "Buy milk" }] } },
        ],
      },
    });

    await purgePersistedQueryCache(queryClient);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    expect(idbStore.has("REACT_QUERY_OFFLINE_CACHE")).toBe(false);

    expect(JSON.stringify([...idbStore.values()])).not.toContain("content");
  });
});
