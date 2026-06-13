// Creates or refreshes a Stripe Connect Express account for a studio payout
// account row and returns an onboarding link. The frontend opens the link in
// a new tab; on return we re-poll the account to update status.

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
    const userEmail = (claims.claims.email as string) ?? "";

    const { account_id, return_path } = await req.json();
    if (!account_id) throw new Error("account_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Load account + verify caller is a studio admin/owner
    const { data: account, error: accErr } = await supabase
      .from("studio_payout_accounts")
      .select("*, studios!inner(id)")
      .eq("id", account_id)
      .single();
    if (accErr || !account) throw new Error("Payout account not found");

    const { data: member } = await supabase
      .from("studio_members")
      .select("role")
      .eq("studio_id", account.studio_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) {
      throw new Error("Only studio owners or admins can configure payouts");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let stripeAccountId = account.stripe_connect_account_id as string | null;
    if (!stripeAccountId) {
      const created = await stripe.accounts.create({
        type: "express",
        country: account.country_code,
        email: userEmail || undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: { name: account.account_holder_name },
        metadata: {
          studio_id: account.studio_id,
          payout_account_id: account.id,
        },
      });
      stripeAccountId = created.id;
      await supabase
        .from("studio_payout_accounts")
        .update({
          stripe_connect_account_id: stripeAccountId,
          stripe_connect_status: "pending",
        })
        .eq("id", account_id);
    }

    const origin = req.headers.get("origin") ?? "";
    const safePath = typeof return_path === "string" && return_path.startsWith("/")
      ? return_path
      : "/trade/studio-settings";

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}${safePath}?stripe_connect=refresh&account=${account_id}`,
      return_url: `${origin}${safePath}?stripe_connect=return&account=${account_id}`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: link.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
