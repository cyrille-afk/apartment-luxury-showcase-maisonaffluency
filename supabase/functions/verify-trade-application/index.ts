// AI verification for Global Trade Program applications.
//
// Called right after an application is submitted. It:
//   1. Fetches the submitted website (best effort, short timeout).
//   2. Downloads the uploaded credential document from the private
//      `trade-credentials` bucket (images are passed to the vision model).
//   3. Asks a multimodal model whether this is a legitimate high-end
//      interior design / architecture practice, whether the site or document
//      matches the applicant/company, and whether the Tax/VAT ID is
//      structurally plausible for the stated country.
//   4. Auto-approves on high confidence (grants trade_user, sets
//      tax_exempt_status, sends the welcome email) or flags for manual review.
//
// Fail-safe: any error leaves the application in `flagged` so a human decides.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";
const AI_TIMEOUT_MS = 45_000;
const SITE_TIMEOUT_MS = 12_000;
const AUTO_APPROVE_AT = 0.82;

type Verdict = {
  confidence: number;
  legitimate_practice: boolean;
  name_matches: boolean;
  high_end_design: boolean;
  tax_id_plausible: boolean;
  website_reachable: boolean;
  notes: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function fetchSite(url: string): Promise<{ ok: boolean; text: string; status: number }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), SITE_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MaisonAffluencyTradeBot/1.0)" },
    });
    clearTimeout(t);
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
    return { ok: res.ok, text, status: res.status };
  } catch {
    return { ok: false, text: "", status: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  let applicationId = "";
  try {
    const body = await req.json();
    applicationId = String(body?.application_id || "");
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) {
    return json({ error: "application_id must be a UUID" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Caller must be the applicant or an admin.
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const { data: claimsData } = await admin.auth.getClaims(token);
  const callerId = (claimsData as any)?.claims?.sub as string | undefined;
  if (!callerId) return json({ error: "Unauthorized" }, 401);

  const { data: app, error: appErr } = await admin
    .from("trade_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr || !app) return json({ error: "Application not found" }, 404);

  if (app.user_id !== callerId) {
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", app.user_id)
    .maybeSingle();

  const applicantName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();

  // ── Gather evidence ───────────────────────────────────────────────
  const site = app.company_website ? await fetchSite(app.company_website) : { ok: false, text: "", status: 0 };

  let docImage: { dataUrl: string } | null = null;
  let docNote = "No credential document uploaded.";
  if (app.credential_document_path) {
    const { data: file } = await admin.storage.from("trade-credentials").download(app.credential_document_path);
    if (file) {
      const type = file.type || "application/octet-stream";
      if (type.startsWith("image/") && file.size < 6_000_000) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        docImage = { dataUrl: `data:${type};base64,${btoa(bin)}` };
        docNote = "Credential document attached as an image below.";
      } else {
        docNote = `Credential document uploaded (${type}, ${Math.round(file.size / 1024)} KB) — not machine-readable here.`;
      }
    } else {
      docNote = "Credential document could not be retrieved.";
    }
  }

  const prompt = `You are vetting an application to a luxury trade program for architects and interior designers.

APPLICANT
Name: ${applicantName || "(unknown)"}
Email: ${profile?.email || "(unknown)"}
Company: ${app.company_name}
Job title: ${app.job_title}
Country: ${app.country}${app.city ? `, ${app.city}` : ""}
Website: ${app.company_website || "(none provided)"}
Instagram: ${app.instagram_handle || "(none provided)"}
Tax/VAT ID: ${app.tax_vat_id || "(none provided)"}
Self-declared certification: ${app.is_certified_professional ? "Yes" : "No"} ${app.certification_details || ""}

WEBSITE FETCH
Status: ${site.status || "unreachable / password-protected / blocked"}
Extracted text: ${site.text ? site.text.slice(0, 5000) : "(none)"}

CREDENTIAL DOCUMENT
${docNote}

Assess:
(a) does the website or document plausibly match the company/applicant name?
(b) does the business actively operate in high-end interior design or architecture?
(c) is the Tax/VAT ID structurally correct for the stated country (format only)?

Return ONLY a JSON object, no prose, with keys:
confidence (0-1 number), legitimate_practice (bool), name_matches (bool), high_end_design (bool), tax_id_plausible (bool), website_reachable (bool), notes (one short paragraph for a human reviewer, max 60 words).
Be conservative: if the website is unreachable, password-protected or the evidence is ambiguous, keep confidence below 0.6.`;

  const content: any[] = [{ type: "text", text: prompt }];
  if (docImage) content.push({ type: "image_url", image_url: { url: docImage.dataUrl } });

  let verdict: Verdict | null = null;
  let aiError = "";
  if (!LOVABLE_API_KEY) {
    aiError = "AI gateway key not configured.";
  } else {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
        }),
      });
      clearTimeout(t);
      if (!res.ok) {
        aiError = `AI gateway returned ${res.status}: ${(await res.text()).slice(0, 300)}`;
      } else {
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content || "";
        const match = typeof raw === "string" ? raw.match(/\{[\s\S]*\}/) : null;
        if (match) verdict = JSON.parse(match[0]) as Verdict;
        else aiError = "Model returned no parsable JSON.";
      }
    } catch (e) {
      aiError = e instanceof Error ? e.message : "AI request failed";
    }
  }

  const confidence = verdict ? Math.max(0, Math.min(1, Number(verdict.confidence) || 0)) : 0;
  const autoApprove =
    !!verdict &&
    verdict.legitimate_practice &&
    verdict.high_end_design &&
    verdict.name_matches &&
    verdict.website_reachable &&
    confidence >= AUTO_APPROVE_AT;

  const status = autoApprove ? "approved" : "flagged";
  const notes = verdict
    ? verdict.notes
    : `Automatic verification unavailable — ${aiError || "unknown error"}. Manual review required.`;

  await admin
    .from("trade_applications")
    .update({
      status,
      tax_exempt_status: autoApprove,
      verification_notes: notes,
      ai_confidence: confidence,
      ai_result: verdict ? { ...verdict, website_status: site.status, ai_error: aiError || null } : { ai_error: aiError },
      ai_verified_at: new Date().toISOString(),
      ...(autoApprove ? { reviewed_at: new Date().toISOString() } : {}),
    })
    .eq("id", applicationId);

  if (autoApprove) {
    await admin.from("user_roles").upsert(
      { user_id: app.user_id, role: "trade_user" },
      { onConflict: "user_id,role" },
    );
    if (profile?.email) {
      try {
        await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "trade-approval",
            recipientEmail: profile.email,
            idempotencyKey: `trade-approval-${applicationId}`,
            templateData: { name: applicantName, companyName: app.company_name },
          },
        });
      } catch (_) {
        // non-fatal
      }
    }
  }

  return json({ status, confidence, notes });
});
