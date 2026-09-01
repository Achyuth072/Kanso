import type { QueryClient } from "@tanstack/react-query";
import { keyStore } from "@/lib/crypto/keyStore";
import { purgePersistedQueryCache } from "@/lib/query-cache-purge";

// Locking and signing out both discard every readable copy of the user's
// content from the device (master key and persisted query cache).
// Kept in one place so the two purges cannot drift apart.
export async function purgeDeviceContent(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([keyStore.clear(), purgePersistedQueryCache(queryClient)]);
}
