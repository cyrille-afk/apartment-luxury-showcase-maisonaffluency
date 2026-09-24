// Shared Twilio WhatsApp sender via the Lovable connector gateway.
//
// Broadcast model: WhatsApp Cloud API (and therefore Twilio) cannot post into a
// WhatsApp group. Instead we loop over a recipient directory and send the same
// alert individually to every team member.
//
// Recipient precedence:
//   1. payment_credentials.whatsapp_recipients — "Team Notification Directory"
//      managed from the admin Payment Settings panel (comma separated E.164).
//   2. ADMIN_WHATSAPP_TO — legacy single admin number fallback.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export interface WhatsAppSendResult {
  ok: boolean;
  sid: string | null;
  status: string | null;
  error: string | null;
  /** Per-recipient outcome for audit logging. */
  recipients?: { to: string; ok: boolean; sid: string | null; error: string | null }[];
}

export interface WhatsAppSendOptions {
  body: string;
  /** Twilio Content SID for approved WhatsApp templates. */
  contentSid?: string;
  /** Variables paired with ContentSid. */
  contentVariables?: Record<string, string>;
  /** Optional Twilio StatusCallback URL for delivery updates. */
  statusCallback?: string | null;
}

/** Normalises a raw entry into `whatsapp:+E164`, or null when unusable. */
export function normaliseWhatsAppNumber(raw: string): string | null {
  const trimmed = raw.trim().replace(/^whatsapp:/i, "");
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!/^\+?\d{7,15}$/.test(digits)) return null;
  return `whatsapp:${digits.startsWith("+") ? digits : `+${digits}`}`;
}

export function parseRecipientList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n;]/)) {
    const value = normaliseWhatsAppNumber(part);
    if (value) seen.add(value);
  }
  return [...seen];
}

/** Reads the admin-managed directory, falling back to the legacy env number. */
export async function getAdminWhatsAppRecipients(): Promise<string[]> {
  let stored: string | null = null;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && serviceKey) {
      const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { data } = await admin
        .from("payment_credentials")
        .select("whatsapp_recipients")
        .eq("id", "live")
        .maybeSingle();
      stored = (data?.whatsapp_recipients as string | null) ?? null;
    }
  } catch (e) {
    console.error("[whatsapp] could not read recipient directory:", e);
  }

  const list = parseRecipientList(stored);
  if (list.length) return list;
  return parseRecipientList(Deno.env.get("ADMIN_WHATSAPP_TO"));
}

