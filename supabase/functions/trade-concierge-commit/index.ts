import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GENERIC_PRODUCT_TOKENS = new Set([
  "rug", "rugs", "chandelier", "chandeliers", "light", "lighting", "lamp", "lamps",
  "table", "tables", "chair", "chairs", "sofa", "sofas", "console", "cabinet", "mirror",
  "collection", "piece", "medium", "large", "small",
]);

function normalizeLoose(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function brandBase(value: string | null | undefined): string {
  return String(value || "").split(" - ")[0].trim();
}

function titleTokens(value: string | null | undefined): string[] {
  return normalizeLoose(value).split(/\s+/).filter((t) => t.length > 2 && !GENERIC_PRODUCT_TOKENS.has(t));
}

function titlesAreNearTwins(a: string, b: string): boolean {
  const an = normalizeLoose(a);
  const bn = normalizeLoose(b);
  if (!an || !bn) return false;
  // Require both titles to be at least 4 chars before allowing the substring shortcut.
  // Prevents stubs like "P", "Pa", "Pal" matching every product in the brand.
  if (an.length >= 4 && bn.length >= 4 && (an === bn || an.includes(bn) || bn.includes(an))) {
    // Still require at least one shared non-generic token
    const aTokens = titleTokens(a);
    const bTokens = titleTokens(b);
    if (aTokens.some((t) => bTokens.includes(t))) return true;
  }
  const aTokens = titleTokens(a);
  const bTokens = titleTokens(b);
  if (!aTokens.length || !bTokens.length) return false;
  const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens;
  const longer = aTokens.length <= bTokens.length ? bTokens : aTokens;
  // Require at least one shared non-generic token AND every shorter token included.
  const shared = shorter.filter((token) => longer.includes(token));
  return shared.length > 0 && shared.length === shorter.length;
}

async function findCanonicalTradeProduct(supabase: ReturnType<typeof createClient>, row: any) {
  const rowBrand = normalizeLoose(brandBase(row?.brand_name));
  if (!rowBrand || !row?.product_name) return row;
  const { data: candidates } = await supabase
    .from("trade_products")
    .select("id, product_name, brand_name, trade_price_cents, rrp_price_cents, price_unit")
    .eq("is_active", true)
    .limit(2000);
  const twins = (candidates || []).filter((c: any) =>
    c.id !== row.id &&
    normalizeLoose(brandBase(c.brand_name)) === rowBrand &&
    titlesAreNearTwins(c.product_name, row.product_name)
  );
  if (!twins.length) return row;
  const scored = twins
    .map((c: any) => {
      const cents = c.trade_price_cents ?? c.rrp_price_cents ?? null;
      return {
        row: c,
        score:
          (cents ? 1000 : 0) +
          (c.price_unit !== "per_sqm" ? 100 : 0) +
          Math.min(Number(cents || 0) / 100000, 50),
      };
    })
    .sort((a, b) => b.score - a.score);
  const currentCents = row.trade_price_cents ?? row.rrp_price_cents ?? null;
  const best = scored[0];
  if (!best) return row;
  if (!currentCents || row.price_unit === "per_sqm" || best.score > 1000) return best.row;
  return row;
}

function parseRugSqm(label: string | null | undefined): number | null {
  if (!label) return null;
  const m = label.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(cm|m)?/i);
  if (!m) return null;
  const a = parseFloat(m[1].replace(",", "."));
  const b = parseFloat(m[2].replace(",", "."));
  const unit = (m[3] || "cm").toLowerCase();
  if (!(a > 0 && b > 0)) return null;
  const factor = unit === "m" ? 1 : 0.01;
  return (a * factor) * (b * factor);
}

