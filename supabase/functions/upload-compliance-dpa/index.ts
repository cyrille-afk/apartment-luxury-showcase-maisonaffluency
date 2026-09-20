// Secure intake for counter-signed sub-processor DPAs.
//
// The browser never writes to the private `compliance-agreements` bucket.
// Every file passes through here so that, before a byte is stored:
//   1. the caller is proven to be an administrator / compliance officer,
//   2. the binary signature is authenticated (genuine PDF only, no polyglots),
//   3. a SHA-256 fingerprint is computed for the audit trail,
//   4. the object is written under a structured `dpa_<vendor>_<ts>.pdf` name.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireAdmin } from "../_shared/auth.ts";
import { sha256Hex, verifyFileSignature } from "../_shared/fileSignature.ts";
import { isBlockingVerdict, scanActiveContent } from "../_shared/activeContentScan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "compliance-agreements";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const decodeBase64 = (value: string): Uint8Array => {
  const raw = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireAdmin(req, "upload-compliance-dpa");
  if (!auth.ok) return json(auth.body, auth.status);

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const vendorId = String(payload.vendorId ?? "").trim();
  const fileName = String(payload.fileName ?? "agreement.pdf").slice(0, 180);
  const base64 = typeof payload.fileBase64 === "string" ? payload.fileBase64 : "";

  if (!/^[0-9a-f-]{36}$/i.test(vendorId)) return json({ error: "Unknown vendor." }, 400);
  if (!base64) return json({ error: "No document was received." }, 400);

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(base64);
  } catch {
    return json({ error: "The document could not be read." }, 400);
  }

  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: "The agreement exceeds the 10 MB limit." }, 413);
  }

  const verdict = verifyFileSignature(bytes, fileName, "application/pdf");
  if (!verdict.ok) return json({ error: verdict.reason }, 400);
  if (verdict.mime !== "application/pdf") {
    return json({ error: "Only PDF agreements are accepted." }, 400);
  }

  const scan = scanActiveContent(bytes, verdict.mime);
  if (isBlockingVerdict(scan)) {
    return json(
      { error: "Rejected: the PDF carries active content (JavaScript or embedded actions)." },
      400,
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: vendor, error: vendorErr } = await admin
    .from("sub_processor_registry")
    .select("id, vendor_name, signed_dpa_path")
    .eq("id", vendorId)
    .maybeSingle();
  if (vendorErr || !vendor) return json({ error: "Unknown vendor." }, 404);

  const hash = await sha256Hex(bytes);
  const path = `dpa_${vendorId}_${Date.now()}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadErr) return json({ error: `Storage rejected the file: ${uploadErr.message}` }, 500);

  const { error: updateErr } = await admin
    .from("sub_processor_registry")
    .update({
      signed_dpa_path: path,
      signed_dpa_filename: fileName,
      signed_dpa_sha256: hash,
      signed_dpa_size_bytes: bytes.byteLength,
      signed_dpa_uploaded_at: new Date().toISOString(),
      signed_dpa_uploaded_by: auth.userId,
    })
    .eq("id", vendorId);
  if (updateErr) {
    await admin.storage.from(BUCKET).remove([path]);
    return json({ error: updateErr.message }, 500);
  }

  // Supersede the previous revision once the new one is recorded.
  if (vendor.signed_dpa_path && vendor.signed_dpa_path !== path) {
    await admin.storage.from(BUCKET).remove([vendor.signed_dpa_path]);
  }

  return json({
    ok: true,
    path,
    sha256: hash,
    sizeBytes: bytes.byteLength,
    fileName,
  });
});
