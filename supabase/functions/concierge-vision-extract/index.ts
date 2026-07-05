// Standalone extraction endpoint: takes { imageUrl | pdfBase64, kind, userText? }
// and returns structured JSON. Reusable by the trade concierge, the client
// board upload flow, and any future upload UIs.
//
// Auth: requires an authenticated Supabase JWT (trade users only). No admin
// gate — signed-in trade principals may extract from their own uploads.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractFromMedia, toEmbeddingQuery, toStructuralFilter, type VisionKind } from "../_shared/visionExtract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KINDS: VisionKind[] = ["mood_board", "floor_plan", "product_photo", "tearsheet"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Require an authenticated caller — we don't want to burn credits for anons.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const claims = await supabase.auth.getClaims(token);
  if (!claims?.data?.claims?.sub) return json({ error: "Unauthorized" }, 401);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI gateway not configured" }, 500);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

  const kind = body.kind as VisionKind;
  if (!KINDS.includes(kind)) return json({ error: `kind must be one of ${KINDS.join(", ")}` }, 400);

  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;
  const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : undefined;
  const userText = typeof body.userText === "string" ? body.userText : undefined;

  if (!imageUrl && !pdfBase64) return json({ error: "Provide imageUrl or pdfBase64" }, 400);
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    return json({ error: "imageUrl must be an https URL" }, 400);
  }
  if (pdfBase64 && pdfBase64.length > 15_000_000) {
    return json({ error: "pdfBase64 too large (>10MB decoded)" }, 400);
  }

  const extracted = await extractFromMedia({ apiKey, kind, imageUrl, pdfBase64, userText });
  if (!extracted) {
    return json({ error: "Extraction failed", extracted: null }, 502);
  }

  return json({
    extracted,
    embeddingQuery: toEmbeddingQuery(extracted, userText),
    structuralFilter: toStructuralFilter(extracted),
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
