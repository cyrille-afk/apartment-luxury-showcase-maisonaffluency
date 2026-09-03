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
import {
  AUTO_APPROVE_AT,
  credentialGuidance,
  decideVerification,
  regionFor,
  validateIdentifiers,
  type ExtractedIdentifier,
} from "./regional.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Stage 1 — fast, cost-effective multimodal parse of the credential document.
const EXTRACT_MODEL = "google/gemini-3.7-flash";
// Stage 2 — frontier reasoning model that issues the actual verdict.
const VERDICT_MODEL = "openai/gpt-5.6-sol";
const TRIAGE_URL = "https://www.maisonaffluency.com/admin/trade-review";
const AI_TIMEOUT_MS = 45_000;
const SITE_TIMEOUT_MS = 12_000;
const AUTO_APPROVE_AT = 85; // confidence_score out of 100
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MIN = 15;

type Verdict = {
  confidence_score: number;
  reasoning: string;
  legitimate_practice: boolean;
  name_matches: boolean;
  high_end_design: boolean;
  tax_id_plausible: boolean;
  website_reachable: boolean;
  notes: string;
  /** Regional corporate identifiers read off the document / website. */
  extracted_identifiers?: { type: string; value: string }[];
  /** e.g. "SIDAC Accreditation (ID Class 2)", "Dubai DED Trade Licence" */
  credential_body?: string;
  regional_credential?: boolean;
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

// Second consecutive failure → notify the operator through a secure webhook
// (falls back to a transactional email when no webhook is configured).
async function notifyAdmin(admin: any, app: any, aiError: string, attempts: number) {
  const webhook = Deno.env.get("ADMIN_ALERT_WEBHOOK_URL");
  const payload = {
    event: "trade_verification_failed",
    application_id: app.id,
    company_name: app.company_name,
    country: app.country,
    attempts,
    error: aiError,
    at: new Date().toISOString(),
  };
  if (webhook) {
    try {
      const secret = Deno.env.get("ADMIN_ALERT_WEBHOOK_SECRET");
      await fetch(webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "X-Webhook-Secret": secret } : {}),
        },
        body: JSON.stringify(payload),
      });
      return;
    } catch (_) {
      // fall through to email
    }
  }
  try {
    await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "scrape-failure-alert",
        recipientEmail: "cyrille@maisonaffluency.com",
        idempotencyKey: `trade-verify-fail-${app.id}-${attempts}`,
        templateData: {
          windowMinutes: 15,
          failures: [{ status_code: 500, body: `Trade verification failed for ${app.company_name}: ${aiError}`, created: payload.at }],
        },
      },
    });
  } catch (_) {
    // non-fatal
  }
}

// Applicant flagged for manual review → instant Slack/Discord alert.
// Payload is shaped so a plain Slack or Discord incoming webhook renders it as
// text, while custom endpoints still get the structured fields.
async function notifyFlagged(
  app: any,
  applicantName: string,
  confidence: number,
  reasoning: string,
) {
  const webhook = Deno.env.get("ADMIN_ALERT_WEBHOOK_URL");
  if (!webhook) return;
  const link = `${TRIAGE_URL}?application=${app.id}`;
  const lines = [
    `*Trade application flagged for review* (confidence ${confidence}/100)`,
    `• Applicant: ${applicantName || "(unknown)"}`,
    `• Company: ${app.company_name || "(unknown)"}`,
    `• Country: ${app.country || "(unknown)"}`,
    `• Website: ${app.company_website || "(none provided)"}`,
    `• Reason: ${(reasoning || "No reasoning returned").slice(0, 600)}`,
    `→ Triage: ${link}`,
  ].join("\n");

  const payload = {
    event: "trade_application_flagged",
    text: lines, // Slack
    content: lines, // Discord
    application_id: app.id,
    applicant_name: applicantName,
    company_name: app.company_name,
    country: app.country,
    website: app.company_website,
    confidence_score: confidence,
    reason: reasoning,
    triage_url: link,
    at: new Date().toISOString(),
  };

  try {
    const secret = Deno.env.get("ADMIN_ALERT_WEBHOOK_SECRET");
    await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Webhook-Secret": secret } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // non-fatal — the triage dashboard remains the source of truth
  }
}

