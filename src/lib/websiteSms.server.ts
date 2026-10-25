import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { WEBSITE_SMS_RECIPIENT, WEBSITE_SMS_SENDER, websiteSmsMessage } from "./websiteSms";

export async function sendWebsiteSms(token: string) {
  const { data, error } = await supabaseAdmin.rpc("claim_website_sms", { wake_token: token });
  if (error) return { status: 401, body: { error: "Unauthorized" } };
  const event = data?.[0];
  if (!event) return { status: 200, body: { skipped: true } };
  const apiKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["TWILIO_API_KEY"];
  if (!apiKey || !connectionKey) {
    await supabaseAdmin.from("website_sms_events").update({ status: "failed", error: "SMS credentials unavailable" }).eq("id", event.id).throwOnError();
    return { status: 503, body: { error: "SMS is not configured" } };
  }
  const { data: incident, error: readError } = await supabaseAdmin.from("website_status_incidents").select("path").eq("id", event.incident_id).single();
  if (readError || !incident) {
    await supabaseAdmin.from("website_sms_events").update({ status: "failed", error: "Incident unavailable" }).eq("id", event.id).throwOnError();
    return { status: 500, body: { error: "Incident unavailable" } };
  }
  try {
    if (event.event_kind !== "outage" && event.event_kind !== "recovery") throw new Error("Invalid event");
    const response = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": connectionKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: WEBSITE_SMS_RECIPIENT, From: WEBSITE_SMS_SENDER, Body: websiteSmsMessage(event.event_kind, incident.path) }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(`SMS provider rejected request [${response.status}]: ${text}`);
      await supabaseAdmin.from("website_sms_events").update({ status: "failed", error: `Provider HTTP ${response.status}: ${text.slice(0, 1000)}` }).eq("id", event.id).throwOnError();
      return { status: response.status, body: { error: "SMS provider rejected request", providerStatus: response.status } };
    }
    const message = JSON.parse(text) as { sid?: string };
    if (!message.sid) throw new Error("SMS acceptance unconfirmed");
    await supabaseAdmin.from("website_sms_events").update({ status: "accepted", provider_id: message.sid, error: null }).eq("id", event.id).throwOnError();
    return { status: 200, body: { accepted: true } };
  } catch {
    // A timed-out send may already have reached Twilio; never resend blindly.
    await supabaseAdmin.from("website_sms_events").update({ status: "uncertain", error: "SMS acceptance could not be confirmed; check provider before retrying" }).eq("id", event.id).throwOnError();
    return { status: 502, body: { error: "SMS acceptance could not be confirmed" } };
  }
}