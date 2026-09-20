/**
 * Wholesale pricing gateway.
 *
 * Trade pricing is proprietary, so it is no longer read straight from the
 * table by the browser. Every authenticated request passes through a
 * service-role rate limiter: an unnatural cadence (pricing scraping or
 * inventory harvesting) flags the account profile and returns 429.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { CATALOG_RATE_LIMIT, CATALOG_RATE_WINDOW_SECONDS } from "../_shared/tradeGuardrails.ts";

const PRICING_COLUMNS =
  "id, source_pick_id, slug, rrp_price_cents, trade_price_cents, currency, price_unit, price_prefix, lead_time_weeks, lead_time_label, size_variants, stock_status_override, is_allocation_restricted, allocation_unit_cap, available_stock_units";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, private" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required." }, 401);

    const { data: claimsData, error: claimsError } = await admin.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Authentication required." }, 401);

    const body = await req.json().catch(() => ({}));
    const pickIds = Array.from(
      new Set(
        (Array.isArray(body?.pickIds) ? body.pickIds : [])
          .map((v: unknown) => String(v || "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 100);
    if (!pickIds.length) return json({ error: "No products requested." }, 400);

    // Rate limit before touching pricing data.
    const { data: limit, error: limitError } = await admin.rpc("enforce_trade_catalog_rate_limit", {
      _actor: userId,
      _endpoint: "trade/catalog/pricing",
      _limit: CATALOG_RATE_LIMIT,
      _window_seconds: CATALOG_RATE_WINDOW_SECONDS,
    });
    if (limitError) console.error("[trade-catalog-pricing] rate limit check failed", limitError);
    if ((limit as { allowed?: boolean } | null)?.allowed === false) {
      return new Response(
        JSON.stringify({
          error: "Too many pricing requests. Your account has been flagged for review.",
          code: "rate_limited",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(CATALOG_RATE_WINDOW_SECONDS),
            "Cache-Control": "no-store, private",
          },
        },
      );
    }

    const { data, error } = await admin
      .from("trade_products")
      .select(PRICING_COLUMNS)
      .eq("is_active", true)
      .or(pickIds.map((id) => `source_pick_id.eq.${id},id.eq.${id}`).join(","));
    if (error) {
      console.error("[trade-catalog-pricing] lookup failed", error);
      return json({ error: "Unable to load pricing." }, 500);
    }

    return json({ products: data ?? [] });
  } catch (err) {
    console.error("[trade-catalog-pricing] error", err);
    return json({ error: "An unexpected error occurred." }, 500);
  }
});
