import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendLovableEmail } from "../_shared/lovableEmail.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ADMIN_EMAILS = [
  "ops@maisonaffluency.com",
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];

interface WebhookPayload {
  type?: "INSERT" | "UPDATE";
  table?: string;
  record?: {
    id?: string;
    company_name?: string;
    email?: string;
    document_hash?: string;
    fraud_flags?: string[];
    status?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const record = payload?.record || {};
  const applicationId = record.id;
  if (!applicationId || !/^[0-9a-f-]{36}$/i.test(String(applicationId))) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid application id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: row, error } = await admin
    .from("trade_applications")
    .select("id, company_name, email, document_hash, fraud_flags, status")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    console.error("trade-fraud-alert db error:", error);
    return new Response(
      JSON.stringify({ error: "Database error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!row) {
    return new Response(
      JSON.stringify({ message: "Application not found. Skipping." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const hasDuplicateFlag = Array.isArray(row.fraud_flags) &&
    row.fraud_flags.includes("DUPLICATE_DOCUMENT_FINGERPRINT");

  if (row.status !== "flagged" || !hasDuplicateFlag) {
    return new Response(
      JSON.stringify({ message: "No fraud criteria met. Skipping." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const company = escapeHtml(row.company_name || "Unknown");
  const email = escapeHtml(row.email || "N/A");
  const hash = escapeHtml(row.document_hash || "N/A");
  const flags = (row.fraud_flags || []).map(escapeHtml).join(", ");

  const html = `
    <div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;padding:32px;background:#faf9f7;">
      <h2 style="font-size:18px;color:#1a1a1a;margin:0 0 16px;">🚨 Trade Fraud Alert — Duplicate Document Fingerprint</h2>
      <div style="background:#fff;border:1px solid #e8e5e0;border-radius:4px;padding:20px;">
        <p>A trade application was automatically flagged because the uploaded credential fingerprint matches a previously submitted document.</p>
        <table style="border-collapse:collapse;font-size:13px;margin-top:12px;width:100%;">
          <tr><td style="padding:4px 8px;white-space:nowrap;"><strong>Application ID</strong></td><td style="padding:4px 8px;font-family:monospace;word-break:break-all;">${escapeHtml(row.id)}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Company</strong></td><td style="padding:4px 8px;">${company}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Applicant Email</strong></td><td style="padding:4px 8px;">${email}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Document Hash</strong></td><td style="padding:4px 8px;font-family:monospace;word-break:break-all;">${hash}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Triggered Flags</strong></td><td style="padding:4px 8px;">${flags}</td></tr>
        </table>
        <p style="font-size:12px;color:#666;margin-top:16px;">
          This application remains locked in a "Flagged" state. Wholesale tier pricing, zero-tax exemptions, and Net terms are disabled until a manual compliance review overrides the flag.
        </p>
        <p style="margin-top:16px;">
          <a href="https://www.maisonaffluency.com/admin/trade-review?application=${encodeURIComponent(row.id)}&open=1" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 18px;text-decoration:none;border-radius:4px;font-size:13px;">Open Operations Review Queue</a>
        </p>
      </div>
      <p style="font-size:11px;color:#999;margin-top:16px;text-align:center;">Maison Affluency — Automated Security Alert</p>
    </div>`;

  const result = await sendLovableEmail({
    to: ADMIN_EMAILS,
    subject: `🚨 CRITICAL: Trade Fraud Alert - ${row.company_name || "Unknown"}`,
    html,
    label: "trade-fraud-alert",
    idempotencyKey: `trade-fraud-alert:${row.id}`,
  });

  return new Response(
    JSON.stringify({ success: true, queued: result.queued, suppressed: result.suppressed, failed: result.failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
