import type { QueryClient } from "@tanstack/react-query";
import { get, set, del } from "idb-keyval";

const PERSISTED_QUERY_CACHE_KEY = "REACT_QUERY_OFFLINE_CACHE";

// Shared with QueryProvider's PersistQueryClientProvider so both the persist
// config and the purge below agree on where the cache lives.
export const asyncStoragePersister = {
  persistClient: async (client: unknown) => {
    await set(PERSISTED_QUERY_CACHE_KEY, client);
  },
  restoreClient: async () => {
    return await get(PERSISTED_QUERY_CACHE_KEY);
  },
  removeClient: async () => {
    await del(PERSISTED_QUERY_CACHE_KEY);
  },
};

export async function purgePersistedQueryCache(
  queryClient: QueryClient,
): Promise<void> {
  queryClient.clear();
  await asyncStoragePersister.removeClient();
}
