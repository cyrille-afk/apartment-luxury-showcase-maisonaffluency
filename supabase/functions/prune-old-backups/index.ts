import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Defaults — overridable via POST body { retention_days, min_keep }
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MIN_KEEP = 7; // always keep at least the N most recent backups, even if older

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let retentionDays = DEFAULT_RETENTION_DAYS;
    let minKeep = DEFAULT_MIN_KEEP;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.retention_days === "number" && body.retention_days > 0)
          retentionDays = Math.floor(body.retention_days);
        if (typeof body?.min_keep === "number" && body.min_keep >= 0)
          minKeep = Math.floor(body.min_keep);
      } catch {
        /* no body, use defaults */
      }
    }

    // 1. List backup folders
    const { data: folders, error: listErr } = await supabase.storage
      .from("assets")
      .list("backups", { limit: 1000, sortBy: { column: "name", order: "desc" } });
    if (listErr) throw listErr;

    const dated = (folders || [])
      .map((f) => f.name)
      .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
      .sort()
      .reverse(); // newest first

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const kept: string[] = [];
    const toDelete: string[] = [];

    dated.forEach((folder, idx) => {
      // Always keep the N most recent backups regardless of age
      if (idx < minKeep) {
        kept.push(folder);
        return;
      }
      if (folder >= cutoffStr) {
        kept.push(folder);
      } else {
        toDelete.push(folder);
      }
    });

    // 2. Delete each old folder's contents
    const deleted: Record<string, { files: number; status: string }> = {};
    for (const folder of toDelete) {
      try {
        const { data: files, error: lErr } = await supabase.storage
          .from("assets")
          .list(`backups/${folder}`, { limit: 100 });
        if (lErr) throw lErr;
        const paths = (files || []).map((f) => `backups/${folder}/${f.name}`);
        if (paths.length === 0) {
          deleted[folder] = { files: 0, status: "empty" };
          continue;
        }
        const { error: dErr } = await supabase.storage.from("assets").remove(paths);
        if (dErr) throw dErr;
        deleted[folder] = { files: paths.length, status: "ok" };
      } catch (err: any) {
        deleted[folder] = { files: 0, status: `error: ${err.message}` };
      }
    }

    const report = {
      pruned_at: new Date().toISOString(),
      retention_days: retentionDays,
      min_keep: minKeep,
      cutoff_date: cutoffStr,
      total_backups_found: dated.length,
      kept: kept.length,
      kept_folders: kept,
      deleted_count: Object.keys(deleted).length,
      deleted,
    };

    // Write a prune log alongside the most recent backup (for traceability)
    if (kept[0]) {
      await supabase.storage
        .from("assets")
        .upload(
          `backups/${kept[0]}/prune-log-${Date.now()}.json`,
          new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
          { contentType: "application/json", upsert: true }
        );
    }

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
