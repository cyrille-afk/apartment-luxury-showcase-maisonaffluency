// One-click personalised outbound campaign dispatch.
//
// Admin-only. Takes a list of `prospect_studios` ids, renders the
// "Maison Affluency Trade Invitation" around each studio's AI-derived
// aesthetic and its two matched designers, sends it through Lovable Emails
// (Resend), and stamps `email_sent_status`.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireAdmin } from "../_shared/auth.ts";
import { sendLovableEmail } from "../_shared/lovableEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SITE = "https://www.maisonaffluency.com";
const MAX_PER_RUN = 50;

function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Match = { slug: string; name: string; specialty?: string | null; rationale?: string };

type Prospect = {
  id: string;
  studio_name: string;
  founder_name: string | null;
  business_email: string;
  aesthetic_label: string | null;
  aesthetic_summary: string | null;
  matched_designers: Match[] | null;
  email_sent_status: boolean;
};

function renderInvitation(p: Prospect): string {
  const greeting = p.founder_name ? `Dear ${esc(p.founder_name)}` : "Dear Studio Director";
  const matches = (p.matched_designers ?? []).slice(0, 2);

  const designerBlocks = matches
    .map(
      (m) => `
        <tr>
          <td style="padding:16px 20px;border:1px solid #1f3b34;background:#0d1f1b;">
            <div style="font-family:Georgia,serif;font-size:16px;color:#e9e2d4;letter-spacing:0.4px;">${esc(m.name)}</div>
            ${m.specialty ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9bb3aa;text-transform:uppercase;letter-spacing:1.4px;margin-top:4px;">${esc(m.specialty)}</div>` : ""}
            ${m.rationale ? `<p style="font-family:Georgia,serif;font-size:13px;line-height:1.7;color:#c7d3ce;margin:10px 0 0;">${esc(m.rationale)}</p>` : ""}
            <a href="${SITE}/designers/${encodeURIComponent(m.slug)}" style="display:inline-block;margin-top:12px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a961;text-decoration:none;">View the collection &rarr;</a>
          </td>
        </tr>
        <tr><td style="height:12px;"></td></tr>`,
    )
    .join("");

  return `
  <div style="background:#07110f;padding:32px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background:#0a1714;border:1px solid #1f3b34;">
      <tr>
        <td style="padding:36px 32px 8px;text-align:center;">
          <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:3px;color:#e9e2d4;">MAISON AFFLUENCY</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#c9a961;text-transform:uppercase;margin-top:8px;">Trade Invitation</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 0;">
          <p style="font-family:Georgia,serif;font-size:15px;line-height:1.8;color:#e4ded2;margin:0 0 16px;">${greeting},</p>
          <p style="font-family:Georgia,serif;font-size:15px;line-height:1.8;color:#c7d3ce;margin:0 0 16px;">
            We have been following the work of <strong style="color:#e9e2d4;">${esc(p.studio_name)}</strong>${
    p.aesthetic_label
      ? ` and read it as <em style="color:#c9a961;">${esc(p.aesthetic_label)}</em>`
      : ""
  }. ${p.aesthetic_summary ? esc(p.aesthetic_summary) : ""}
          </p>
          <p style="font-family:Georgia,serif;font-size:15px;line-height:1.8;color:#c7d3ce;margin:0 0 24px;">
            Maison Affluency represents a curated house of collectible and contemporary makers for interior architects.
            Two of them, in particular, belong in your projects:
          </p>
        </td>
      </tr>
      <tr><td style="padding:0 32px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${designerBlocks}</table></td></tr>
      <tr>
        <td style="padding:12px 32px 36px;text-align:center;">
          <a href="${SITE}/trade-program" style="display:inline-block;padding:14px 28px;background:#c9a961;color:#07110f;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">Open a trade account</a>
          <p style="font-family:Georgia,serif;font-size:13px;line-height:1.7;color:#8fa79e;margin:22px 0 0;">
            Trade pricing, specification sheets, CAD assets and a private concierge, from our studio in Singapore.
          </p>
        </td>
      </tr>
    </table>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireAdmin(req, "dispatch-prospect-campaign");
  if (!auth.ok) return json(auth.body, auth.status);

  let body: { ids?: unknown; resend?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v)).slice(0, MAX_PER_RUN)
    : [];
  if (ids.length === 0) return json({ error: "Select at least one prospect" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("prospect_studios")
    .select(
      "id, studio_name, founder_name, business_email, aesthetic_label, aesthetic_summary, matched_designers, email_sent_status",
    )
    .in("id", ids);
  if (error) return json({ error: "Could not load prospects" }, 500);

  const results: { id: string; studio: string; status: string; reason?: string }[] = [];

  for (const row of (data ?? []) as Prospect[]) {
    if (row.email_sent_status && !body.resend) {
      results.push({ id: row.id, studio: row.studio_name, status: "skipped", reason: "already_sent" });
      continue;
    }
    const matches = Array.isArray(row.matched_designers) ? row.matched_designers : [];
    if (matches.length === 0) {
      results.push({ id: row.id, studio: row.studio_name, status: "skipped", reason: "not_enriched" });
      continue;
    }

    const outcome = await sendLovableEmail(
      {
        to: row.business_email,
        subject: `${row.studio_name}: an invitation to the Maison Affluency trade house`,
        html: renderInvitation(row),
        label: "prospect-trade-invitation",
        idempotencyKey: `prospect-invite-${row.id}`,
        replyTo: "cyrille@maisonaffluency.com",
      },
      supabase,
    );

    if (outcome.queued.length > 0) {
      await supabase
        .from("prospect_studios")
        .update({
          email_sent_status: true,
          email_sent_at: new Date().toISOString(),
          email_error: null,
        })
        .eq("id", row.id);
      results.push({ id: row.id, studio: row.studio_name, status: "sent" });
    } else {
      const reason = outcome.suppressed.length ? "suppressed" : outcome.failed[0]?.error ?? "send_failed";
      await supabase
        .from("prospect_studios")
        .update({ email_error: String(reason).slice(0, 300) })
        .eq("id", row.id);
      results.push({ id: row.id, studio: row.studio_name, status: "failed", reason });
    }
  }

  return json({
    sent: results.filter((r) => r.status === "sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
});
