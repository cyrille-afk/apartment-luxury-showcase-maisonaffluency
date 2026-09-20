// GDPR retention job for Trade Program credential documents.
//
// Passports, trade licences and accreditation certificates are special-category
// identity evidence. When a human administrator rejects an application we keep
// the file only long enough to answer an appeal — a strict 14-day window — then
// the binary is deleted from storage and the row is soft-deleted, leaving the
// audit trail (hash, decision, reviewer) but not the document itself.
//
// Scheduled daily by pg_cron. Idempotent: already-purged rows are skipped.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RETENTION_DAYS = 14;
const BATCH = 200;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  const authorised =
    (cronSecret && req.headers.get("x-cron-secret") === cronSecret) ||
    auth === `Bearer ${serviceKey}`;
  if (!authorised) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false },
  });

  const now = Date.now();
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Rejected applications whose review happened more than 14 days ago and
  // whose document has not been purged yet.
  const { data: due, error } = await admin
    .from("trade_applications")
    .select("id, credential_document_path, reviewed_at")
    .eq("status", "rejected")
    .not("credential_document_path", "is", null)
    .is("credential_deleted_at", null)
    .lte("reviewed_at", cutoff)
    .limit(BATCH);

  if (error) return json({ error: error.message }, 500);

  let purged = 0;
  const failures: string[] = [];

  for (const row of due ?? []) {
    const path = row.credential_document_path as string;
    const { error: rmErr } = await admin.storage.from("trade-credentials").remove([path]);
    // A missing object is an acceptable outcome — the goal is absence.
    if (rmErr && !/not found/i.test(rmErr.message)) {
      failures.push(`${row.id}: ${rmErr.message}`);
      continue;
    }

    const deletedAt = new Date().toISOString();
    await admin
      .from("trade_applications")
      .update({
        credential_deleted_at: deletedAt,
        // The path is cleared so no part of the app can offer a download.
        credential_document_path: null,
      })
      .eq("id", row.id);

    await admin
      .from("trade_credential_documents")
      .update({ deleted_at: deletedAt })
      .eq("storage_path", path)
      .is("deleted_at", null);

    await admin.from("verification_audit_log").insert({
      application_id: row.id,
      event: "credential_purged",
      actor: "system",
      outcome: "rejected",
      reasoning: `Credential document deleted after the ${RETENTION_DAYS}-day post-rejection retention window.`,
      details: { storage_path: path, retention_days: RETENTION_DAYS },
    });

    purged++;
  }

  return json({ ok: failures.length === 0, purged, considered: due?.length ?? 0, failures });
});
