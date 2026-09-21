// One-click personalised outbound dispatch for `acquisition_leads`.
//
// Admin-only. Takes lead ids, renders the Maison Affluency trade invitation
// around each lead's AI-derived aesthetic and predicted designer matches,
// sends it through Lovable Emails (Resend) and stamps `campaign_status`.
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

type Lead = {
  id: string;
  studio_name: string;
  founder_name: string | null;
  business_email: string;
  executive_emails: string[] | null;
  aesthetic_profile: string | null;
  predicted_designer_matches: string[] | null;
  campaign_status: string;
};

/** Manual A–Z selections rendered as one editorial sentence fragment. */
function designerString(matches: string[]): string {
  if (matches.length === 0) return "our curated collective of master artisans";
  if (matches.length === 1) return esc(matches[0]);
  if (matches.length === 2) return `${esc(matches[0])} and ${esc(matches[1])}`;
  return `${matches.slice(0, -1).map(esc).join(", ")}, and ${esc(matches[matches.length - 1])}`;
}

function salutation(lead: Lead): string {
  const contact = String(lead.founder_name ?? "").trim();
  if (!contact || /\b(?:director|group)\b/i.test(contact)) {
    return `Team at ${esc(lead.studio_name)}`;
  }
  return esc(contact);
}

const P =
  'style="font-family:Georgia,serif;font-size:15px;line-height:1.85;color:#1A1A1A;margin:0 0 18px;"';

function shell(paragraphs: string[]): string {
  const navLink = (label: string) =>
    `<a href="${SITE}" style="color:#1A1A1A;text-decoration:none;">${label}</a>`;
  return `
  <div style="background:#FAF9F6;padding:40px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#FAF9F6;">
      <tr>
        <td style="padding:28px 32px 28px;border-bottom:1px solid #1A1A1A;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:17px;letter-spacing:6px;text-transform:uppercase;color:#1A1A1A;"><a href="${SITE}" style="color:#1A1A1A;text-decoration:none;">MAISON AFFLUENCY</a></div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#1A1A1A;opacity:0.55;margin-top:10px;">${navLink("The Archive")}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;${navLink("AI Curatorial Chat")}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;${navLink("Global Trade")}</div>
        </td>
      </tr>
      <tr><td style="padding:0 32px 40px;">${paragraphs.map((p) => `<p ${P}>${p}</p>`).join("")}</td></tr>
    </table>
  </div>`;
}

/** Maison Affluency priority trade invitation. */
function renderTemplateA(lead: Lead, designers: string): string {
  const studio = esc(lead.studio_name);
  return shell([
    `Dear ${salutation(lead)},`,
    `I have been closely following your studio&rsquo;s footprint, particularly your focus on sourcing exceptional pieces for your portfolio.`,
    `We recently launched Maison Affluency&mdash;a dedicated, technology-first sourcing platform built strictly for elite interior architects. Our focus is eliminating the slow, manual paper quoting legacy networks rely on, replacing it with instant global net pricing and dedicated curatorial advisory tailored to your project workspaces.`,
    `We have unified over 170 master furniture and lighting designers under a single architecture. Given the caliber of your work, we have already indexed direct access to pieces from creators like ${designers} specifically aligned with your aesthetic.`,
    `We would love to extend full international trade status and seamless global invoicing privileges to your firm.`,
    `If you are open to it, I would be delighted to host a brief 5-minute walkthrough of the portal for your principal team, or I can send over our private credential key directly to this email.`,
    `Warm regards,<br />Cyrille Delval<br />Founder, Maison Affluency`,
  ]);
}

/** Template B — personal savant override (hand-curated triage). */
function renderTemplateB(lead: Lead, designers: string): string {
  return renderTemplateA(lead, designers);
}