export function getWhatsAppStatusCallback(): string | null {
  const callbackSecret = Deno.env.get("TWILIO_STATUS_CALLBACK_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  if (!callbackSecret || !supabaseUrl) return null;
  return `${supabaseUrl}/functions/v1/twilio-status-callback?s=${encodeURIComponent(callbackSecret)}`;
}

async function sendOne(
  to: string,
  from: string,
  lovableKey: string,
  twilioKey: string,
  opts: WhatsAppSendOptions,
): Promise<{ to: string; ok: boolean; sid: string | null; status: string | null; error: string | null }> {
  const params: Record<string, string> = { To: to, From: from };
  if (opts.statusCallback) params.StatusCallback = opts.statusCallback;

  if (opts.contentSid && opts.contentVariables) {
    params.ContentSid = opts.contentSid;
    params.ContentVariables = JSON.stringify(opts.contentVariables);
  } else {
    params.Body = opts.body;
  }

  try {
    const res = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    if (!res.ok) {
      const body = await res.text();
      return { to, ok: false, sid: null, status: null, error: `Twilio ${res.status}: ${body.slice(0, 500)}` };
    }

    const json = await res.json().catch(() => null);
    return { to, ok: true, sid: json?.sid ?? null, status: json?.status ?? null, error: null };
  } catch (err) {
    return {
      to,
      ok: false,
      sid: null,
      status: null,
      error: String(err instanceof Error ? err.message : err).slice(0, 500),
    };
  }
}

/**
 * Broadcasts one alert to every number in the team directory, in parallel.
 * `ok` is true when at least one recipient received the message.
 */
export async function sendAdminWhatsApp(
  opts: WhatsAppSendOptions,
): Promise<WhatsAppSendResult> {
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM")?.trim();
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")?.trim();
  const twilioKey = Deno.env.get("TWILIO_API_KEY")?.trim();
  const recipients = await getAdminWhatsAppRecipients();

  if (!recipients.length || !from || !lovableKey || !twilioKey) {
    return {
      ok: false,
      sid: null,
      status: null,
      error: !recipients.length
        ? "No WhatsApp recipients configured (Payment Settings → Team Notification Directory)"
        : "Missing WhatsApp credentials (TWILIO_WHATSAPP_FROM, LOVABLE_API_KEY, TWILIO_API_KEY)",
    };
  }

  const results = await Promise.all(
    recipients.map((to) => sendOne(to, from, lovableKey, twilioKey, opts)),
  );

  const delivered = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  return {
    ok: delivered.length > 0,
    sid: delivered[0]?.sid ?? null,
    status: delivered[0]?.status ?? null,
    error: failed.length ? failed.map((r) => `${r.to} → ${r.error}`).join(" | ").slice(0, 900) : null,
    recipients: results.map((r) => ({ to: r.to, ok: r.ok, sid: r.sid, error: r.error })),
  };
}

// ---------------------------------------------------------------------------
// "New Trade Account Request" template (maison_affluency_trade_account_request_alert).
// Body: Studio {{1}}, Applicant {{2}}, Email {{3}}, Phone {{4}}.
// Used by both trade application forms. Until Meta approves it, alerts fall
// back to freeform (only delivered inside the 24h window).
export const TRADE_REQUEST_TEMPLATE_SID =
  Deno.env.get("TWILIO_WHATSAPP_TRADE_TEMPLATE_SID") ?? "HX27548c8d04234dfce8c0812a1fc106eb";

let tradeApproval: { status: string; checkedAt: number } | null = null;

export async function getTemplateApprovalStatus(contentSid: string): Promise<string> {
  if (contentSid === TRADE_REQUEST_TEMPLATE_SID && tradeApproval && Date.now() - tradeApproval.checkedAt < 10 * 60 * 1000) {
    return tradeApproval.status;
  }
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")?.trim();
  const twilioKey = Deno.env.get("TWILIO_API_KEY")?.trim();
  if (!lovableKey || !twilioKey) return "missing_credentials";
  try {
    const res = await fetch(`${TWILIO_GATEWAY_URL}/content/v1/Content/${contentSid}/ApprovalRequests`, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": twilioKey },
    });
    if (!res.ok) {
      console.error(`Template approval lookup failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      return `lookup_${res.status}`;
    }
    const json = await res.json();
    const status = String(json?.whatsapp?.status ?? "unknown").toLowerCase();
    if (contentSid === TRADE_REQUEST_TEMPLATE_SID) tradeApproval = { status, checkedAt: Date.now() };
    return status;
  } catch (e) {
    console.error("Template approval lookup error:", e);
    return "lookup_error";
  }
}

export async function sendTradeRequestWhatsApp(opts: {
  body: string;
  studio: string;
  applicant: string;
  email: string;
  phone: string;
}): Promise<WhatsAppSendResult & { usedTemplate: boolean; templateStatus: string }> {
  const clean = (v?: string | null) => (v ?? "").replace(/\s+/g, " ").trim();
  const statusCallback = getWhatsAppStatusCallback();
  const templateStatus = await getTemplateApprovalStatus(TRADE_REQUEST_TEMPLATE_SID);
  if (templateStatus === "approved") {
    const r = await sendAdminWhatsApp({
      body: opts.body,
      contentSid: TRADE_REQUEST_TEMPLATE_SID,
      contentVariables: {
        "1": clean(opts.studio) || "Not provided",
        "2": clean(opts.applicant) || "Not provided",
        "3": clean(opts.email) || "Not provided",
        "4": clean(opts.phone) || "Not provided",
      },
      statusCallback,
    });
    if (r.ok) return { ...r, usedTemplate: true, templateStatus };
    const fb = await sendAdminWhatsApp({ body: opts.body, statusCallback });
    return { ...fb, error: [r.error, fb.error].filter(Boolean).join(" | ") || null, usedTemplate: false, templateStatus };
  }
  const r = await sendAdminWhatsApp({ body: opts.body, statusCallback });
  return { ...r, usedTemplate: false, templateStatus };
}
