// Frictionless activation for pre-approved acquisition leads.
//
// Takes the activation token (an `acquisition_leads.id`), provisions/promotes the
// studio's trade workspace and returns a one-time magic-link token hash the
// browser exchanges for a session. No secrets ever reach the client.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function splitName(full: string | null): { first: string; last: string } {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = String((body as { token?: unknown }).token ?? "").trim();
    if (!UUID_RE.test(token)) {
      return json({ error: "invalid_token" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: lead, error: leadErr } = await supabase
      .from("acquisition_leads")
      .select("id, studio_name, founder_name, business_email, country")
      .eq("id", token)
      .maybeSingle();

    if (leadErr) {
      console.error("lead lookup failed:", leadErr.message);
      return json({ error: "lookup_failed" }, 500);
    }
    if (!lead || !lead.business_email) {
      return json({ error: "invalid_token" }, 404);
    }

    const email = String(lead.business_email).trim().toLowerCase();
    const { first, last } = splitName(lead.founder_name);

    // Provision (or reuse) the auth account.
    let userId: string | null = null;
    const created = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: first,
        last_name: last,
        company: lead.studio_name,
        activation_lead_id: lead.id,
      },
    });
    if (created.data?.user?.id) {
      userId = created.data.user.id;
    } else {
      // Already registered — resolve the existing id.
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      userId = existing?.id ?? null;
    }

    // Mint the one-time sign-in token (also resolves the user when unknown).
    const linked = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linked.error || !linked.data?.properties?.hashed_token) {
      console.error("magic link failed:", linked.error?.message);
      return json({ error: "activation_failed" }, 500);
    }
    userId = userId ?? linked.data.user?.id ?? null;
    if (!userId) return json({ error: "activation_failed" }, 500);

    // Profile record — approved trade status.
    await supabase.from("profiles").upsert(
      {
        id: userId,
        email,
        first_name: first,
        last_name: last,
        company: lead.studio_name ?? "",
        country: lead.country ?? null,
        trade_status: "approved",
        // Force the introductory studio experience on first landing.
        has_seen_trade_intro: false,
      },
      { onConflict: "id" },
    );

    // Trade workspace — forced approved + tax exempt.
    await supabase.from("trade_profiles").upsert(
      {
        user_id: userId,
        approval_status: "approved",
        tax_exempt_status: true,
        activated_from_lead_id: lead.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "trade_user" }, {
        onConflict: "user_id,role",
        ignoreDuplicates: true,
      });

    await supabase
      .from("acquisition_leads")
      .update({ campaign_status: "activated", verified_at: new Date().toISOString() })
      .eq("id", lead.id);

    return json({
      ok: true,
      email,
      token_hash: linked.data.properties.hashed_token,
      founder_name: lead.founder_name ?? null,
      studio_name: lead.studio_name ?? null,
    });
  } catch (e) {
    console.error("activate-trade-invite error:", e);
    return json({ error: "activation_failed" }, 500);
  }
});
