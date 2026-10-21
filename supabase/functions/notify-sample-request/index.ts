import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { tradeRequestNotification, type RequestKind } from "../_shared/tradeRequestNotification.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
serve(async (req: Request) => {
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const serviceCaller = authHeader === `Bearer ${serviceKey}`;
    let callerId: string | undefined;
    let privileged = serviceCaller;
    if (!serviceCaller) {
      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || "");
      const { data, error } = await anon.auth.getClaims(authHeader.slice(7));
      callerId = data?.claims?.sub as string | undefined;
      if (error || !callerId) return respond({ error: "Unauthorized" }, 401);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId).in("role", ["admin", "super_admin"]);
      privileged = Boolean(roles?.length);
    }
    const body = await req.json();
    const kind: RequestKind = body.kind === "custom" ? "custom" : "sample";
    const requestId = body.requestId;
    if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) return respond({ error: "Invalid requestId" }, 400);
    const table = kind === "custom" ? "trade_custom_requests" : "trade_sample_requests";
    const { data: request, error: readError } = await admin.from(table).select("*").eq("id", requestId).maybeSingle();
    if (readError) return respond({ error: "Could not read request" }, 500);
    if (!request) return respond({ error: "Request not found" }, 404);
    if (!privileged && request.user_id !== callerId) return respond({ error: "Forbidden" }, 403);
    const { data: profile } = await admin.from("profiles").select("first_name,last_name,email,company").eq("id", request.user_id).maybeSingle();
    const idempotencyKey = `trade-${kind}-request-${requestId}`;
    const { data: prior, error: priorError } = await admin.from("email_send_log").select("id")
      .eq("template_name", "inquiry-notification").eq("recipient_email", "concierge@maisonaffluency.com")
      .contains("metadata", { idempotency_key: idempotencyKey }).in("status", ["pending", "sent"]).limit(1);
    if (priorError) return respond({ error: "Could not check notification" }, 500);
    if (prior?.length) return respond({ success: true, queued: true });
    const { data: sent, error: sendError } = await admin.functions.invoke("send-transactional-email", {
      body: { templateName: "inquiry-notification", idempotencyKey, templateData: tradeRequestNotification(kind, request, profile) },
    });
    if (sendError || sent?.success !== true) {
      await admin.from("admin_alert_log").insert({ channel: "email", event: `trade_${kind}_request_email_failed`, status: "failed", payload: { request_id: requestId }, error: sendError?.message || sent?.reason || "Notification not queued" });
      return respond({ error: "Request saved, but its notification could not be queued" }, 502);
    }
    return respond({ success: true, queued: true });
  } catch (error) {
    console.error("Trade request notification failed", error instanceof Error ? error.message : "Unknown error");
    return respond({ error: "Notification failed" }, 500);
  }
});
