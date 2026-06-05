// Parse a user-uploaded floor plan stored in the cad-uploads bucket.
// Triggered after upload by the /trade/spatial-fit page.
// Body: { cad_document_id: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser } from "../_shared/auth.ts";
import { parseCadFile } from "../_shared/cadParse.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireUser(req, "cad-parse-upload");
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: { cad_document_id?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const docId = payload.cad_document_id;
  if (!docId || typeof docId !== "string") {
    return new Response(JSON.stringify({ error: "cad_document_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verify caller can see the doc via RLS by using a user-scoped client
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth.authHeader } } },
  );
  const { data: doc, error: docErr } = await userClient
    .from("cad_documents")
    .select("id, file_path, format, status")
    .eq("id", docId)
    .maybeSingle();
  if (docErr || !doc) {
    return new Response(JSON.stringify({ error: "Document not found or access denied" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await svc.from("cad_documents").update({ status: "parsing", error: null }).eq("id", docId);

  // Download the file via service role (bypasses storage RLS — we already verified RLS access above)
  const { data: file, error: dlErr } = await svc.storage.from("cad-uploads").download(doc.file_path);
  if (dlErr || !file) {
    const msg = dlErr?.message || "Download failed";
    await svc.from("cad_documents").update({ status: "failed", error: msg }).eq("id", docId);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bytes = await file.arrayBuffer();
  const result = await parseCadFile(bytes, doc.format);

  if (!result.ok) {
    await svc.from("cad_documents").update({
      status: result.unsupported ? "unsupported" : "failed",
      error: result.error,
      parsed_at: new Date().toISOString(),
    }).eq("id", docId);
    return new Response(JSON.stringify({ ok: false, unsupported: !!result.unsupported, error: result.error }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await svc.from("cad_documents").update({
    status: "ready",
    parsed_geometry: result.geometry,
    error: null,
    parsed_at: new Date().toISOString(),
  }).eq("id", docId);

  return new Response(JSON.stringify({ ok: true, geometry: result.geometry }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
