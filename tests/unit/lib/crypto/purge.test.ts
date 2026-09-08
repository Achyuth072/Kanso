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

import { purgeDeviceContent } from "@/lib/crypto/purge";
import { keyStore } from "@/lib/crypto/keyStore";

describe("purgeDeviceContent", () => {
  beforeEach(() => {
    idbStore.clear();
  });

  it("leaves no key and no persisted query cache behind after purging", async () => {
    await keyStore.save(new Uint8Array([1, 2, 3, 4]));

    const queryClient = new QueryClient();
    queryClient.setQueryData(["tasks"], [{ id: "1", content: "Buy milk" }]);
    idbStore.set("REACT_QUERY_OFFLINE_CACHE", {
      clientState: {
        queries: [
          { queryKey: ["tasks"], state: { data: [{ content: "Buy milk" }] } },
        ],
      },
    });

    await purgeDeviceContent(queryClient);

    expect(await keyStore.load()).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(idbStore.has("REACT_QUERY_OFFLINE_CACHE")).toBe(false);
    expect(JSON.stringify([...idbStore.values()])).not.toContain("content");
  });
});
