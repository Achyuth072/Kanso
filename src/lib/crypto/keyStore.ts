import { get, set, del } from "idb-keyval";

const MASTER_KEY_STORAGE_KEY = "kagelin-master-key";

export interface KeyStore {
  load(): Promise<Uint8Array | null>;
  save(key: Uint8Array): Promise<void>;
  clear(): Promise<void>;
}

export const keyStore: KeyStore = {
  async load() {
    const value = await get<Uint8Array>(MASTER_KEY_STORAGE_KEY);
    return value ?? null;
  },
  async save(key) {
    await set(MASTER_KEY_STORAGE_KEY, key);
  },
  async clear() {
    await del(MASTER_KEY_STORAGE_KEY);
  },
};
