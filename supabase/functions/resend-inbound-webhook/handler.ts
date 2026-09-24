// Inbound Resend listener for acquisition replies (testable core).
//
// Flow: verify the Svix signature -> dedupe the delivery -> fetch the reply body
// from Resend -> match the studio -> classify intent -> atomically claim the lead
// -> send the private portal key exactly once.
//
// Public endpoint (verify_jwt = false): the signature IS the authentication.
import { readSvixHeaders, verifySvixSignature } from "../_shared/svix.ts";
import {
  baseEmail,
  classifyReplyIntent,
  normalizeEmail,
  studioSlug,
} from "../_shared/replyIntent.ts";

export const SITE = "https://www.maisonaffluency.com";
const GATEWAY = "https://connector-gateway.lovable.dev/resend";
const MAX_BODY_BYTES = 256 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export type Lead = {
  id: string;
  studio_name: string;
  founder_name: string | null;
  business_email: string;
  executive_emails: string[] | null;
  campaign_status: string;
  portal_key_sent_at: string | null;
};

export type SendOutcome = {
  queued: unknown[];
  suppressed: unknown[];
  failed: { error?: string }[];
};

export type InboundDeps = {
  getSecret: () => string;
  // deno-lint-ignore no-explicit-any
  getClient: () => any;
  fetchReply: (emailId: string) => Promise<{ text: string; headers: Record<string, unknown> } | null>;
  sendEmail: (
    payload: Record<string, unknown>,
    // deno-lint-ignore no-explicit-any
    client: any,
  ) => Promise<SendOutcome>;
};

function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function salutation(lead: Lead): string {
  const contact = String(lead.founder_name ?? "").trim();
  if (!contact || /\b(?:director|group|team|studio)\b/i.test(contact)) {
    return `Team at ${lead.studio_name}`;
  }
  return contact.split(/\s+/)[0];
}

const P =
  'style="font-family:Georgia,serif;font-size:15px;line-height:1.85;color:#1A1A1A;margin:0 0 18px;"';

export function renderKeyEmail(lead: Lead, portalUrl: string): string {
  const paragraphs = [
    `Hi ${esc(salutation(lead))},`,
    `Fantastic. Here is your private portal key and dedicated link to skip the traditional trade onboarding queue:`,
    `<a href="${esc(portalUrl)}" style="color:#1A1A1A;">${esc(portalUrl)}</a>`,
    `Once you log in, your private workspace will be populated with direct net pricing aligned with your profile. I am here if your principal team needs a quick walkthrough.`,
    `Warm regards,<br />Cyrille Delval<br />Founder, Maison Affluency`,
  ];
  return `
  <div style="background:#FAF9F6;padding:40px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#FAF9F6;">
      <tr>
        <td style="padding:28px 32px 28px;border-bottom:1px solid #1A1A1A;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:17px;letter-spacing:6px;text-transform:uppercase;color:#1A1A1A;"><a href="${SITE}" style="color:#1A1A1A;text-decoration:none;">MAISON AFFLUENCY</a></div>
        </td>
      </tr>
      <tr><td style="padding:0 32px 40px;">${paragraphs.map((p) => `<p ${P}>${p}</p>`).join("")}</td></tr>
    </table>
  </div>`;
}

