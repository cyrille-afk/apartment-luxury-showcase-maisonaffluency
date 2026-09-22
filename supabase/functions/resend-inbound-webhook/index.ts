// Inbound Resend listener for acquisition replies.
// The request handling logic lives in ./handler.ts so it can be exercised end to
// end by ./flow_test.ts with injected dependencies.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { sendLovableEmail } from "../_shared/lovableEmail.ts";
import { createInboundHandler, fetchInboundEmail } from "./handler.ts";

const handler = createInboundHandler({
  getSecret: () => Deno.env.get("RESEND_INBOUND_WEBHOOK_SECRET") ?? "",
  getClient: () =>
    createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    ),
  fetchReply: fetchInboundEmail,
  // deno-lint-ignore no-explicit-any
  sendEmail: (payload, client) => sendLovableEmail(payload as any, client),
});

serve(handler);
