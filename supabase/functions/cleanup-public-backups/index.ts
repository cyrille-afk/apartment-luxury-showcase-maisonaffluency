// One-off admin cleanup: removes any legacy `assets/backups/*` objects
// that were created before backups moved to the private `backups` bucket.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  async function listAll(prefix: string): Promise<string[]> {
    const out: string[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await sb.storage.from("assets").list(prefix, {
        limit: 1000, offset,
      });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        // Folders have id === null
        if (item.id === null) out.push(...await listAll(path));
        else out.push(path);
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
    return out;
  }

  try {
    const files = await listAll("backups");
    let removed = 0;
    for (let i = 0; i < files.length; i += 100) {
      const batch = files.slice(i, i + 100);
      const { error } = await sb.storage.from("assets").remove(batch);
      if (error) throw error;
      removed += batch.length;
    }
    return new Response(JSON.stringify({ ok: true, removed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
