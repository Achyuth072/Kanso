import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";

let client: SupabaseClient | undefined;

export function createClient() {
  if (client) return client;
  client = wrapSupabaseClient(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
  );
  return client;
}
