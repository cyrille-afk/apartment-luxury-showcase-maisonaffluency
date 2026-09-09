import { createClient } from "npm:@supabase/supabase-js@2";

// Twilio StatusCallback receiver. Twilio POSTs form-encoded delivery updates
// (queued → sent → delivered/read, or failed/undelivered with an error code).
// Requests are authenticated with a shared secret in the query string because
// the Twilio auth token lives inside the Lovable connector gateway and is not
// available here for signature validation.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const url = new URL(req.url);
    const expected = Deno.env.get("TWILIO_STATUS_CALLBACK_SECRET");
    if (!expected || url.searchParams.get("s") !== expected) {
      return new Response("Forbidden", { status: 403 });
    }

    const form = await req.formData();
    const raw: Record<string, string> = {};
    for (const [k, v] of form.entries()) raw[k] = typeof v === "string" ? v : "";

    const sid = raw.MessageSid || raw.SmsSid || raw.MessageSID;
    if (!sid) return new Response("Missing MessageSid", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const status = raw.MessageStatus || raw.SmsStatus || null;
    const errorCode = raw.ErrorCode ? Number(raw.ErrorCode) : null;

    const { error } = await supabase.from("whatsapp_delivery_events").insert({
      message_sid: sid,
      message_status: status,
      error_code: Number.isFinite(errorCode as number) ? errorCode : null,
      error_message: raw.ErrorMessage || null,
      to_number: raw.To || null,
      from_number: raw.From || null,
      raw,
    });
    if (error) console.error("Failed to store delivery event:", error.message);

    // Keep the alert log in step with the latest terminal status.
    if (status) {
      await supabase
        .from("admin_alert_log")
        .update({
          status: errorCode || status === "failed" || status === "undelivered" ? "failed" : status,
          error: errorCode ? `Twilio error_code ${errorCode}${raw.ErrorMessage ? `: ${raw.ErrorMessage}` : ""}` : null,
        })
        .eq("provider_message_id", sid);
    }

    return new Response("", { status: 204 });
  } catch (err) {
    console.error("twilio-status-callback error:", err);
    return new Response("Error", { status: 500 });
  }
});
