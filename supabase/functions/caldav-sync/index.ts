// Follow this setup guide to bootstrap the edge function:
// https://supabase.com/docs/guides/functions/connect-to-postgres
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Note: tsdav is a Node.js library, we might need a Deno-compatible version or use esm.sh
// For this scaffold, we assume the orchestrator runs on the client or a background job
// But the Edge Function provides the CORS bypass proxy for CalDAV servers if needed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Get user from token
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { action, calendarId } = await req.json();

    if (action === "sync") {
      console.log(`Starting sync for calendar ${calendarId}...`);

      // In a real implementation, we would either:
      // 1. Run the Sync Orchestrator here (using tsdav via esm.sh)
      // 2. Queue a background job

      return new Response(
        JSON.stringify({
          status: "sync_queued",
          message: "Sync processing started (mock)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
