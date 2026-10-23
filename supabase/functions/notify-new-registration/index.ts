import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCronOrAdmin } from "../_shared/auth.ts";
import { getAdminWhatsAppRecipients, sendAdminWhatsApp, getWhatsAppStatusCallback, getTemplateApprovalStatus } from "../_shared/twilioWhatsAppSender.ts";
import { alertCopy, pendingRecipients, ADMIN_EMAILS, CUSTOMER_ACCOUNT_TEMPLATE_SID, isPublicAccountAlert } from "./rules.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const auth = await requireCronOrAdmin(req, "notify-new-registration");
  if (!auth.ok) return Response.json(auth.body, { status: auth.status, headers });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return Response.json({ error: "Configuration unavailable" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => {
    const h = new Headers(init?.headers);
    if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  } } });
  const { data: events, error } = await db.rpc("claim_registration_alerts");
  if (error) return Response.json({ error: "Could not claim alerts" }, { status: 503 });
  for (const event of events ?? []) {
    const errors: string[] = [];
    const emailDone = event.email_done ?? {};
    const waDone = event.whatsapp_done ?? {};
    try {
      const { data, error: authError } = await db.auth.admin.getUserById(event.source_id);
      if (!isPublicAccountAlert(event.event_type, event.source_table, data.user?.user_metadata ?? {})) {
        await db.from("registration_alert_events").update({ status: "cancelled", lease_until: null, last_error: "Not a public account signup" }).eq("id", event.id);
        continue;
      }
      if (authError || !data.user) throw new Error("Saved account unavailable");
      const result = await db.from("profiles").select("*").eq("id", event.source_id).maybeSingle();
      if (result.error || !result.data) throw new Error("Saved submission unavailable");
      const row = { ...result.data, ...data.user.user_metadata, email: data.user.email };
      const copy = alertCopy(row);
      for (const recipient of pendingRecipients(ADMIN_EMAILS, emailDone)) {
        const res = await db.functions.invoke("send-transactional-email", { body: {
          templateName: "inquiry-notification", recipientEmail: recipient,
          idempotencyKey: `registration-alert-${event.id}-${recipient}`,
          templateData: { name: copy.name, company: copy.studio, email: copy.email, phone: copy.phone, subject: copy.title, message: copy.text },
        } });
        if (res.error || res.data?.error || res.data?.success !== true) errors.push(`Email enqueue failed or suppressed: ${recipient}`);
        else emailDone[recipient] = true;
        const saved = await db.from("registration_alert_events").update({ email_done: emailDone }).eq("id", event.id);
        if (saved.error) throw new Error("Could not save email acknowledgement");
      }
      const recipients = await getAdminWhatsAppRecipients();
      const templateApproved = await getTemplateApprovalStatus(CUSTOMER_ACCOUNT_TEMPLATE_SID) === "approved";
      if (!templateApproved && pendingRecipients(recipients, waDone).length) errors.push("Customer WhatsApp template awaiting approval; email sent independently");
      if (!recipients.length) errors.push("No WhatsApp recipients configured");
      for (const recipient of templateApproved ? pendingRecipients(recipients, waDone) : []) {
        const result = await sendAdminWhatsApp({ body: copy.text, recipients: [recipient], statusCallback: getWhatsAppStatusCallback(), contentSid: CUSTOMER_ACCOUNT_TEMPLATE_SID, contentVariables: { "1": copy.name, "2": copy.email } });
        if (result.ok) waDone[recipient] = result.sid || true;
        else errors.push(result.error || "WhatsApp failed");
        const saved = await db.from("registration_alert_events").update({ whatsapp_done: waDone }).eq("id", event.id);
        if (saved.error) throw new Error("Could not save WhatsApp acknowledgement");
        await db.from("admin_alert_log").insert({ channel: "twilio_whatsapp", event: event.event_type, status: result.ok ? "queued" : "failed", provider_message_id: result.sid, payload: { alert_event_id: event.id, source_id: event.source_id }, error: result.error });
      }
    } catch (e) { errors.push(e instanceof Error ? e.message : "Alert failed"); }
    await db.from("registration_alert_events").update({ email_done: emailDone, whatsapp_done: waDone, status: errors.length ? (event.attempts >= 5 ? "failed" : "pending") : "sent", lease_until: null, next_attempt_at: new Date(Date.now() + 60000).toISOString(), last_error: errors.join(" | ").slice(0, 2000) || null }).eq("id", event.id);
  }
  // Immediate event-driven dispatch only. Failed recipients retain their
  // acknowledgement state for an explicit retry, without a polling timer.
  return Response.json({ processed: events?.length ?? 0 }, { headers });
});
