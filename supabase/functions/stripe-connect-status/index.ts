// Polls Stripe for the current status of a studio payout account's Connect
// Express account and mirrors it onto studio_payout_accounts.stripe_connect_status.
// Status values: not_started | pending | restricted | active

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) throw new Error("Not authenticated");
    const userId = claims.claims.sub as string;

    const { account_id } = await req.json();
    if (!account_id) throw new Error("account_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: account } = await supabase
      .from("studio_payout_accounts")
      .select("id, studio_id, stripe_connect_account_id")
      .eq("id", account_id)
      .single();
    if (!account) throw new Error("Payout account not found");

    const { data: member } = await supabase
      .from("studio_members")
      .select("role")
      .eq("studio_id", account.studio_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) throw new Error("Not a studio member");

    if (!account.stripe_connect_account_id) {
      return new Response(JSON.stringify({ status: "not_started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const acct = await stripe.accounts.retrieve(account.stripe_connect_account_id);

    let status: "not_started" | "pending" | "restricted" | "active" = "pending";
    if (acct.charges_enabled && acct.payouts_enabled && acct.details_submitted) {
      status = "active";
    } else if (acct.requirements?.disabled_reason) {
      status = "restricted";
    } else if (acct.details_submitted) {
      status = "pending";
    } else {
      status = "pending";
    }

    await supabase
      .from("studio_payout_accounts")
      .update({ stripe_connect_status: status })
      .eq("id", account.id);

    return new Response(JSON.stringify({ status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
