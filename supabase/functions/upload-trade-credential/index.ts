// Hardened intake for Trade Program credential documents.
//
// The browser no longer writes to the `trade-credentials` bucket directly.
// Every file passes through here so that, before a single byte is stored:
//   1. the binary signature is authenticated (real PDF / PNG / JPEG only),
//   2. the applicant's IP and email domain are rate limited,
//   3. a SHA-256 hash is computed and cross-checked against every credential
//      ever submitted, so a recycled document is flagged as a fraud risk.
//
// Nothing here grants any privilege: the upload only produces a storage path
// and a hash that a human reviewer later acts on.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sha256Hex, verifyFileSignature } from "../_shared/fileSignature.ts";
import { isBlockingVerdict, scanActiveContent } from "../_shared/activeContentScan.ts";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_IP = 6;
const MAX_PER_DOMAIN = 10;
// Free-mail domains are shared by thousands of genuine applicants, so the
// domain quota only applies to corporate domains.
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "proton.me",
  "protonmail.com", "qq.com", "163.com", "aol.com", "gmx.com", "mail.com",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hashText = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const clientIp = (req: Request) =>
  (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
  req.headers.get("cf-connecting-ip") ||
  req.headers.get("x-real-ip") ||
  "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const fileName = String(payload.fileName ?? "").slice(0, 180);
  const declaredMime = String(payload.contentType ?? "").slice(0, 100);
  const email = String(payload.email ?? "").trim().toLowerCase().slice(0, 254);
  const emailDomain = email.includes("@") ? email.split("@").pop()! : null;
  const base64 = typeof payload.fileBase64 === "string" ? payload.fileBase64 : "";

  const ipHash = await hashText(`${clientIp(req)}|trade-credential`);
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

  const logAttempt = (accepted: boolean, reason: string | null) =>
    admin
      .from("trade_upload_attempts")
      .insert({ ip_hash: ipHash, email_domain: emailDomain, accepted, reason })
      .then(() => undefined, () => undefined);

  if (!base64) {
    await logAttempt(false, "missing_file");
    return json({ error: "No document was received." }, 400);
  }

  // ── Rate limit: per IP always, per corporate domain as well ──────────────
  const [{ count: ipCount }, domainRes] = await Promise.all([
    admin
      .from("trade_upload_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since),
    emailDomain && !PERSONAL_DOMAINS.has(emailDomain)
      ? admin
          .from("trade_upload_attempts")
          .select("id", { count: "exact", head: true })
          .eq("email_domain", emailDomain)
          .gte("created_at", since)
      : Promise.resolve({ count: 0 } as { count: number }),
  ]);

  if ((ipCount ?? 0) >= MAX_PER_IP || ((domainRes as { count: number | null }).count ?? 0) >= MAX_PER_DOMAIN) {
    await logAttempt(false, "rate_limited");
    return json(
      { error: "Too many document uploads from this connection. Please try again later." },
      429,
    );
  }

  // ── Decode ────────────────────────────────────────────────────────────────
  let bytes: Uint8Array;
  try {
    const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
    const bin = atob(clean);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    await logAttempt(false, "undecodable");
    return json({ error: "The document could not be read. Please re-attach it." }, 400);
  }

  if (bytes.length > MAX_BYTES) {
    await logAttempt(false, "too_large");
    return json({ error: "Documents must be 15 MB or smaller." }, 413);
  }

  // ── Magic-byte authentication ────────────────────────────────────────────
  const verdict = verifyFileSignature(bytes, fileName, declaredMime);
  if (!verdict.ok) {
    await logAttempt(false, "signature_rejected");
    return json({ error: verdict.reason }, 415);
  }

  // ── Active-content screening ─────────────────────────────────────────────
  // A structurally valid PDF can still run JavaScript, fire an /OpenAction or
  // carry an embedded payload the moment a reviewer opens it. Weaponised
  // documents are refused outright; anything unscannable or merely suspicious
  // is stored in quarantine so nobody downloads it before a decision.
  const scan = scanActiveContent(bytes, verdict.mime);
  if (isBlockingVerdict(scan)) {
    await logAttempt(false, `active_content:${scan.flags.join(",")}`);
    return json(
      {
        error:
          "This document contains active content (scripts or embedded files) and cannot be accepted. Please upload a flattened PDF or an image export.",
        flags: scan.flags,
      },
      415,
    );
  }

  // ── Duplicate / recycled document heuristic ──────────────────────────────
  const sha256 = await sha256Hex(bytes);
  const { data: priorRows } = await admin
    .from("trade_credential_documents")
    .select("id, application_id, user_id, email_domain, created_at")
    .eq("sha256", sha256)
    .order("created_at", { ascending: true })
    .limit(1);
  const prior = priorRows?.[0] ?? null;

  const ext = verdict.mime === "application/pdf" ? "pdf" : verdict.mime === "image/png" ? "png" : "jpg";
  const path = `anon/${crypto.randomUUID()}/credential-${Date.now()}.${ext}`;

  const { error: upErr } = await admin.storage
    .from("trade-credentials")
    .upload(path, bytes, { contentType: verdict.mime, upsert: false });
  if (upErr) {
    console.error("[upload-trade-credential] storage upload failed", upErr);
    await logAttempt(false, "storage_error");
    return json({ error: "Your document could not be stored. Please try again." }, 500);
  }

  const { data: logRow } = await admin
    .from("trade_credential_documents")
    .insert({
      sha256,
      storage_path: path,
      mime_type: verdict.mime,
      byte_size: bytes.length,
      email_domain: emailDomain,
      ip_hash: ipHash,
      duplicate_of: prior?.id ?? null,
      active_content_flags: scan.flags,
      quarantined: scan.severity !== "clean",
      scan_verdict: { severity: scan.severity, reasons: scan.reasons },
    })
    .select("id")
    .maybeSingle();

  await logAttempt(true, prior ? "duplicate_hash" : null);

  return json({
    path,
    sha256,
    documentId: logRow?.id ?? null,
    mimeType: verdict.mime,
    // A recycled binary never blocks the applicant here — it travels with the
    // application so verification can flag it and route it to a human.
    duplicate: !!prior,
    duplicateOf: prior?.id ?? null,
    signatureNote: verdict.note || null,
  });
});
