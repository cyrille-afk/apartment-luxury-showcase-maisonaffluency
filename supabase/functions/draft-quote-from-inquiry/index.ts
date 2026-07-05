import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  inquiryId: z.string().uuid(),
  quoteKind: z.enum(["public", "trade"]),
  quantity: z.number().int().positive().max(999).optional().default(1),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require an authenticated caller and verify admin role.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Not authenticated" }, 401);
    }
    const token = authHeader.slice(7);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Invalid session" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return json({ error: "Admin role required" }, 403);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { inquiryId, quoteKind, quantity } = parsed.data;

    // Load inquiry
    const { data: inquiry, error: inqErr } = await supabase
      .from("inquiries")
      .select("*")
      .eq("id", inquiryId)
      .single();
    if (inqErr || !inquiry) return json({ error: "Inquiry not found" }, 404);

    if (inquiry.linked_quote_id) {
      return json({ quoteId: inquiry.linked_quote_id, reused: true }, 200);
    }

    // Look up product (may be null if inquiry has no product)
    let product: any = null;
    if (inquiry.product_id) {
      const { data } = await supabase
        .from("trade_products")
        .select("id, name, retail_price_cents, trade_price_cents, currency")
        .eq("id", inquiry.product_id)
        .maybeSingle();
      product = data;
    }

    // Create draft quote
    const currency = product?.currency || "USD";
    const { data: quote, error: quoteErr } = await supabase
      .from("trade_quotes")
      .insert({
        user_id: userId,
        status: "draft",
        quote_kind: quoteKind,
        source_inquiry_id: inquiry.id,
        client_name: inquiry.name,
        currency,
        notes: `Auto-drafted from inquiry ${inquiry.id}. Visitor: ${inquiry.name} <${inquiry.email}>${inquiry.phone ? ` · ${inquiry.phone}` : ""}${inquiry.company ? ` · ${inquiry.company}` : ""}\n\nOriginal message:\n${inquiry.message}`,
        admin_notes: inquiry.admin_notes || null,
      })
      .select("id")
      .single();
    if (quoteErr || !quote) {
      console.error("Quote insert failed:", quoteErr);
      return json({ error: "Could not create quote" }, 500);
    }

    // Add line item when a product was matched
    if (product) {
      const unitPrice = quoteKind === "public"
        ? product.retail_price_cents
        : (product.trade_price_cents || product.retail_price_cents);

      const { error: itemErr } = await supabase.from("trade_quote_items").insert({
        quote_id: quote.id,
        product_id: product.id,
        quantity,
        unit_price_cents: unitPrice || null,
      });
      if (itemErr) console.error("Quote item insert failed:", itemErr);
    }

    // Link back on inquiry + advance status
    const { error: updErr } = await supabase
      .from("inquiries")
      .update({
        linked_quote_id: quote.id,
        status: "quote_drafted",
        assigned_admin_id: userId,
      })
      .eq("id", inquiry.id);
    if (updErr) console.error("Inquiry link failed:", updErr);

    return json({ quoteId: quote.id, reused: false }, 200);
  } catch (err) {
    console.error("draft-quote-from-inquiry error:", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
