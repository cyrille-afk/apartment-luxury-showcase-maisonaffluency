import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const timestamp = new Date().toISOString().split("T")[0];
    const tables = [
      "designers",
      "designer_curator_picks",
      "trade_products",
      "trade_documents",
      "profiles",
      "user_roles",
      "trade_applications",
      "journal_articles",
    ];

    const results: Record<string, { rows: number; status: string }> = {};

    for (const table of tables) {
      try {
        // Fetch all rows (paginated to handle >1000)
        let allRows: any[] = [];
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
        const filePath = `backups/${timestamp}/${table}.json`;

        const { error: uploadError } = await supabase.storage
          .from("assets")
          .upload(filePath, new Blob([jsonContent], { type: "application/json" }), {
            contentType: "application/json",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        results[table] = { rows: allRows.length, status: "ok" };
      } catch (err: any) {
        results[table] = { rows: 0, status: `error: ${err.message}` };
      }
    }

    // Write a manifest
    const manifest = {
      backup_date: new Date().toISOString(),
      tables: results,
    };
    await supabase.storage
      .from("assets")
      .upload(
        `backups/${timestamp}/manifest.json`,
        new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
        { contentType: "application/json", upsert: true }
      );

    return new Response(JSON.stringify(manifest), {
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
