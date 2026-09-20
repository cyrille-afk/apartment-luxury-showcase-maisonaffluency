/**
 * Cross-border invoicing & shipping optimisation matrix.
 *
 * Called in the background by the cart and checkout summaries. Returns the
 * authoritative tax posture for the authenticated buyer (reverse charge only
 * ever on a registry-verified VAT number) plus an itemised freight breakdown
 * with the white-glove flag derived from the catalogue crating metrics.
 *
 * Never throws at the caller: any internal failure is logged to
 * `admin_alert_log` and surfaced as a soft error so the UI can fall back to
 * the trade baseline rates.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveTaxTreatment, type CustomsLine } from "../_shared/taxRules.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Item = {
  pickId?: string | null;
  unitCents: number;
  quantity: number;
  currency?: string | null;
  originCountry?: string | null;
  hs6Code?: string | null;
  dutyRate?: number | null;
};

/** Freight zones from our Singapore/Paris consolidation hubs. */
const ZONE_RATES: Record<string, { base: number; perKg: number; label: string }> = {
  DOMESTIC: { base: 18_000, perKg: 900, label: "Domestic" },
  ASIA: { base: 42_000, perKg: 1_600, label: "Asia-Pacific" },
  EUROPE: { base: 68_000, perKg: 2_100, label: "Europe" },
  GCC: { base: 62_000, perKg: 2_000, label: "Gulf" },
  AMERICAS: { base: 78_000, perKg: 2_400, label: "Americas" },
  ROW: { base: 82_000, perKg: 2_600, label: "Rest of World" },
};

const EUROPE = new Set([
  "GB", "IE", "FR", "DE", "IT", "ES", "PT", "NL", "BE", "LU", "AT", "CH", "LI",
  "DK", "SE", "NO", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "GR", "HR", "SI",
  "EE", "LV", "LT", "MT", "CY",
]);
const ASIA = new Set(["SG", "MY", "TH", "ID", "PH", "VN", "HK", "TW", "JP", "KR", "CN", "IN", "AU", "NZ"]);
const GCC = new Set(["AE", "SA", "QA", "KW", "BH", "OM"]);
const AMERICAS = new Set(["US", "CA", "MX", "BR", "AR", "CL"]);

const zoneFor = (iso: string) => {
  if (iso === "SG") return "DOMESTIC";
  if (EUROPE.has(iso)) return "EUROPE";
  if (GCC.has(iso)) return "GCC";
  if (ASIA.has(iso)) return "ASIA";
  if (AMERICAS.has(iso)) return "AMERICAS";
  return "ROW";
};

