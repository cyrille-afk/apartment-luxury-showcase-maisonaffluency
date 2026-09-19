// Shared Twilio WhatsApp sender via the Lovable connector gateway.
//
// Destination precedence:
//   1. ADMIN_WHATSAPP_GROUP_ID  — shared operational chat / broadcast list
//   2. ADMIN_WHATSAPP_TO        — legacy individual admin number
//
// Note: standard Twilio WhatsApp messages expect E.164 phone numbers
// (e.g. whatsapp:+6591234567). Group IDs only work when your Twilio/Meta
// setup supports them (e.g. Twilio Conversations or an approved group proxy).

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export interface WhatsAppSendResult {
  ok: boolean;
  sid: string | null;
  status: string | null;
  error: string | null;
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

export function getAdminWhatsAppDestination(): string | null {
  return (
    Deno.env.get("ADMIN_WHATSAPP_GROUP_ID")?.trim() ||
    Deno.env.get("ADMIN_WHATSAPP_TO")?.trim() ||
    null
  );
}

export function getWhatsAppStatusCallback(): string | null {
  const callbackSecret = Deno.env.get("TWILIO_STATUS_CALLBACK_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  if (!callbackSecret || !supabaseUrl) return null;
  return `${supabaseUrl}/functions/v1/twilio-status-callback?s=${encodeURIComponent(callbackSecret)}`;
}

export async function sendAdminWhatsApp(
  opts: WhatsAppSendOptions,
): Promise<WhatsAppSendResult> {
  const to = getAdminWhatsAppDestination();
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM")?.trim();
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")?.trim();
  const twilioKey = Deno.env.get("TWILIO_API_KEY")?.trim();

  if (!to || !from || !lovableKey || !twilioKey) {
    return {
      ok: false,
      sid: null,
      status: null,
      error: "Missing WhatsApp credentials (TO/GROUP_ID, FROM, LOVABLE_API_KEY, TWILIO_API_KEY)",
    };
  }

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

    let sid: string | null = null;
    let status: string | null = null;
    let error: string | null = null;

    if (!res.ok) {
      const body = await res.text();
      error = `Twilio ${res.status}: ${body.slice(0, 800)}`;
    } else {
      try {
        const json = await res.json();
        sid = json?.sid ?? null;
        status = json?.status ?? null;
      } catch (_) {
        // non-JSON success body — still treat as sent
      }
    }

    return { ok: res.ok, sid, status, error };
  } catch (err) {
    return {
      ok: false,
      sid: null,
      status: null,
      error: String(err instanceof Error ? err.message : err).slice(0, 800),
    };
  }
}
