// Shared helper: send pre-rendered HTML email through Lovable Emails.
//
// Replaces direct Resend API usage. Emails are enqueued into the
// `transactional_emails` pgmq queue and dispatched by `process-email-queue`,
// which handles sending, retries and rate-limit backoff.
//
// Configuration mirrors `send-transactional-email` — do NOT change manually.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SITE_NAME = "Maison Affluency";
// Verified sender subdomain delegated to Lovable's nameservers.
const SENDER_DOMAIN = "notify.www.maisonaffluency.com";
// Domain shown in the From: header.
const FROM_DOMAIN = "www.maisonaffluency.com";

export function createEmailClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function resolveUnsubscribeToken(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", email)
    .maybeSingle();

  if (existing?.token && !existing.used_at) return existing.token;
  if (existing?.token) return null; // already unsubscribed

  const token = generateToken();
  const { error } = await supabase
    .from("email_unsubscribe_tokens")
    .upsert({ token, email }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return null;

  const { data: stored } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", email)
    .maybeSingle();
  return stored?.token ?? null;
}

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  /** Short identifier used for logging, e.g. "security-alert". */
  label: string;
  /** Optional stable key so retries do not duplicate sends. */
  idempotencyKey?: string;
  replyTo?: string;
  text?: string;
}

export interface SendEmailResult {
  queued: string[];
  suppressed: string[];
  failed: { email: string; error: string }[];
}

/**
 * Enqueue one email per recipient through Lovable Emails.
 * Never throws — inspect the returned result.
 */
export async function sendLovableEmail(
  args: SendEmailArgs,
  client?: SupabaseClient,
): Promise<SendEmailResult> {
  const supabase = client ?? createEmailClient();
  const recipients = (Array.isArray(args.to) ? args.to : [args.to])
    .map((e) => (e || "").trim())
    .filter(Boolean);

  const result: SendEmailResult = { queued: [], suppressed: [], failed: [] };
  const plainText = args.text ?? htmlToText(args.html);

  for (const recipient of recipients) {
    const normalized = recipient.toLowerCase();
    const messageId = crypto.randomUUID();

    try {
      const { data: suppressed, error: suppressionError } = await supabase
        .from("suppressed_emails")
        .select("id")
        .eq("email", normalized)
        .maybeSingle();

      if (suppressionError) {
        result.failed.push({ email: recipient, error: "suppression_check_failed" });
        continue;
      }

      if (suppressed) {
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: args.label,
          recipient_email: recipient,
          status: "suppressed",
        });
        result.suppressed.push(recipient);
        continue;
      }

      const unsubscribeToken = await resolveUnsubscribeToken(supabase, normalized);
      if (!unsubscribeToken) {
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: args.label,
          recipient_email: recipient,
          status: "failed",
          error_message: "Failed to resolve unsubscribe token",
        });
        result.failed.push({ email: recipient, error: "unsubscribe_token_unavailable" });
        continue;
      }

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: args.label,
        recipient_email: recipient,
        status: "pending",
      });

      const payload: Record<string, unknown> = {
        message_id: messageId,
        to: recipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: args.subject,
        html: args.html,
        text: plainText,
        purpose: "transactional",
        label: args.label,
        idempotency_key: args.idempotencyKey
          ? `${args.idempotencyKey}:${normalized}`
          : messageId,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      };
      if (args.replyTo) payload.reply_to = args.replyTo;

      const { error: enqueueError } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });

      if (enqueueError) {
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: args.label,
          recipient_email: recipient,
          status: "failed",
          error_message: "Failed to enqueue email",
        });
        result.failed.push({ email: recipient, error: enqueueError.message });
        continue;
      }

      result.queued.push(recipient);
    } catch (e) {
      result.failed.push({ email: recipient, error: (e as Error).message });
    }
  }

  return result;
}
