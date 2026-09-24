// GDPR / PDPA data-subject rights endpoint.
//
// Articles 15-20 give every data subject a right of access, portability,
// rectification, restriction and erasure, answerable within one calendar
// month. Until now the platform had no mechanism at all: a request could only
// arrive by email and nothing recorded, proved or timed the response. This
// endpoint is the system of record.
//
// Actions
//   submit  (public)  – opens a request and emails a verification link. No
//                       personal data is ever released before the requester
//                       proves control of the address.
//   verify  (public)  – consumes the token, starts the 30-day clock, alerts ops.
//   export  (admin)   – assembles a machine-readable copy of everything held.
//   erase   (admin)   – erases / anonymises, preserving records we are legally
//                       obliged to keep (tax, accounting, consent evidence).
//   reject  (admin)   – records a reasoned refusal.
//
// Identity verification is deliberately email-based and admin-gated: no
// automated action ever deletes data without a human confirming the match.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SITE_URL = "https://www.maisonaffluency.com";
const PRIVACY_INBOX = "privacy@maisonaffluency.com";
const OPS_RECIPIENTS = ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];

const REQUEST_TYPES = new Set([
  "access",
  "portability",
  "erasure",
  "rectification",
  "restriction",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

async function sendMail(to: string[], subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || to.length === 0) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Maison Affluency Privacy <privacy@maisonaffluency.com>",
        to,
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("[data-subject-request] mail failed", e);
  }
}

// ── What we hold, and how each table answers an access or erasure request ──
// `mode` decides erasure behaviour:
//   delete    – no legal basis to retain (marketing, drafts, analytics)
//   anonymise – must be retained for tax/accounting, so identifiers are scrubbed
//   retain    – exported, never erased (immutable consent & security evidence)
type Scope = {
  table: string;
  by: "email" | "user_id";
  column?: string;
  mode: "delete" | "anonymise" | "retain";
  scrub?: Record<string, unknown>;
};

const SCOPES: Scope[] = [
  { table: "profiles", by: "user_id", column: "id", mode: "anonymise", scrub: { email: null, first_name: "Erased", last_name: "Erased", phone: null } },
  { table: "trade_applications", by: "user_id", mode: "anonymise", scrub: { company_website: null, instagram_handle: null, tax_vat_id: null, certification_details: null } },
  { table: "trade_accounts", by: "user_id", mode: "anonymise", scrub: { email: null, contact_name: null, phone_number: null, website_or_ig: null, instagram_handle: null, tax_vat_id: null, business_reg_number: null, admin_notes: null } },
  { table: "inquiries", by: "email", mode: "delete" },
  { table: "custom_inquiries", by: "email", mode: "delete" },
  { table: "abandoned_carts", by: "email", mode: "delete" },
  { table: "concierge_leads", by: "user_id", mode: "delete" },
  { table: "trade_program_signups", by: "email", mode: "delete" },
  { table: "client_contacts", by: "email", mode: "delete" },
  { table: "notifications", by: "user_id", mode: "delete" },
  { table: "trade_favorites", by: "user_id", mode: "delete" },
  { table: "trade_recent_views", by: "user_id", mode: "delete" },
  { table: "push_subscriptions", by: "user_id", mode: "delete" },
  { table: "shop_orders", by: "email", mode: "anonymise", scrub: { email: null, shipping_address: null, billing_address: null } },
  { table: "orders", by: "user_id", mode: "anonymise", scrub: {} },
  { table: "trade_quotes", by: "user_id", mode: "retain" },
  { table: "consent_audit_log", by: "user_id", mode: "retain" },
];

async function collectExport(admin: SupabaseClient, email: string, userId: string | null) {
  const out: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    subject: { email, user_id: userId },
  };
  for (const scope of SCOPES) {
    const col = scope.column ?? (scope.by === "email" ? "email" : "user_id");
    const value = scope.by === "email" ? email : userId;
    if (!value) continue;
    const { data, error } = await admin.from(scope.table).select("*").eq(col, value).limit(500);
    if (error) {
      out[scope.table] = { error: error.message };
      continue;
    }
    if (data && data.length) out[scope.table] = data;
  }
  return out;
}

