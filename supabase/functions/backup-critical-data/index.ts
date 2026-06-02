import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Whitelist of tables eligible for backup. Each cron invocation backs up exactly ONE
// table (passed via request body), so we stay well under the edge-function
// memory/CPU limits that caused WORKER_RESOURCE_LIMIT when dumping all tables
// in a single call.
const ALLOWED_TABLES = new Set([
  "designers",
  "designer_curator_picks",
  "trade_products",
  "trade_documents",
  "profiles",
  "user_roles",
  "trade_applications",
  "journal_articles",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Allow service-role bearer (used by pg_cron) to bypass admin user check.
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (bearer !== serviceKey) {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return new Response(JSON.stringify(auth.body), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    // Parse body
    let table: string | null = null;
    let dateOverride: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.table === "string") table = body.table;
        if (typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
          dateOverride = body.date;
        }
      } catch {
        /* no body */
      }
    }

    if (!table || !ALLOWED_TABLES.has(table)) {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid `table` in body",
          allowed: Array.from(ALLOWED_TABLES),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const timestamp = dateOverride ?? new Date().toISOString().split("T")[0];

    // Paginate through the table
    let allRows: unknown[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allRows = allRows.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const jsonContent = JSON.stringify(allRows, null, 2);
    const filePath = `${timestamp}/${table}.json`;

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(filePath, new Blob([jsonContent], { type: "application/json" }), {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Per-table status sidecar (helps verifier and debugging)
    const status = {
      table,
      backup_date: timestamp,
      rows: allRows.length,
      bytes: jsonContent.length,
      completed_at: new Date().toISOString(),
      status: "ok" as const,
    };
    await supabase.storage
      .from("backups")
      .upload(
        `${timestamp}/${table}.status.json`,
        new Blob([JSON.stringify(status, null, 2)], { type: "application/json" }),
        { contentType: "application/json", upsert: true },
      );

    return new Response(JSON.stringify(status), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
