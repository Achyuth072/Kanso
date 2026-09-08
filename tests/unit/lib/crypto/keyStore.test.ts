import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { keyStore } from "@/lib/crypto/keyStore";

describe("keyStore", () => {
  beforeEach(() => {
    idbStore.clear();
  });

  it("returns null when nothing has been saved", async () => {
    expect(await keyStore.load()).toBeNull();
  });

  it("round-trips a saved key through load", async () => {
    const key = new Uint8Array([1, 2, 3, 4]);
    await keyStore.save(key);
    expect(await keyStore.load()).toEqual(key);
  });

  it("clear removes the saved key", async () => {
    await keyStore.save(new Uint8Array([1, 2, 3]));
    await keyStore.clear();
    expect(await keyStore.load()).toBeNull();
  });

  it("stores the key under IndexedDB via idb-keyval, not localStorage", async () => {
    const { set } = await import("idb-keyval");
    await keyStore.save(new Uint8Array([9]));
    expect(set).toHaveBeenCalled();
  });
});
