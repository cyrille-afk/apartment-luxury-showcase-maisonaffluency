import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUOTE_PDF_BUCKET = "quote-pdfs";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonError("Method not allowed", 405);

  const token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
  if (!UUID_PATTERN.test(token)) return jsonError("This quote link is invalid", 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonError("Download service unavailable", 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: quote, error: quoteError } = await supabase
    .from("trade_quotes")
    .select("client_pdf_path, quote_number")
    .eq("client_pdf_download_token", token)
    .maybeSingle();

  if (quoteError) {
    console.error("Quote PDF lookup failed", quoteError.message);
    return jsonError("The formal quote could not be opened", 500);
  }
  if (!quote?.client_pdf_path) return jsonError("The formal quote is unavailable", 404);

  const filename = `${String(quote.quote_number ?? "Maison-Affluency-Quote")}.pdf`
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
  const { data, error } = await supabase.storage
    .from(QUOTE_PDF_BUCKET)
    .createSignedUrl(quote.client_pdf_path, 60, { download: filename });

  if (error || !data?.signedUrl) {
    console.error("Quote PDF signing failed", error?.message ?? "No signed URL returned");
    return jsonError("The formal quote could not be downloaded", 500);
  }

  return Response.redirect(data.signedUrl, 302);
});