async function runErasure(admin: SupabaseClient, email: string, userId: string | null) {
  const report: Record<string, string> = {};
  for (const scope of SCOPES) {
    const col = scope.column ?? (scope.by === "email" ? "email" : "user_id");
    const value = scope.by === "email" ? email : userId;
    if (!value) continue;
    if (scope.mode === "retain") {
      report[scope.table] = "retained (legal obligation)";
      continue;
    }
    if (scope.mode === "delete") {
      const { error, count } = await admin
        .from(scope.table)
        .delete({ count: "exact" })
        .eq(col, value);
      report[scope.table] = error ? `error: ${error.message}` : `deleted ${count ?? 0} row(s)`;
      continue;
    }
    const scrub = { ...(scope.scrub ?? {}) };
    if (Object.keys(scrub).length === 0) {
      report[scope.table] = "retained (financial record, no direct identifiers)";
      continue;
    }
    const { error, count } = await admin
      .from(scope.table)
      .update(scrub, { count: "exact" })
      .eq(col, value);
    report[scope.table] = error ? `error: ${error.message}` : `anonymised ${count ?? 0} row(s)`;
  }
  return report;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "");

  const requireAdmin = async () => {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    const { data } = await admin.auth.getClaims(token);
    const uid = (data as { claims?: { sub?: string } } | null)?.claims?.sub;
    if (!uid) return null;
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    return isAdmin ? uid : null;
  };

  // ── submit ───────────────────────────────────────────────────────────────
  if (action === "submit") {
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
    const requestType = String(body.requestType ?? "access");
    const details = String(body.details ?? "").slice(0, 2000);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }
    if (!REQUEST_TYPES.has(requestType)) return json({ error: "Unknown request type." }, 400);

    const { count: openCount } = await admin
      .from("data_subject_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .in("status", ["pending_verification", "verified", "in_progress"]);
    if ((openCount ?? 0) >= 3) {
      return json({ error: "You already have requests in progress. We will respond shortly." }, 429);
    }

    const ipHash = await sha256Hex(
      `${(req.headers.get("x-forwarded-for") || "").split(",")[0].trim()}|dsar`,
    );
    const rawToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: row, error } = await admin
      .from("data_subject_requests")
      .insert({
        email,
        request_type: requestType,
        details,
        ip_hash: ipHash,
        verification_token_hash: await sha256Hex(rawToken),
      })
      .select("id")
      .maybeSingle();
    if (error || !row) {
      console.error("[data-subject-request] insert failed", error);
      return json({ error: "Your request could not be recorded. Please email " + PRIVACY_INBOX }, 500);
    }

    const link = `${SITE_URL}/privacy?dsar=${row.id}&token=${rawToken}`;
    await sendMail(
      [email],
      "Confirm your privacy request — Maison Affluency",
      `<p style="font-family:Georgia,serif;color:#1c1c1c">We received a <strong>${escapeHtml(requestType)}</strong> request for this email address.</p>
       <p style="font-family:Georgia,serif;color:#1c1c1c">To protect your data we only act once you confirm you control this address:</p>
       <p><a href="${link}" style="font-family:Helvetica,sans-serif;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#C5A880">Confirm my request</a></p>
       <p style="font-family:Georgia,serif;color:#6b6b6b;font-size:13px">If you did not make this request, ignore this message — nothing will happen.</p>`,
    );

    return json({ id: row.id, status: "pending_verification" });
  }

  // ── verify ───────────────────────────────────────────────────────────────
  if (action === "verify") {
    const id = String(body.id ?? "");
    const token = String(body.token ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id) || token.length < 32) {
      return json({ error: "Invalid confirmation link." }, 400);
    }
    const { data: row } = await admin
      .from("data_subject_requests")
      .select("id, email, request_type, status, verification_token_hash, due_at")
      .eq("id", id)
      .maybeSingle();
    if (!row) return json({ error: "Invalid confirmation link." }, 404);
    if (row.status !== "pending_verification") return json({ status: row.status, alreadyVerified: true });
    if (row.verification_token_hash !== (await sha256Hex(token))) {
      return json({ error: "Invalid confirmation link." }, 403);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", row.email)
      .maybeSingle();

    await admin
      .from("data_subject_requests")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verification_token_hash: null,
        user_id: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    await sendMail(
      OPS_RECIPIENTS,
      `Privacy request verified — ${row.request_type} (${row.email})`,
      `<p style="font-family:Helvetica,sans-serif">A data-subject <strong>${escapeHtml(row.request_type)}</strong> request has been verified.</p>
       <p style="font-family:Helvetica,sans-serif">Subject: ${escapeHtml(row.email)}<br/>Statutory deadline: ${escapeHtml(String(row.due_at))}</p>
       <p><a href="${SITE_URL}/trade/admin/privacy-requests">Open the privacy request queue</a></p>`,
    );

    return json({ status: "verified", due_at: row.due_at });
  }

  // ── admin actions ────────────────────────────────────────────────────────
  const adminId = await requireAdmin();
  if (!adminId) return json({ error: "Forbidden" }, 403);

  const id = String(body.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id must be a UUID" }, 400);
  const { data: request } = await admin
    .from("data_subject_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!request) return json({ error: "Request not found" }, 404);
  if (request.status === "pending_verification") {
    return json({ error: "The requester has not yet confirmed their email address." }, 409);
  }

  if (action === "export") {
    const payload = await collectExport(admin, request.email, request.user_id);
    await admin
      .from("data_subject_requests")
      .update({
        status: "fulfilled",
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return json({ status: "fulfilled", export: payload });
  }

  if (action === "erase") {
    const report = await runErasure(admin, request.email, request.user_id);
    await admin
      .from("data_subject_requests")
      .update({
        status: "fulfilled",
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: adminId,
        erased_tables: report,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    await sendMail(
      [request.email],
      "Your erasure request has been completed — Maison Affluency",
      `<p style="font-family:Georgia,serif;color:#1c1c1c">Your personal data has been erased or anonymised. Records we are legally required to keep (invoices, tax records and consent evidence) have been retained in a form that no longer identifies you commercially.</p>`,
    );
    return json({ status: "fulfilled", report });
  }

  if (action === "reject") {
    await admin
      .from("data_subject_requests")
      .update({
        status: "rejected",
        admin_notes: String(body.notes ?? "").slice(0, 2000),
        fulfilled_by: adminId,
        fulfilled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return json({ status: "rejected" });
  }

  return json({ error: "Unknown action" }, 400);
});
