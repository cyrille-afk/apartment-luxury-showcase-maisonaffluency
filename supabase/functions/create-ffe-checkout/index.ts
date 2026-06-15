import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseAnon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabaseAnon.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    const userEmail = claims?.claims?.email;
    if (!userId) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // 1) verify ≥ 6 favorites
    const { count } = await supabaseAdmin.from("trade_favorites").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if ((count || 0) < 6) {
      return new Response(JSON.stringify({ error: "You need at least 6 favorites to unlock the FF&E tool." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) skip if already paid
    const { data: existing } = await supabaseAdmin.from("ffe_entitlements").select("id, status").eq("user_id", userId).eq("status", "paid").maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "You already have access to the FF&E tool." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    // Find or create customer
    let customerId: string | undefined;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length) customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://apartment-luxury-showcase-maisonaffluency.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "Floor Plan → FF&E Tool — Unlock",
            description: "Fully credited toward your next trade quote.",
          },
          unit_amount: 10000,
        },
        quantity: 1,
      }],
      success_url: `${origin}/trade/me?ffe=success`,
      cancel_url: `${origin}/trade/me?ffe=cancelled`,
      metadata: {
        payment_type: "ffe_unlock",
        user_id: userId,
      },
    });

    // Record pending entitlement
    await supabaseAdmin.from("ffe_entitlements").insert({
      user_id: userId,
      stripe_session_id: session.id,
      amount_cents: 10000,
      currency: "usd",
      status: "pending",
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (err: any) {
    console.error("create-ffe-checkout error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