async function callGateway(
  key: string,
  model: string,
  content: any,
  opts: { json?: boolean; timeout?: number } = {},
): Promise<{ text: string; error: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout ?? AI_TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content }],
    };
    if (opts.json) body.response_format = { type: "json_object" };
    // GPT-5.6 models on /v1/chat/completions must disable reasoning explicitly.
    if (model.startsWith("openai/gpt-5.6")) body.reasoning_effort = "none";

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });
    clearTimeout(t);
    if (!res.ok) {
      return { text: "", error: `AI gateway returned ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    const data = await res.json();
    return { text: data?.choices?.[0]?.message?.content || "", error: "" };
  } catch (e) {
    clearTimeout(t);
    return { text: "", error: e instanceof Error ? e.message : "AI request failed" };
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

  // Caller must be the applicant, an admin, or the internal retry cron.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  let callerId: string | undefined;
  if (!isCron) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    const { data: claimsData } = await admin.auth.getClaims(token);
    callerId = (claimsData as any)?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Unauthorized" }, 401);
  }

  const { data: app, error: appErr } = await admin
    .from("trade_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr || !app) return json({ error: "Application not found" }, 404);

  if (!isCron && app.user_id !== callerId) {
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

  // ── Continuous learning: recent manual corrections as few-shot examples ──
  const { data: feedback } = await admin
    .from("verification_feedback_loops")
    .select("submission, ai_reasoning, ai_confidence, admin_decision, admin_notes")
    .order("created_at", { ascending: false })
    .limit(12);

  const fewShot = (feedback || []).length
    ? `\n\nPAST HUMAN CORRECTIONS (learn from these — the human decision is always the ground truth):\n` +
      (feedback || [])
        .map((f: any, i: number) => {
          const sub = f.submission || {};
          return `Example ${i + 1}: Company "${sub.company_name ?? "?"}" (${sub.country ?? "?"}), website ${sub.company_website ?? "none"}, title ${sub.job_title ?? "?"}. AI said (confidence ${f.ai_confidence ?? "?"}): ${(f.ai_reasoning || "").slice(0, 240)} → HUMAN DECISION: ${String(f.admin_decision).toUpperCase()}${f.admin_notes ? ` (${String(f.admin_notes).slice(0, 160)})` : ""}.`;
        })
        .join("\n") +
      `\nApply the same judgement: do not repeat the mistakes above, and do not flag cases the human has consistently approved.`
    : "";

  // ── Stage 1: fast Flash pass extracts the credential document's text ──
  let docExtract = "";
  let stage1Error = "";
  if (docImage && LOVABLE_API_KEY) {
    const { text, error } = await callGateway(
      LOVABLE_API_KEY,
      EXTRACT_MODEL,
      [
        {
          type: "text",
          text:
            "Transcribe every legible element of this professional credential document: issuing body, holder name, company name, membership/licence/accreditation number, class or grade, issue and expiry dates, and any registration or tax identifiers. Pay particular attention to regional identifiers and quote them verbatim: Singapore UEN / ACRA numbers, SIDAC or SIDS accreditation (including ID Class 1/2/3), SIA membership numbers, Malaysia SSM numbers, UAE DED or free-zone trade licence numbers, GCC Tax Registration Numbers (TRN), Saudi Commercial Registration (CR) numbers, APID certificate numbers. Transcribe Arabic or Chinese text as well, followed by an English translation in parentheses. Output plain text only, no commentary. If it is not a credential document, say exactly: NOT_A_CREDENTIAL_DOCUMENT.",
        },
        { type: "image_url", image_url: { url: docImage.dataUrl } },
      ],
      { timeout: 25_000 },
    );
    docExtract = (text || "").slice(0, 4000);
    stage1Error = error;
  }

  const docSection = docExtract
    ? `${docNote}\nExtracted document text (parsed by a fast OCR model):\n${docExtract}`
    : stage1Error
      ? `${docNote}\nDocument text extraction failed (${stage1Error}).`
      : docNote;

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
${docSection}


${credentialGuidance(app.country)}

Assess:
(a) does the website or document plausibly match the company/applicant name?
(b) does the business actively operate in high-end interior design or architecture?
(c) are the corporate identifiers (Tax/VAT ID, UEN, TRN, CR number, trade licence) structurally correct for the stated country (format only)?

Return ONLY a JSON object, no prose, with keys:
confidence_score (integer 0-100), reasoning (2-4 sentences explaining the score, written for a human reviewer), legitimate_practice (bool), name_matches (bool), high_end_design (bool), tax_id_plausible (bool), website_reachable (bool), notes (one short summary line, max 40 words), credential_body (string naming the issuing body and class/grade if any, e.g. "SIDAC Accreditation — Interior Designer Class 2" or "Dubai DED Trade Licence"; empty string if none), regional_credential (bool — true when the proof is a Singapore/ASEAN or GCC national credential), extracted_identifiers (array of objects {type, value} where type is the identifier's name such as "Singapore UEN", "UAE TRN", "Saudi CR Number", "UAE Trade Licence", "Malaysia SSM Registration", "VAT Number", and value is the identifier exactly as printed; empty array if none found).
Be conservative: if the website is unreachable, password-protected or the evidence is ambiguous, keep confidence_score below 60. But apply the CRITICAL SCORING RULE above — a clear, name-matching regional credential from Asia or the Middle East scores 85 or higher even when no Western professional body is present.${fewShot}`;


  // ── Stage 2: frontier model issues the verdict from the parsed evidence ──
  let verdict: Verdict | null = null;
  let aiError = "";
  if (!LOVABLE_API_KEY) {
    aiError = "AI gateway key not configured.";
  } else {
    const { text: raw, error } = await callGateway(LOVABLE_API_KEY, VERDICT_MODEL, prompt, {
      json: true,
    });
    if (error) {
      aiError = error;
    } else {
      const match = typeof raw === "string" ? raw.match(/\{[\s\S]*\}/) : null;
      if (match) {
        try {
          verdict = JSON.parse(match[0]) as Verdict;
        } catch {
          aiError = "Model returned malformed JSON.";
        }
      } else {
        aiError = "Model returned no parsable JSON.";
      }
    }
  }

  const attempts = (app.verification_attempts ?? 0) + 1;

  // ── Error loop: AI unavailable / timed out / unparsable → system_retry ──
  if (!verdict) {
    const retryable = attempts < MAX_ATTEMPTS;
    const nextRetry = retryable
      ? new Date(Date.now() + RETRY_DELAY_MIN * 60_000).toISOString()
      : null;

    await admin
      .from("trade_applications")
      .update({
        status: retryable ? "system_retry" : "flagged_for_review",
        verification_attempts: attempts,
        next_retry_at: nextRetry,
        last_verification_error: aiError || "Verification failed",
        verification_notes: retryable
          ? `Automatic verification could not complete (${aiError || "unknown error"}). A retry is scheduled in ${RETRY_DELAY_MIN} minutes.`
          : `Automatic verification failed twice (${aiError || "unknown error"}). Manual review required.`,
        ai_verified_at: new Date().toISOString(),
        ai_result: { ai_error: aiError, attempts },
      })
      .eq("id", applicationId);

    if (!retryable) {
      await notifyAdmin(admin, app, aiError, attempts);
      await notifyFlagged(app, applicantName, 0, `Automatic verification failed twice: ${aiError}`);
    }

    return json({ status: retryable ? "system_retry" : "flagged_for_review", error: aiError, attempts });
  }

  // ── Structural validation of the extracted regional corporate IDs ──
  const declared = app.tax_vat_id
    ? [{ type: `${app.country || ""} Tax/VAT ID`.trim(), value: String(app.tax_vat_id) }]
    : [];
  const modelIds = Array.isArray(verdict.extracted_identifiers) ? verdict.extracted_identifiers : [];
  const seen = new Set<string>();
  const merged = [...modelIds, ...declared].filter((i) => {
    const k = `${(i as any)?.type}|${(i as any)?.value}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const identifiers: ExtractedIdentifier[] = validateIdentifiers(merged, app.country);

  // A suspicious corporate ID always goes to a human, whatever the model said.
  const decision = decideVerification(verdict.confidence_score, identifiers);
  const { rawScore, confidenceScore, autoApprove, malformed, status } = decision;

  const idNote = malformed.length
    ? ` Structural check flagged ${malformed.length} improperly formatted corporate ID(s): ${malformed
        .map((i) => `${i.type} "${i.value}" — ${i.note}`)
        .join("; ")}`
    : "";
  const notes = `${verdict.reasoning || verdict.notes || ""}${idNote}`.trim();

  await admin
    .from("trade_applications")
    .update({
      status,
      tax_exempt_status: autoApprove,
      verification_notes: notes,
      ai_confidence: confidenceScore,
      verification_attempts: attempts,
      next_retry_at: null,
      last_verification_error: null,
      ai_result: {
        ...verdict,
        confidence_score: confidenceScore,
        model_confidence_score: rawScore,
        website_status: site.status,
        region: regionFor(app.country),
        extracted_identifiers: identifiers,
        identifier_warnings: malformed.length,
      },
      ai_verified_at: new Date().toISOString(),
      ...(autoApprove ? { reviewed_at: new Date().toISOString() } : {}),
    })
    .eq("id", applicationId);

  if (!autoApprove) {
    await notifyFlagged(app, applicantName, confidenceScore, notes);
  }

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

  return json({ status, confidence_score: confidenceScore, reasoning: notes });
});