function renderLegacyInvitation(lead: Lead, roster: Map<string, string>): string {
  const greeting = lead.founder_name
    ? `Dear ${esc(lead.founder_name)}`
    : "Dear Studio Director";
  // Manual curatorial assignment is authoritative: inject exactly the
  // designers selected on the lead, in order, with no cap.
  const matches = (lead.predicted_designer_matches ?? [])
    .map((n) => String(n ?? "").trim())
    .filter(Boolean);

  const designerBlocks = matches
    .map((name) => {
      const slug = roster.get(String(name).toLowerCase());
      const link = slug
        ? `<a href="${SITE}/designers/${encodeURIComponent(slug)}" style="display:inline-block;margin-top:10px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a961;text-decoration:none;">View the collection &rarr;</a>`
        : "";
      return `
        <tr>
          <td style="padding:16px 20px;border:1px solid #1f3b34;background:#0d1f1b;">
            <div style="font-family:Georgia,serif;font-size:16px;color:#e9e2d4;letter-spacing:0.4px;">${esc(name)}</div>
            ${link}
          </td>
        </tr>
        <tr><td style="height:12px;"></td></tr>`;
    })
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
            We have been following the work of <strong style="color:#e9e2d4;">${esc(lead.studio_name)}</strong>${
              lead.aesthetic_profile
                ? ` and read it as <em style="color:#c9a961;">${esc(lead.aesthetic_profile)}</em>`
                : ""
            }.
          </p>
          <p style="font-family:Georgia,serif;font-size:15px;line-height:1.8;color:#c7d3ce;margin:0 0 24px;">
            Maison Affluency represents a curated house of collectible and contemporary makers for interior
            architects. These, in particular, belong in your projects:
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

  const auth = await requireAdmin(req, "dispatch-acquisition-campaign");
  if (!auth.ok) return json(auth.body, auth.status);

  let body: {
    ids?: unknown;
    resend?: boolean;
    testMode?: boolean;
    variant?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v)).slice(0, MAX_PER_RUN)
    : [];
  if (ids.length === 0) return json({ error: "Select at least one lead" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("acquisition_leads")
    .select(
      "id, studio_name, founder_name, business_email, executive_emails, aesthetic_profile, predicted_designer_matches, campaign_status",
    )
    .in("id", ids);
  if (error) return json({ error: "Could not load leads" }, 500);

  const { data: designers } = await supabase
    .from("designers")
    .select("name, slug")
    .eq("is_published", true);
  const roster = new Map(
    (designers ?? []).map((d: { name: string; slug: string }) => [
      String(d.name).toLowerCase(),
      String(d.slug),
    ]),
  );

  const results: { id: string; studio: string; status: string; reason?: string }[] = [];

  // Test mode routes every message to the signed-in admin and never stamps
  // the row as sent, so the lead stays live for production deployment.
  const testMode = body.testMode === true;
  const adminEmail = String((auth.claims as { email?: unknown }).email ?? "").trim();
  if (testMode && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    return json({ error: "No admin email on this session for test mode" }, 400);
  }
  const variant = body.variant === "B" ? "B" : "A";

  for (const row of (data ?? []) as Lead[]) {
    if (
      !testMode &&
      (["sent", "outbound_sent", "converted", "activated"].includes(row.campaign_status)) &&
      !body.resend
    ) {
      results.push({ id: row.id, studio: row.studio_name, status: "skipped", reason: "already_sent" });
      continue;
    }
    const matches = (Array.isArray(row.predicted_designer_matches)
      ? row.predicted_designer_matches
      : [])
      .map((n) => String(n ?? "").trim())
      .filter(Boolean);
    const designers = designerString(matches);
    void roster;

    // Executive-vetted contacts win over the generic studio catch-all.
    const vetted = (Array.isArray(row.executive_emails) ? row.executive_emails : [])
      .map((e) => String(e ?? "").trim())
      .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    const recipients = testMode
      ? [adminEmail]
      : vetted.length > 0
        ? vetted
        : [row.business_email];

    const html =
      variant === "B"
        ? renderTemplateB(row, designers)
        : renderTemplateA(row, designers);
    const baseSubject = `Priority trade access for ${row.studio_name} / Maison Affluency`;
    const subject = testMode ? `[TEST-MODE] ${baseSubject}` : baseSubject;

    const outcome = await sendLovableEmail(
      {
        to: recipients,
        subject,
        html,
        label: "acquisition-trade-invitation",
        idempotencyKey: testMode
          ? `acquisition-invite-test-${row.id}-${Date.now()}`
          : `acquisition-invite-${variant}-${row.id}`,
        replyTo: "cyrille@maisonaffluency.com",
        templateData: {
          studioName: row.studio_name,
          salutation: salutation(row).replace(/&amp;/g, "&"),
          designerBrands: matches.length > 0
            ? matches.length === 1
              ? matches[0]
              : matches.length === 2
                ? `${matches[0]} and ${matches[1]}`
                : `${matches.slice(0, -1).join(", ")}, and ${matches[matches.length - 1]}`
            : "our curated collective of master artisans",
        },
      },
      supabase,
    );

    if (outcome.queued.length > 0) {
      if (!testMode) {
        await supabase
          .from("acquisition_leads")
          .update({
            campaign_status: "outbound_sent",
            email_sent_at: new Date().toISOString(),
            email_error: null,
          })
          .eq("id", row.id);
      }
      results.push({
        id: row.id,
        studio: row.studio_name,
        status: testMode ? "test_sent" : "outbound_sent",
      });
    } else {
      const reason = outcome.suppressed.length
        ? "suppressed"
        : outcome.failed[0]?.error ?? "send_failed";
      if (!testMode) {
        await supabase
          .from("acquisition_leads")
          .update({ email_error: String(reason).slice(0, 300) })
          .eq("id", row.id);
      }
      results.push({ id: row.id, studio: row.studio_name, status: "failed", reason });
    }
  }

  return json({
    testMode,
    sent: results.filter((r) => r.status === "outbound_sent" || r.status === "test_sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
});
