// Refresh a saved shipping quote against the current rate matrix and mark it confirmed.
// Triggered manually by an admin or automatically when balance is paid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { shipping_quote_id, mark_confirmed = true } = await req.json();
    if (!shipping_quote_id) {
      return new Response(JSON.stringify({ error: "shipping_quote_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: quote, error: qErr } = await supabase
      .from("shipping_quotes").select("*").eq("id", shipping_quote_id).single();
    if (qErr || !quote) throw new Error("Shipping quote not found");

    // Re-run estimator inline (server-side equivalent of src/lib/shippingEstimator.ts)
    const { data: lanes } = await supabase
      .from("shipping_lanes").select("*")
      .eq("origin_country", quote.origin_country)
      .eq("dest_country", quote.dest_country)
      .eq("active", true);
    if (!lanes || lanes.length === 0) throw new Error("No lane available");

    const today = new Date().toISOString().slice(0, 10);
    const { data: brackets } = await supabase
      .from("shipping_rate_brackets").select("*")
      .in("lane_id", lanes.map((l: any) => l.id))
      .lte("valid_from", today);

    const cbm = Math.max(0.01, Number(quote.total_volume_cbm));
    const kg = Math.max(0, Number(quote.total_weight_kg));
    let best: any = null;
    for (const lane of lanes) {
      const b = (brackets || []).find((x: any) => x.lane_id === lane.id
        && Number(x.min_volume_cbm) <= cbm && Number(x.max_volume_cbm) >= cbm);
      if (!b) continue;
      const freight = Math.max(
        Number(b.base_rate_cents) + Number(b.rate_per_cbm_cents) * cbm + Number(b.rate_per_kg_cents) * kg,
        Number(b.min_charge_cents)
      );
      if (!best || freight < best.freight) best = { lane, bracket: b, freight };
    }
    if (!best) throw new Error("No bracket matches");

    const { data: surcharges } = await supabase.from("shipping_surcharges").select("*").eq("active", true);
    let fuel = 0, insurance = 0, customs = 0, handling = 0, lastMile = 0;
    for (const s of surcharges || []) {
      if (s.scope === "lane" && s.lane_id !== best.lane.id) continue;
      if (s.scope === "carrier" && s.carrier_name !== best.lane.carrier_name) continue;
      if (s.scope === "dest_zone" && s.dest_country !== quote.dest_country) continue;
      let amount = 0;
      const v = Number(s.value_numeric);
      if (s.calc_method === "percent") {
        amount = s.surcharge_type === "insurance"
          ? Number(quote.declared_value_cents) * (v / 100)
          : best.freight * (v / 100);
      } else if (s.calc_method === "flat") amount = v;
      else if (s.calc_method === "per_cbm") amount = v * cbm;
      else if (s.calc_method === "per_kg") amount = v * kg;
      amount = Math.round(amount);
      if (s.surcharge_type === "fuel") fuel += amount;
      else if (s.surcharge_type === "insurance") insurance += amount;
      else if (s.surcharge_type === "customs") customs += amount;
      else if (s.surcharge_type === "last_mile") lastMile += amount;
      else handling += amount;
    }

    const { data: duties } = await supabase
      .from("shipping_duty_rates").select("*")
      .eq("dest_country", quote.dest_country).eq("active", true).limit(1);
    let duty = 0, vat = 0;
    if (duties && duties[0]) {
      duty = Math.round(Number(quote.declared_value_cents) * (Number(duties[0].duty_percent) / 100));
      vat = Math.round((Number(quote.declared_value_cents) + duty + best.freight) * (Number(duties[0].vat_percent) / 100));
    }

    const total = best.freight + fuel + insurance + customs + handling + lastMile + duty + vat;
    const validUntil = new Date(); validUntil.setDate(validUntil.getDate() + 30);

    const { error: uErr } = await supabase.from("shipping_quotes").update({
      selected_lane_id: best.lane.id,
      selected_carrier: best.lane.carrier_name,
      selected_mode: best.lane.mode,
      freight_cents: Math.round(best.freight),
      fuel_cents: fuel, insurance_cents: insurance, duty_cents: duty, vat_cents: vat,
      customs_cents: customs, handling_cents: handling, last_mile_cents: lastMile,
      total_cents: Math.round(total),
      status: mark_confirmed ? "confirmed" : "estimate",
      confirmed_at: mark_confirmed ? new Date().toISOString() : null,
      valid_until: validUntil.toISOString().slice(0, 10),
    }).eq("id", shipping_quote_id);
    if (uErr) throw uErr;

    return new Response(JSON.stringify({ ok: true, total_cents: Math.round(total) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
