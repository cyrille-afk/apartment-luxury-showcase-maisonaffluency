// One-off maintenance job: moves legacy trade-only objects out of the PUBLIC
// `assets` bucket into the PRIVATE `trade-private` bucket, and rewrites any
// stored public URLs to long-lived signed URLs.
// Authorised with the MIGRATE_UPLOADS_SECRET shared secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-migrate-secret",
};

const FOLDERS = [
  "axonometric-sources",
  "axonometric-submissions",
  "proposal-externals",
];

const TTL = 60 * 60 * 24 * 365 * 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = Deno.env.get("MIGRATE_UPLOADS_SECRET");
  if (!secret || req.headers.get("x-migrate-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      const { data, error } = await sb.storage.from("assets").list(prefix, { limit: 1000, offset });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) out.push(...await listAll(path));
        else out.push(path);
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
    return out;
  }

  try {
    const moved: { path: string; signedUrl: string }[] = [];
    const failed: { path: string; error: string }[] = [];

    for (const folder of FOLDERS) {
      const paths = await listAll(folder);
      for (const path of paths) {
        try {
          const { data: file, error: dlErr } = await sb.storage.from("assets").download(path);
          if (dlErr || !file) throw dlErr ?? new Error("download failed");
          const { error: upErr } = await sb.storage
            .from("trade-private")
            .upload(path, await file.arrayBuffer(), {
              contentType: file.type || "application/octet-stream",
              upsert: true,
            });
          if (upErr) throw upErr;
          const { data: signed, error: signErr } = await sb.storage
            .from("trade-private")
            .createSignedUrl(path, TTL);
          if (signErr || !signed?.signedUrl) throw signErr ?? new Error("sign failed");
          const { error: rmErr } = await sb.storage.from("assets").remove([path]);
          if (rmErr) throw rmErr;
          moved.push({ path, signedUrl: signed.signedUrl });
        } catch (e) {
          failed.push({ path, error: (e as Error).message });
        }
      }
    }

    // Rewrite stored references from the old public URL to the signed URL.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    let rewritten = 0;
    for (const { path, signedUrl } of moved) {
      const oldUrl = `${supabaseUrl}/storage/v1/object/public/assets/${path}`;
      for (const [table, column] of [
        ["axonometric_requests", "image_url"],
        ["axonometric_requests", "result_image_url"],
        ["axonometric_gallery", "image_url"],
      ] as const) {
        const { data, error } = await sb
          .from(table)
          .update({ [column]: signedUrl })
          .eq(column, oldUrl)
          .select("id");
        if (!error && data) rewritten += data.length;
      }
    }

    const report = { ok: true, moved: moved.length, failed, rewritten };
    console.log("[migrate-private-uploads]", JSON.stringify(report));
    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[migrate-private-uploads] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
