import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";

let rawClient: SupabaseClient | undefined;
let client: SupabaseClient | undefined;

function getRawBrowserClient() {
  if (!rawClient) {
    rawClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return rawClient;
}

export function createClient() {
  if (client) return client;
  client = wrapSupabaseClient(getRawBrowserClient());
  return client;
}

export function createRawClient() {
  return getRawBrowserClient();
}
