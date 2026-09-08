import { get, set, del } from "idb-keyval";

const MASTER_KEY_STORAGE_KEY = "kagelin-master-key";

export interface KeyStore {
  load(): Promise<Uint8Array | null>;
  save(key: Uint8Array): Promise<void>;
  clear(): Promise<void>;
}

// undefined: not yet loaded; null: no key stored.
let cached: Uint8Array | null | undefined;

export const keyStore: KeyStore = {
  async load() {
    if (cached === undefined) {
      cached = (await get<Uint8Array>(MASTER_KEY_STORAGE_KEY)) ?? null;
    }
    return cached;
  },
  async save(key) {
    await set(MASTER_KEY_STORAGE_KEY, key);
    cached = key;
  },
  async clear() {
    await del(MASTER_KEY_STORAGE_KEY);
    cached = null;
  },
};