function resolveVariantPriceFromPick(pick: any | null, variantLabel: string | null): number | null {
  if (!pick || !variantLabel || !Array.isArray(pick.size_variants)) return null;
  const wanted = normalizeLoose(variantLabel);
  const hit = pick.size_variants.find((v: any) => {
    const label = normalizeLoose([v.base, v.top, v.label].filter(Boolean).join(" "));
    return label && (label === wanted || label.includes(wanted) || wanted.includes(label));
  });
  if (hit && Number(hit.price_cents) > 0) return Number(hit.price_cents);
  // Fallback: rugs with a per-sqm rate compute price from W × L in the variant label.
  const rate = Number(pick.price_per_sqm_cents);
  if (hit && rate > 0 && /rug/i.test(pick.category || "")) {
    const sqm = parseRugSqm(hit.base || hit.label || variantLabel);
    if (sqm) return Math.round(sqm * rate);
  }
  return null;
}


/** Fetch FX rates for the given source currencies into the target. Returns map[src] = rate. */
async function fetchFxRates(sources: string[], target: string): Promise<Record<string, number>> {
  const out: Record<string, number> = { [target]: 1 };
  const unique = Array.from(new Set(sources.map((s) => s.toUpperCase()).filter((s) => s && s !== target)));
  await Promise.all(unique.map(async (src) => {
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${src}&to=${target}`);
      const data = await res.json();
      const rate = data?.rates?.[target];
      if (typeof rate === "number" && rate > 0) out[src] = rate;
    } catch (err) {
      console.error(`FX fetch ${src}->${target} failed:`, err);
    }
  }));
  return out;
}

/** Convert cents from one currency to another using a prefetched rate map. Returns null if unknown. */
function fxConvertCents(cents: number | null, from: string | null, to: string, rates: Record<string, number>): number | null {
  if (cents == null) return null;
  const src = (from || to).toUpperCase();
  const dst = to.toUpperCase();
  if (src === dst) return cents;
  const rate = rates[src];
  if (!rate) return cents; // fall back to raw if FX unavailable — better than nulling
  return Math.round(cents * rate);
}


/** Resolve a pick id (curator pick OR trade_products) to a trade_products.id, creating a row if needed. */
async function resolvePickToTradeProduct(
  supabase: ReturnType<typeof createClient>,
  pickId: string,
): Promise<{ tradeProductId: string | null; pick: any | null }> {
  // The concierge catalog now includes both curator picks and trade_products
  // (so the assistant can see the full inventory). The id may therefore be
  // either source — try trade_products first as a direct hit, then fall
  // back to the curator-pick → trade-product resolution path.
  const { data: directTrade } = await supabase
    .from("trade_products")
    .select("id, product_name, brand_name, trade_price_cents, rrp_price_cents, price_unit")
    .eq("id", pickId)
    .maybeSingle();
  if (directTrade?.id) {
    const canonical = await findCanonicalTradeProduct(supabase, directTrade);
    return { tradeProductId: canonical?.id || directTrade.id, pick: null };
  }

  const { data: pick } = await supabase
    .from("designer_curator_picks")
    .select("id, title, image_url, dimensions, materials, category, subcategory, designer_id, gallery_images, lead_time, currency, trade_price_cents, price_per_sqm_cents, description, origin, price_prefix, pdf_url, size_variants")
    .eq("id", pickId)
    .maybeSingle();

  if (!pick) return { tradeProductId: null, pick: null };

  const { data: designer } = await supabase
    .from("designers")
    .select("name, display_name")
    .eq("id", pick.designer_id)
    .maybeSingle();

  const brandName = designer?.name || designer?.display_name;
  if (!brandName || !pick.title) return { tradeProductId: null, pick };

  // 1. Exact match
  const { data: exact } = await supabase
    .from("trade_products")
    .select("id, product_name, brand_name, trade_price_cents, rrp_price_cents, price_unit")
    .eq("brand_name", brandName)
    .eq("product_name", pick.title)
    .limit(1)
    .maybeSingle();
  if (exact?.id) {
    const canonical = await findCanonicalTradeProduct(supabase, exact);
    return { tradeProductId: canonical?.id || exact.id, pick };
  }

  // 2. Create new (mirrors the sync trigger's COALESCE pattern)
  const { data: created, error } = await supabase
    .from("trade_products")
    .insert({
      brand_name: brandName,
      product_name: pick.title,
      category: pick.category || "Uncategorized",
      subcategory: pick.subcategory || null,
      currency: pick.currency || "EUR",
      trade_price_cents: pick.trade_price_cents,
      rrp_price_cents: pick.trade_price_cents,
      dimensions: pick.dimensions,
      materials: pick.materials,
      description: pick.description,
      lead_time: pick.lead_time,
      image_url: pick.image_url,
      gallery_images: pick.gallery_images,
      spec_sheet_url: pick.pdf_url,
      origin: pick.origin,
      price_prefix: pick.price_prefix,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("resolvePickToTradeProduct insert failed:", error.message);
    return { tradeProductId: null, pick };
  }
  return { tradeProductId: created?.id || null, pick };
}

async function resolvePickIds(
  supabase: ReturnType<typeof createClient>,
  pickIds: string[],
) {
  const resolved: Array<{ pickId: string; tradeProductId: string }> = [];
  const skipped: Array<{ pickId: string; reason: string }> = [];
  for (const pid of pickIds) {
    const { tradeProductId, pick } = await resolvePickToTradeProduct(supabase, pid);
    if (!tradeProductId) {
      skipped.push({ pickId: pid, reason: pick ? "could not create trade product" : "pick not found" });
      continue;
    }
    if (!resolved.some((r) => r.tradeProductId === tradeProductId)) {
      resolved.push({ pickId: pid, tradeProductId });
    }
  }
  return { resolved, skipped };
}

/**
 * For each resolved trade_products id, ensure image_url is populated. Some
 * curator picks (notably rugs and other products whose only photo lives on a
 * gallery hotspot) land in trade_products with a NULL image_url, which means
 * tearsheets and quotes render without a thumbnail even though the concierge
 * preview shows one (the preview is enriched client-side via
 * fillHotspotImages). Mirror that fallback server-side and patch the row so
 * the board, quote, and FF&E surfaces all show the image.
 */
async function backfillTradeProductImages(
  supabase: ReturnType<typeof createClient>,
  tradeProductIds: string[],
): Promise<void> {
  if (tradeProductIds.length === 0) return;
  const { data: rows } = await supabase
    .from("trade_products")
    .select("id, product_name, brand_name, image_url")
    .in("id", tradeProductIds);
  const missing = (rows || []).filter((r: any) => !r.image_url);
  if (missing.length === 0) return;

  const normName = (s: string) =>
    String(s || "").toLowerCase().replace(/\s*\(.*?\)\s*/g, "").replace(/[^a-z0-9]+/g, "").trim();
  const normBrand = (s: string) =>
    String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

  const { data: hotspots } = await supabase
    .from("gallery_hotspots")
    .select("product_name, designer_name, product_image_url")
    .not("product_image_url", "is", null);

  if (!hotspots || hotspots.length === 0) return;

  const byName = new Map<string, string>();
  const byBrandName = new Map<string, string>();
  for (const h of hotspots as any[]) {
    const n = normName(h.product_name);
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, h.product_image_url);
    const bKey = `${normBrand(h.designer_name)}|${n}`;
    if (!byBrandName.has(bKey)) byBrandName.set(bKey, h.product_image_url);
  }

  for (const row of missing as any[]) {
    const n = normName(row.product_name);
    if (!n) continue;
    const hit =
      (row.brand_name && byBrandName.get(`${normBrand(row.brand_name)}|${n}`)) ||
      byName.get(n) ||
      null;
    if (hit) {
      await supabase.from("trade_products").update({ image_url: hit }).eq("id", row.id);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { error: "Missing auth token" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Use getClaims per project Core memory rule (not getUser)
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      console.error("getClaims failed:", claimsErr);
      return json(401, { error: "Invalid auth token" });
    }
    const userId: string = String(claimsData.claims.sub);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "Invalid JSON body" });

    const tool: string = body.tool;
    const args = body.args || {};

    // ============================================================
    // QUOTE TOOLS: draft_quote / add_to_quote
    // ============================================================
    if (tool === "draft_quote" || tool === "add_to_quote") {
      const rawLines: any[] = Array.isArray(args.lines) ? args.lines : [];
      const cleanLines = rawLines
        .filter((l) => l && typeof l.pick_id === "string" && Number.isFinite(Number(l.qty)))
        .slice(0, 24)
        .map((l) => ({
          pick_id: l.pick_id as string,
          qty: Math.max(1, Math.min(99, Number(l.qty) || 1)),
          variant: typeof l.variant === "string" && l.variant.trim() ? l.variant.trim() : null,
          lead_weeks: typeof l.lead_weeks === "number" ? l.lead_weeks : null,
          note: typeof l.note === "string" && l.note.trim() ? l.note.trim() : null,
        }));
      if (cleanLines.length === 0) return json(400, { error: "At least one line item is required" });

      const note: string | null =
        typeof args.note === "string" ? args.note.slice(0, 500) : null;
      const quoteNotes: string | null = note;

      // Resolve every pick_id to a real trade_products.id (creating rows as needed).
      const resolutions = await Promise.all(
        cleanLines.map(async (l) => {
          const { tradeProductId, pick } = await resolvePickToTradeProduct(supabase, l.pick_id);
          return { line: l, tradeProductId, pick };
        })
      );
      const resolved = resolutions.filter((r) => r.tradeProductId) as Array<{
        line: typeof cleanLines[number];
        tradeProductId: string;
        pick: any | null;
      }>;
      const skipped = resolutions
        .filter((r) => !r.tradeProductId)
        .map((r) => ({ pickId: r.line.pick_id, reason: "could not resolve to trade product" }));
      if (resolved.length === 0) {
        return json(422, { error: "None of the line items could be resolved to a product", skipped });
      }

      // Pull pricing (+ catalog currency) for the resolved trade_products in one shot
      const productIds = resolved.map((r) => r.tradeProductId);
      const { data: priced } = await supabase
        .from("trade_products")
        .select("id, trade_price_cents, rrp_price_cents, currency")
        .in("id", productIds);
      const priceById = new Map<string, { cents: number | null; currency: string }>();
      (priced || []).forEach((p: any) => {
        priceById.set(p.id, {
          cents: p.trade_price_cents ?? p.rrp_price_cents ?? null,
          currency: (p.currency || "EUR").toUpperCase(),
        });
      });


      // ----- draft_quote: create a new draft -----
      if (tool === "draft_quote") {
        const requestedProjectId: string | null =
          typeof args.project_id === "string" && args.project_id ? args.project_id : null;
        const requestedClientId: string | null =
          typeof args.client_id === "string" && args.client_id ? args.client_id : null;
        const requestedClientName: string =
          typeof args.client_name === "string" ? args.client_name.slice(0, 200) : "";
        let projectId: string | null = null;
        let studioId: string | null = null;
        let quoteCurrency: string =
          typeof args.currency === "string" && args.currency.trim()
            ? args.currency.trim().toUpperCase().slice(0, 8)
            : "EUR";

        if (requestedProjectId) {
          const { data: proj } = await supabase
            .from("projects")
            .select("id, user_id, studio_id")
            .eq("id", requestedProjectId)
            .maybeSingle();
          if (proj && (proj as any).user_id === userId) {
            projectId = (proj as any).id;
            studioId = (proj as any).studio_id || null;
          }
        }

        // Validate the client belongs to a studio the caller is a member of.
        // Service-role client is used here (RLS bypassed) so this check is the
        // ONLY thing preventing a user from attaching another studio's client
        // to their quote. Implemented via shared helper so it stays unit-tested.
        let validClientId: string | null = null;
        let validClientName: string = requestedClientName;
        if (requestedClientId) {
          const { data: cli } = await supabase
            .from("clients")
            .select("id, name, studio_id")
            .eq("id", requestedClientId)
            .maybeSingle();
          const cliStudioId = (cli as any)?.studio_id as string | null | undefined;
          if (cli && cliStudioId) {
            const allowed = await canAttachClientToQuote(
              supabase as any,
              userId,
              { studio_id: cliStudioId },
              studioId,
            );
            if (allowed) {
              validClientId = (cli as any).id;
              if (!validClientName) validClientName = (cli as any).name || "";
              if (!studioId) studioId = cliStudioId;
            }
          }
        }

        const { data: quote, error: quoteErr } = await supabase
          .from("trade_quotes")
          .insert({
            user_id: userId,
            status: "draft",
            notes: quoteNotes,
            currency: quoteCurrency,
            project_id: projectId,
            studio_id: studioId,
            client_id: validClientId,
            client_name: validClientName,
          })
          .select("id")
          .single();
        if (quoteErr || !quote) {
          console.error("Quote insert failed:", quoteErr);
          return json(500, { error: "Could not create draft quote" });
        }

        // Compute source price + currency for each line, then FX-convert into the quote currency.
        const lineSources = resolved.map((r) => {
          const variantCents = resolveVariantPriceFromPick(r.pick, r.line.variant);
          const fallback = priceById.get(r.tradeProductId) || { cents: null, currency: "EUR" };
          // Variants live on the curator pick, so use the pick's currency for them.
          const sourceCurrency = (variantCents != null
            ? (r.pick?.currency || fallback.currency || "EUR")
            : fallback.currency) || "EUR";
          const sourceCents = variantCents ?? fallback.cents;
          return { r, sourceCents, sourceCurrency: String(sourceCurrency).toUpperCase() };
        });
        const fxRates = await fetchFxRates(lineSources.map((s) => s.sourceCurrency), quoteCurrency);
        const itemsPayload = lineSources.map(({ r, sourceCents, sourceCurrency }) => ({
          quote_id: quote.id,
          product_id: r.tradeProductId,
          quantity: r.line.qty,
          unit_price_cents: fxConvertCents(sourceCents, sourceCurrency, quoteCurrency, fxRates),
          variant_label: r.line.variant,
          lead_time_weeks_override: r.line.lead_weeks,
          notes: r.line.note,
        }));
        const { error: itemsErr } = await supabase.from("trade_quote_items").insert(itemsPayload);

        if (itemsErr) {
          console.error("Quote items insert failed:", itemsErr);
          await supabase.from("trade_quotes").delete().eq("id", quote.id);
          return json(500, { error: "Could not add items to draft quote" });
        }

        await supabase.from("trade_concierge_actions").insert({
          user_id: userId,
          tool: "draft_quote",
          args: {
            project_id: projectId,
            client_id: validClientId,
            client_name: validClientName,
            currency: quoteCurrency,
            note: quoteNotes,
            lines: cleanLines,
            added: resolved.length,
            skipped,
          },
          status: "approved",
          resulting_resource_id: quote.id,
          resulting_resource_type: "trade_quote",
        });

        return json(200, {
          ok: true,
          quote_id: quote.id,
          url: `/trade/quotes/${quote.id}`,
          added: resolved.length,
          skipped,
        });
      }

      // ----- add_to_quote: append to existing draft -----
      const quoteId: string | null = typeof args.quote_id === "string" ? args.quote_id : null;
      if (!quoteId) return json(400, { error: "quote_id is required" });

      const { data: existingQuote } = await supabase
        .from("trade_quotes")
        .select("id, status, user_id, currency")
        .eq("id", quoteId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existingQuote) return json(404, { error: "Quote not found or you don't have access" });
      if ((existingQuote as any).status !== "draft") {
        return json(409, { error: "Only draft quotes can be appended to" });
      }
      const appendCurrency = String((existingQuote as any).currency || "EUR").toUpperCase();

      const lineSourcesAppend = resolved.map((r) => {
        const variantCents = resolveVariantPriceFromPick(r.pick, r.line.variant);
        const fallback = priceById.get(r.tradeProductId) || { cents: null, currency: "EUR" };
        const sourceCurrency = (variantCents != null
          ? (r.pick?.currency || fallback.currency || "EUR")
          : fallback.currency) || "EUR";
        const sourceCents = variantCents ?? fallback.cents;
        return { r, sourceCents, sourceCurrency: String(sourceCurrency).toUpperCase() };
      });
      const fxRatesAppend = await fetchFxRates(lineSourcesAppend.map((s) => s.sourceCurrency), appendCurrency);
      const itemsPayload = lineSourcesAppend.map(({ r, sourceCents, sourceCurrency }) => ({
        quote_id: quoteId,
        product_id: r.tradeProductId,
        quantity: r.line.qty,
        unit_price_cents: fxConvertCents(sourceCents, sourceCurrency, appendCurrency, fxRatesAppend),
        variant_label: r.line.variant,
        lead_time_weeks_override: r.line.lead_weeks,
        notes: r.line.note,
      }));
      const { error: appendErr } = await supabase.from("trade_quote_items").insert(itemsPayload);

      if (appendErr) {
        console.error("Quote items append failed:", appendErr);
        return json(500, { error: "Could not append items to quote" });
      }
      await supabase
        .from("trade_quotes")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", quoteId);

      await supabase.from("trade_concierge_actions").insert({
        user_id: userId,
        tool: "add_to_quote",
        args: { quote_id: quoteId, note: quoteNotes, lines: cleanLines, added: resolved.length, skipped },
        status: "approved",
        resulting_resource_id: quoteId,
        resulting_resource_type: "trade_quote",
      });

      return json(200, {
        ok: true,
        quote_id: quoteId,
        url: `/trade/quotes/${quoteId}`,
        added: resolved.length,
        skipped,
      });
    }

    // ============================================================
    // FF&E TOOL: propose_ffe_rows  → create a draft quote with
    // room-tagged line items so the project's FF&E Schedule view
    // picks them up automatically.
    // ============================================================
    if (tool === "propose_ffe_rows") {
      const projectId: string | null =
        typeof args.project_id === "string" && args.project_id ? args.project_id : null;
      if (!projectId) return json(400, { error: "project_id is required" });

      const { data: proj } = await supabase
        .from("projects")
        .select("id, user_id, studio_id, name")
        .eq("id", projectId)
        .maybeSingle();
      if (!proj || (proj as any).user_id !== userId) {
        return json(404, { error: "Project not found or you don't have access" });
      }
      const studioId: string | null = (proj as any).studio_id || null;
      const projectName: string = (proj as any).name || "FF&E";

      const rawRows: any[] = Array.isArray(args.rows) ? args.rows : [];
      const cleanRows = rawRows
        .filter((r) => r && typeof r.pick_id === "string" && typeof r.room === "string" && r.room.trim())
        .slice(0, 60)
        .map((r) => ({
          pick_id: r.pick_id as string,
          room: String(r.room).trim().slice(0, 120),
          qty: Math.max(1, Math.min(99, Number(r.qty) || 1)),
          variant: typeof r.variant === "string" && r.variant.trim() ? r.variant.trim() : null,
          lead_weeks: typeof r.lead_weeks === "number" ? r.lead_weeks : null,
          note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : null,
        }));
      if (cleanRows.length === 0) {
        return json(400, { error: "At least one FF&E row with pick_id + room is required" });
      }

      const quoteCurrency: string =
        typeof args.currency === "string" && args.currency.trim()
          ? args.currency.trim().toUpperCase().slice(0, 8)
          : "EUR";
      const quoteNotes: string | null =
        typeof args.note === "string" ? args.note.slice(0, 500) : null;

      // Resolve every row's pick_id → trade_products.id (allow duplicates across rooms).
      const resolutions = await Promise.all(
        cleanRows.map(async (row) => {
          const { tradeProductId, pick } = await resolvePickToTradeProduct(supabase, row.pick_id);
          return { row, tradeProductId, pick };
        })
      );
      const resolved = resolutions.filter((r) => r.tradeProductId) as Array<{
        row: typeof cleanRows[number];
        tradeProductId: string;
        pick: any | null;
      }>;
      const skipped = resolutions
        .filter((r) => !r.tradeProductId)
        .map((r) => ({ pickId: r.row.pick_id, reason: "could not resolve to trade product" }));
      if (resolved.length === 0) {
        return json(422, { error: "None of the FF&E rows could be resolved to a product", skipped });
      }

      const productIds = Array.from(new Set(resolved.map((r) => r.tradeProductId)));
      const { data: priced } = await supabase
        .from("trade_products")
        .select("id, trade_price_cents, rrp_price_cents, currency")
        .in("id", productIds);
      const priceById = new Map<string, { cents: number | null; currency: string }>();
      (priced || []).forEach((p: any) => {
        priceById.set(p.id, {
          cents: p.trade_price_cents ?? p.rrp_price_cents ?? null,
          currency: (p.currency || "EUR").toUpperCase(),
        });
      });

      const { data: quote, error: quoteErr } = await supabase
        .from("trade_quotes")
        .insert({
          user_id: userId,
          status: "draft",
          notes: quoteNotes || `FF&E — ${projectName}`,
          currency: quoteCurrency,
          project_id: projectId,
          studio_id: studioId,
        })
        .select("id")
        .single();
      if (quoteErr || !quote) {
        console.error("FF&E quote insert failed:", quoteErr);
        return json(500, { error: "Could not create FF&E draft quote" });
      }

      const lineSources = resolved.map((r) => {
        const variantCents = resolveVariantPriceFromPick(r.pick, r.row.variant);
        const fallback = priceById.get(r.tradeProductId) || { cents: null, currency: "EUR" };
        const sourceCurrency = (variantCents != null
          ? (r.pick?.currency || fallback.currency || "EUR")
          : fallback.currency) || "EUR";
        const sourceCents = variantCents ?? fallback.cents;
        return { r, sourceCents, sourceCurrency: String(sourceCurrency).toUpperCase() };
      });
      const fxRates = await fetchFxRates(lineSources.map((s) => s.sourceCurrency), quoteCurrency);
      const itemsPayload = lineSources.map(({ r, sourceCents, sourceCurrency }) => ({
        quote_id: quote.id,
        product_id: r.tradeProductId,
        quantity: r.row.qty,
        unit_price_cents: fxConvertCents(sourceCents, sourceCurrency, quoteCurrency, fxRates),
        variant_label: r.row.variant,
        lead_time_weeks_override: r.row.lead_weeks,
        notes: r.row.note,
        room: r.row.room,
      }));
      const { error: itemsErr } = await supabase.from("trade_quote_items").insert(itemsPayload);
      if (itemsErr) {
        console.error("FF&E items insert failed:", itemsErr);
        await supabase.from("trade_quotes").delete().eq("id", quote.id);
        return json(500, { error: "Could not add FF&E rows to draft quote" });
      }

      await supabase.from("trade_concierge_actions").insert({
        user_id: userId,
        tool: "propose_ffe_rows",
        args: {
          project_id: projectId,
          currency: quoteCurrency,
          note: quoteNotes,
          rows: cleanRows,
          added: resolved.length,
          skipped,
        },
        status: "approved",
        resulting_resource_id: quote.id,
        resulting_resource_type: "trade_quote",
      });

      return json(200, {
        ok: true,
        quote_id: quote.id,
        url: `/trade/projects/${projectId}?tab=ffe`,
        added: resolved.length,
        skipped,
      });
    }

    // ============================================================
    // TEARSHEET TOOLS (existing): require pick_ids
    // ============================================================
    const note: string | null = typeof args.note === "string" ? args.note.slice(0, 500) : null;
    const pickIds: string[] = Array.isArray(args.pick_ids)
      ? args.pick_ids.filter((x: unknown) => typeof x === "string")
      : [];
    if (pickIds.length === 0) return json(400, { error: "pick_ids must contain at least one ID" });
    if (pickIds.length > 24) return json(400, { error: "Too many picks (max 24)" });

    // ============================================================
    // TOOL: add_to_tearsheet  → append to existing board
    // ============================================================
    if (tool === "add_to_tearsheet") {
      const boardId: string | null = typeof args.board_id === "string" ? args.board_id : null;
      if (!boardId) return json(400, { error: "board_id is required" });

      // Validate ownership
      const { data: board, error: boardErr } = await supabase
        .from("client_boards")
        .select("id, title, user_id")
        .eq("id", boardId)
        .eq("user_id", userId)
        .maybeSingle();
      if (boardErr || !board) {
        return json(404, { error: "Tearsheet not found or you don't have access to it" });
      }

      const { resolved, skipped } = await resolvePickIds(supabase, pickIds);
      if (resolved.length === 0) {
        return json(422, { error: "None of the picks could be resolved to a product", skipped });
      }
      await backfillTradeProductImages(supabase, resolved.map((r) => r.tradeProductId));

      // Dedupe against items already on the board
      const productIds = resolved.map((r) => r.tradeProductId);
      const { data: existing } = await supabase
        .from("client_board_items")
        .select("product_id, sort_order")
        .eq("board_id", boardId)
        .in("product_id", productIds);

      const alreadyOnBoard = new Set((existing || []).map((e: any) => e.product_id));
      const newRows = resolved.filter((r) => !alreadyOnBoard.has(r.tradeProductId));
      const duplicates = resolved.length - newRows.length;

      // Determine starting sort_order (max existing + 1)
      const { data: maxRow } = await supabase
        .from("client_board_items")
        .select("sort_order")
        .eq("board_id", boardId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const startOrder = (maxRow?.sort_order ?? -1) + 1;

      let added = 0;
      if (newRows.length > 0) {
        const itemsPayload = newRows.map((r, i) => ({
          board_id: boardId,
          product_id: r.tradeProductId,
          sort_order: startOrder + i,
          notes: i === 0 && note ? note : null,
        }));
        const { error: itemsErr } = await supabase
          .from("client_board_items")
          .insert(itemsPayload);
        if (itemsErr) {
          console.error("Append items failed:", itemsErr);
          return json(500, { error: "Could not append items to tearsheet" });
        }
        added = newRows.length;
      }

      // Bump board updated_at
      await supabase
        .from("client_boards")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", boardId);

      await supabase.from("trade_concierge_actions").insert({
        user_id: userId,
        tool: "add_to_tearsheet",
        args: { board_id: boardId, note, pick_ids: pickIds, added, duplicates, skipped },
        status: "approved",
        resulting_resource_id: boardId,
        resulting_resource_type: "client_board",
      });

      return json(200, {
        ok: true,
        board_id: boardId,
        url: `/trade/boards/${boardId}`,
        added,
        duplicates,
        skipped,
      });
    }

    // ============================================================
    // TOOL: propose_tearsheet  → create new board
    // ============================================================
    if (tool === "propose_tearsheet") {
      const title: string = (args.title || "Untitled tearsheet").toString().slice(0, 120);

      const { resolved, skipped } = await resolvePickIds(supabase, pickIds);
      if (resolved.length === 0) {
        return json(422, { error: "None of the picks could be resolved to a product", skipped });
      }
      await backfillTradeProductImages(supabase, resolved.map((r) => r.tradeProductId));

      const { data: board, error: boardErr } = await supabase
        .from("client_boards")
        .insert({
          user_id: userId,
          title,
          client_name: "",
          status: "draft",
        })
        .select("id, share_token")
        .single();

      if (boardErr || !board) {
        console.error("Board insert failed:", boardErr);
        return json(500, { error: "Could not create tearsheet" });
      }

      const itemsPayload = resolved.map((r, i) => ({
        board_id: board.id,
        product_id: r.tradeProductId,
        sort_order: i,
        notes: i === 0 && note ? note : null,
      }));

      const { error: itemsErr } = await supabase
        .from("client_board_items")
        .insert(itemsPayload);

      if (itemsErr) {
        console.error("Board items insert failed:", itemsErr);
        await supabase.from("client_boards").delete().eq("id", board.id);
        return json(500, { error: "Could not add items to tearsheet" });
      }

      await supabase.from("trade_concierge_actions").insert({
        user_id: userId,
        tool: "propose_tearsheet",
        args: { title, note, pick_ids: pickIds, resolved_count: resolved.length, skipped },
        status: "approved",
        resulting_resource_id: board.id,
        resulting_resource_type: "client_board",
      });

      return json(200, {
        ok: true,
        board_id: board.id,
        url: `/trade/boards/${board.id}`,
        added: resolved.length,
        skipped,
      });
    }

    return json(400, { error: `Unsupported tool: ${tool}` });
  } catch (e) {
    console.error("trade-concierge-commit error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
