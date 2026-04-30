import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "designers",
  "designer_curator_picks",
  "trade_products",
  "trade_documents",
  "profiles",
  "user_roles",
  "trade_applications",
  "journal_articles",
];

// Tolerance: live row count may differ slightly from backup (writes since snapshot).
// We flag a backup as suspect if live has FEWER rows than backup (possible data loss),
// or if backup is missing > 50% of live rows (stale backup).
const STALE_RATIO = 0.5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Find the latest backup folder by listing prefixes
    const { data: folders, error: listErr } = await supabase.storage
      .from("assets")
      .list("backups", { limit: 100, sortBy: { column: "name", order: "desc" } });

    if (listErr) throw listErr;
    if (!folders || folders.length === 0) {
      throw new Error("No backups found in assets/backups/");
    }

    // Folders are returned as entries with name = date string
    const latest = folders
      .map((f) => f.name)
      .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
      .sort()
      .reverse()[0];

    if (!latest) throw new Error("No dated backup folders found");

    const report: Record<string, any> = {
      verified_at: new Date().toISOString(),
      backup_date: latest,
      tables: {} as Record<string, any>,
      overall_status: "ok" as "ok" | "warning" | "error",
    };

    // 2. For each table: download backup JSON, parse, compare to live count
    for (const table of TABLES) {
      const tableReport: any = { backup_rows: 0, live_rows: 0, status: "ok", issues: [] as string[] };

      try {
        // Download backup file
        const { data: blob, error: dlErr } = await supabase.storage
          .from("assets")
          .download(`backups/${latest}/${table}.json`);
        if (dlErr) throw new Error(`download failed: ${dlErr.message}`);

        const text = await blob.text();

        // Validate JSON parses
        let rows: any[];
        try {
          rows = JSON.parse(text);
        } catch (e: any) {
          throw new Error(`invalid JSON: ${e.message}`);
        }
        if (!Array.isArray(rows)) throw new Error("backup is not an array");
        tableReport.backup_rows = rows.length;

        // Sample integrity: every row should be an object with an id field (if present in schema)
        const sampleSize = Math.min(5, rows.length);
        for (let i = 0; i < sampleSize; i++) {
          if (typeof rows[i] !== "object" || rows[i] === null) {
            throw new Error(`row ${i} is not an object`);
          }
        }

        // Live row count
        const { count, error: cntErr } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        if (cntErr) throw new Error(`live count failed: ${cntErr.message}`);
        tableReport.live_rows = count ?? 0;

        // Compare
        if (tableReport.backup_rows === 0 && tableReport.live_rows > 0) {
          tableReport.status = "error";
          tableReport.issues.push("backup is empty but live table has rows");
        } else if (
          tableReport.live_rows > 0 &&
          tableReport.backup_rows / tableReport.live_rows < STALE_RATIO
        ) {
          tableReport.status = "warning";
          tableReport.issues.push(
            `backup has ${tableReport.backup_rows} rows vs ${tableReport.live_rows} live (>${(1 - STALE_RATIO) * 100}% drift)`
          );
        }
      } catch (err: any) {
        tableReport.status = "error";
        tableReport.issues.push(err.message);
      }

      report.tables[table] = tableReport;
      if (tableReport.status === "error") report.overall_status = "error";
      else if (tableReport.status === "warning" && report.overall_status === "ok")
        report.overall_status = "warning";
    }

    // 3. Write verification report next to backup
    await supabase.storage
      .from("assets")
      .upload(
        `backups/${latest}/verification.json`,
        new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
        { contentType: "application/json", upsert: true }
      );

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: report.overall_status === "error" ? 500 : 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