/** Fetch the reply text/headers from Resend (webhooks carry metadata only). */
export async function fetchInboundEmail(emailId: string): Promise<{
  text: string;
  headers: Record<string, unknown>;
} | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!lovableKey || !resendKey) return null;

  const res = await fetch(`${GATEWAY}/emails/receive/${encodeURIComponent(emailId)}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
  });
  if (!res.ok) {
    console.error(`[resend-inbound] retrieve failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const body = (await res.json()) as {
    text?: string;
    html?: string;
    headers?: Record<string, unknown>;
  };
  const text = body.text ??
    String(body.html ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&");
  return { text: String(text ?? ""), headers: body.headers ?? {} };
}

export function createInboundHandler(deps: InboundDeps) {
  return async function handleInbound(req: Request): Promise<Response> {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

    const secret = deps.getSecret();
    const headers = readSvixHeaders(req);
    const verified = await verifySvixSignature({ secret, rawBody, headers });
    if (!verified.ok) {
      console.warn(`[resend-inbound] rejected: ${verified.reason}`);
      return json({ error: "invalid_signature" }, 401);
    }

    let event: { type?: string; data?: Record<string, unknown> };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    if (event.type !== "email.received") {
      return json({ ignored: true, type: event.type ?? null });
    }

    const supabase = deps.getClient();

    const data = event.data ?? {};
    const providerEventId = String(headers.id ?? data.email_id ?? "");
    const emailId = String(data.email_id ?? "");
    const fromEmail = baseEmail(data.from);
    const toList = Array.isArray(data.to) ? data.to.map(String) : [String(data.to ?? "")];
    const subject = String(data.subject ?? "").slice(0, 300);
    const threadMessageId = String(data.message_id ?? "").slice(0, 300);

    // Idempotency: a retried delivery must never send a second portal key.
    const ledger = await supabase
      .from("acquisition_inbound_events")
      .insert({
        provider_event_id: providerEventId,
        event_type: "email.received",
        from_email: fromEmail || null,
        to_email: toList[0] ?? null,
        subject: subject || null,
        provider_message_id: threadMessageId || null,
      })
      .select("id")
      .maybeSingle();

    if (ledger.error) {
      if (String(ledger.error.code) === "23505") {
        return json({ duplicate: true });
      }
      console.error("[resend-inbound] ledger insert failed:", ledger.error.message);
      return json({ error: "ledger_failed" }, 500);
    }
    const ledgerId = ledger.data?.id as string | undefined;

    const finish = async (patch: Record<string, unknown>, response: Record<string, unknown>) => {
      if (ledgerId) {
        await supabase.from("acquisition_inbound_events").update(patch).eq("id", ledgerId);
      }
      return json(response);
    };

    // ---- Match the studio -------------------------------------------------
    // 1. Trusted sub-address metadata (reply+<lead id>@…) when present.
    let lead: Lead | null = null;
    for (const address of toList) {
      const local = normalizeEmail(address).split("@")[0] ?? "";
      const tag = local.includes("+") ? local.slice(local.indexOf("+") + 1) : "";
      if (UUID_RE.test(tag)) {
        const { data: byTag } = await supabase
          .from("acquisition_leads")
          .select(
            "id, studio_name, founder_name, business_email, executive_emails, campaign_status, portal_key_sent_at",
          )
          .eq("id", tag)
          .maybeSingle();
        if (byTag) lead = byTag as Lead;
        break;
      }
    }

    // 2. Otherwise the sender address, against real outbound recipients.
    if (!lead && fromEmail) {
      const { data: candidates } = await supabase
        .from("acquisition_leads")
        .select(
          "id, studio_name, founder_name, business_email, executive_emails, campaign_status, portal_key_sent_at, outbound_recipients",
        )
        .or(
          `business_email.ilike.${fromEmail},executive_emails.cs.{"${fromEmail}"},outbound_recipients.cs.{"${fromEmail}"}`,
        )
        .limit(5);
      const rows = (candidates ?? []) as Lead[];
      if (rows.length === 1) lead = rows[0];
      else if (rows.length > 1) {
        return finish(
          { action: "ambiguous_sender", error: `${rows.length} leads matched ${fromEmail}` },
          { matched: false, reason: "ambiguous_sender" },
        );
      }
    }

    if (!lead) {
      return finish({ action: "no_match" }, { matched: false, reason: "no_match" });
    }

    // ---- Read the reply and classify intent -------------------------------
    // Resend sometimes includes the body inline on the signed event; use it
    // when present (the signature already authenticates it), otherwise fetch.
    const inlineText = typeof data.text === "string" && data.text.trim()
      ? String(data.text)
      : typeof data.html === "string" && String(data.html).trim()
      ? String(data.html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|tr|li)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
      : "";
    const fetched = inlineText
      ? { text: inlineText, headers: {} }
      : emailId
      ? await deps.fetchReply(emailId)
      : null;
    if (!fetched) {
      return finish(
        { lead_id: lead.id, action: "retrieve_failed", error: "Could not retrieve reply body" },
        { matched: true, reason: "retrieve_failed" },
      );
    }

    const { intent } = classifyReplyIntent(fetched.text);
    if (intent !== "positive") {
      await supabase
        .from("acquisition_leads")
        .update({
          reply_received_at: new Date().toISOString(),
          reply_sender_email: fromEmail || null,
          reply_thread_message_id: threadMessageId || null,
          reply_intent: intent,
        })
        .eq("id", lead.id);
      return finish({ lead_id: lead.id, intent, action: "no_action" }, { matched: true, intent });
    }

    // ---- Atomic claim: exactly one delivery wins the key send -------------
    const { data: claimed, error: claimError } = await supabase.rpc("claim_acquisition_reply", {
      _lead_id: lead.id,
      _sender: fromEmail || null,
      _thread_message_id: threadMessageId || null,
    });
    if (claimError) {
      console.error("[resend-inbound] claim failed:", claimError.message);
      return finish(
        { lead_id: lead.id, intent, action: "claim_failed", error: claimError.message },
        { matched: true, intent, sent: false },
      );
    }
    if (claimed !== true) {
      return finish(
        { lead_id: lead.id, intent, action: "already_handled" },
        { matched: true, intent, sent: false, reason: "already_handled" },
      );
    }

    // ---- Deliver the private portal key -----------------------------------
    const slug = studioSlug(lead.studio_name);
    // Single-use, unguessable activation token (only its SHA-256 is stored).
    const rawBytes = new Uint8Array(32);
    crypto.getRandomValues(rawBytes);
    const activationToken = Array.from(rawBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const tokenHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(activationToken))))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    await supabase.from("acquisition_leads").update({
      activation_token_hash: tokenHash,
      activation_token_expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
      activation_token_used_at: null,
    }).eq("id", lead.id);
    const portalUrl = `${SITE}/trade/activate?token=${activationToken}&studio=${encodeURIComponent(slug)}`;
    let recipient = fromEmail || lead.business_email;
    let keySubject = `Re: Priority trade access for ${lead.studio_name} / Maison Affluency`;

    // Server-side Test Mode: while the acquisitions dashboard toggle is on,
    // every automated portal key is rerouted to the admin test inbox.
    const { data: testCfg } = await supabase
      .from("acquisition_test_mode")
      .select("enabled, redirect_email")
      .eq("id", true)
      .maybeSingle();
    const testActive = testCfg?.enabled === true &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(testCfg?.redirect_email ?? ""));
    if (testActive) {
      recipient = String(testCfg!.redirect_email);
      keySubject = `[TEST-MODE] ${keySubject}`;
    }

    const outcome = await deps.sendEmail(
      {
        to: recipient,
        subject: keySubject,
        html: renderKeyEmail(lead, portalUrl),
        label: "acquisition-portal-key",
        idempotencyKey: testActive
          ? `acquisition-portal-key-test-${lead.id}-${Date.now()}`
          : `acquisition-portal-key-${lead.id}`,
        replyTo: "cyrille@maisonaffluency.com",
        templateData: {
          studioName: lead.studio_name,
          salutation: salutation(lead),
          studioSlug: slug,
          uniquePortalKey: `/trade/activate?token=${activationToken}`,
        },
      },
      supabase,
    );

    if (outcome.queued.length === 0) {
      const reason = outcome.suppressed.length
        ? "suppressed"
        : outcome.failed[0]?.error ?? "send_failed";
      // Stay in replied_interested so the key can be retried safely.
      await supabase
        .from("acquisition_leads")
        .update({ email_error: String(reason).slice(0, 300) })
        .eq("id", lead.id);
      return finish(
        { lead_id: lead.id, intent, action: "key_send_failed", error: String(reason).slice(0, 300) },
        { matched: true, intent, sent: false, reason },
      );
    }

    const now = new Date().toISOString();
    await supabase
      .from("acquisition_leads")
      .update({
        campaign_status: "portal_activated",
        portal_key_sent_at: now,
        portal_activated_at: now,
        email_error: null,
      })
      .eq("id", lead.id);

    return finish(
      { lead_id: lead.id, intent, action: "portal_key_sent" },
      { matched: true, intent, sent: true, lead_id: lead.id },
    );
  };
}