/** Volumetric weight for air/road freight: 1 m³ ≈ 167 kg. */
const VOLUMETRIC_FACTOR = 167;
/** Fixed white-glove architectural logistics handling per consignment. */
const WHITE_GLOVE_BASE_CENTS = 95_000;
/** Insurance premium on the declared goods value. */
const INSURANCE_RATE = 0.012;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);
    const { data: claimsData, error: claimsError } = await admin.auth.getClaims(token);
    const userId = (claimsData as any)?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Authentication required" }, 401);

    const body = (await req.json().catch(() => null)) as
      | { destinationCountry?: string; currency?: string; items?: Item[]; shippingCents?: number }
      | null;

    const destination = (body?.destinationCountry || "").toUpperCase().slice(0, 2);
    const currency = (body?.currency || "USD").toUpperCase().slice(0, 3);
    const items = Array.isArray(body?.items) ? body!.items!.slice(0, 200) : [];
    if (!/^[A-Z]{2}$/.test(destination)) return json({ error: "destinationCountry is required" }, 400);
    if (items.length === 0) return json({ error: "items is required" }, 400);

    const clean = items.map((i) => ({
      pickId: typeof i.pickId === "string" ? i.pickId : null,
      unitCents: Number.isFinite(i.unitCents) ? Math.max(0, Math.round(i.unitCents)) : 0,
      quantity: Number.isFinite(i.quantity) ? Math.max(1, Math.round(i.quantity)) : 1,
      originCountry: typeof i.originCountry === "string" ? i.originCountry : null,
      hs6Code: typeof i.hs6Code === "string" ? i.hs6Code : null,
      dutyRate: Number.isFinite(i.dutyRate as number) ? (i.dutyRate as number) : null,
    }));
    const goodsCents = clean.reduce((s, i) => s + i.unitCents * i.quantity, 0);

    /* ---- Verified buyer tax identity ------------------------------- */
    const [{ data: profile }, { data: creditProfile }] = await Promise.all([
      admin
        .from("trade_profiles")
        .select("vat_number, vat_valid_status, vat_company_name")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("trade_credit_profiles")
        .select("vat_number, vat_valid_status, vat_company_name")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const identity = (profile?.vat_valid_status ? profile : null) ??
      (creditProfile?.vat_valid_status ? creditProfile : null) ??
      profile ?? creditProfile ?? null;
    const buyerTaxId = (identity?.vat_number || "").toString().trim();
    const buyerTaxIdVerified = Boolean(identity?.vat_valid_status) && Boolean(buyerTaxId);
    const companyName = (identity?.vat_company_name || "").toString().trim() || null;

    /* ---- Crating metrics & white-glove flag ------------------------ */
    const pickIds = [...new Set(clean.map((i) => i.pickId).filter(Boolean))] as string[];
    let metrics: Record<string, {
      weight_kg: number | null;
      crated_width_mm: number | null;
      crated_depth_mm: number | null;
      crated_height_mm: number | null;
      requires_white_glove: boolean | null;
    }> = {};
    if (pickIds.length) {
      const { data: picks } = await admin
        .from("designer_curator_picks")
        .select("id, weight_kg, crated_width_mm, crated_depth_mm, crated_height_mm, requires_white_glove")
        .in("id", pickIds);
      for (const p of picks ?? []) metrics[(p as any).id] = p as any;
    }

    let chargeableKg = 0;
    let whiteGlove = false;
    for (const line of clean) {
      const m = line.pickId ? metrics[line.pickId] : undefined;
      const actual = Number(m?.weight_kg ?? 0);
      const cbm =
        m?.crated_width_mm && m?.crated_depth_mm && m?.crated_height_mm
          ? (m.crated_width_mm / 1000) * (m.crated_depth_mm / 1000) * (m.crated_height_mm / 1000)
          : 0;
      const volumetric = cbm * VOLUMETRIC_FACTOR;
      // No metrics on file → conservative 45 kg baseline per collectible piece.
      const unitKg = Math.max(actual, volumetric, actual || volumetric ? 0 : 45);
      chargeableKg += unitKg * line.quantity;
      if (m?.requires_white_glove) whiteGlove = true;
    }
    chargeableKg = Math.round(chargeableKg * 10) / 10;

    const zone = zoneFor(destination);
    const rate = ZONE_RATES[zone];
    const freightCents = Math.round(rate.base + rate.perKg * chargeableKg);
    const insuranceCents = Math.round(goodsCents * INSURANCE_RATE);
    const whiteGloveCents = whiteGlove ? WHITE_GLOVE_BASE_CENTS : 0;
    const shippingTotalCents = freightCents + insuranceCents + whiteGloveCents;

    /* ---- Tax treatment --------------------------------------------- */
    const customsLines: CustomsLine[] = clean.map((i) => ({
      hs6Code: i.hs6Code,
      dutyRate: i.dutyRate,
      originCountry: i.originCountry,
      lineTotalCents: i.unitCents * i.quantity,
    }));
    const treatment = resolveTaxTreatment({
      country: destination,
      currency,
      buyerType: buyerTaxIdVerified ? "business" : "private",
      buyerTaxId,
      buyerTaxIdVerified,
      goodsCents,
      shippingCents: shippingTotalCents,
      goodsEurCents: currency === "EUR" ? goodsCents : null,
      lines: customsLines,
    });

    const exempt =
      treatment.treatment === "reverse_charge" || treatment.treatment === "b2b_zero_rated";
    const tax_status = exempt ? "B2B_EXEMPT_REVERSE_CHARGE" : treatment.treatment.toUpperCase();

    return json({
      ok: true,
      tax_status,
      tax_treatment: treatment.treatment,
      tax_cents: exempt ? 0 : treatment.taxCents,
      tax_rate: exempt ? 0 : treatment.rate,
      tax_label: treatment.label,
      tax_note: treatment.note,
      destination_country: destination,
      currency,
      buyer_tax_id: buyerTaxIdVerified ? buyerTaxId : null,
      buyer_tax_id_verified: buyerTaxIdVerified,
      verified_company_name: buyerTaxIdVerified ? companyName : null,
      shipping: {
        zone_label: rate.label,
        chargeable_weight_kg: chargeableKg,
        freight_cents: freightCents,
        freight_label: "Insured Global Freight Courier",
        insurance_cents: insuranceCents,
        white_glove_applied: whiteGlove,
        white_glove_cents: whiteGloveCents,
        white_glove_label: "White-Glove Architectural Logistics",
        total_cents: shippingTotalCents,
      },
    });
  } catch (e) {
    // Never block checkout — log and let the client fall back to baseline rates.
    await admin.from("admin_alert_log").insert({
      channel: "cross_border_invoice",
      event: "calculation_failed",
      error: String((e as Error)?.message || e).slice(0, 500),
      status: "logged",
    }).then(() => undefined, () => undefined);
    return json({ ok: false, error: "calculation_unavailable" }, 200);
  }
});
