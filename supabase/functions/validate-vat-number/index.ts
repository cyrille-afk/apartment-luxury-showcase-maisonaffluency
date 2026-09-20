// Public checkout endpoint for real-time VAT / GST registration validation.
// All routing and provider logic lives in _shared/vatValidation.ts so the
// payment functions can re-run the exact same check server-side.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { verifyVatNumber } from "../_shared/vatValidation.ts";

const BodySchema = z.object({
  taxId: z.string().trim().min(4).max(32),
  country: z.string().trim().length(2).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors, valid: false }, 400);
  }

  return json(await verifyVatNumber(parsed.data.taxId, parsed.data.country));
});
