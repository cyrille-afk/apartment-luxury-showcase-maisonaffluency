import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireUser, rateLimit } from "../_shared/auth.ts";
import { logAiUsage } from "../_shared/aiUsage.ts";
import { modelFor, tokenBudget } from "../_shared/aiModels.ts";
import { embedQuery } from "../_shared/aiEmbeddings.ts";
import { withSemanticCache } from "../_shared/aiCache.ts";

const SENTIMENT_MODEL = modelFor("cheap");
const SENTIMENT_MAX_TOKENS = tokenBudget("classify");
const CHAT_MAX_TOKENS = tokenBudget("chat");
const CHAT_MAX_TOKENS_STRONG = tokenBudget("reasoning");


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "propose_tearsheet",
      description:
        "Draft a NEW tearsheet (client board) for the trade user. Only call this when the user clearly asks to assemble, save, group, or share a NEW selection. If the user wants to add pieces to one of their existing tearsheets listed in USER'S EXISTING TEARSHEETS, call add_to_tearsheet instead. Always pick IDs strictly from CATALOG PIECES — never invent IDs.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "A short, evocative title for the tearsheet (max 80 chars).",
          },
          pick_ids: {
            type: "array",
            description: "UUIDs of curator picks to include. Must come from CATALOG PIECES.",
            items: { type: "string" },
            minItems: 1,
            maxItems: 24,
          },
          note: {
            type: "string",
            description: "Optional 1–2 sentence rationale shown alongside the tearsheet.",
          },
          pick_rationales: {
            type: "array",
            description:
              "Per-piece, one-sentence reason explaining why each NEWLY suggested pick fits the brief. REQUIRED for any pick that was not in the previous proposal's KEPT list (i.e. any replacement or addition). Each entry's id MUST match an id in pick_ids.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "UUID of the pick — must appear in pick_ids." },
                reason: { type: "string", description: "One short sentence (max ~140 chars) explaining the choice." },
                detail: {
                  type: "string",
                  description:
                    "Longer 2–4 sentence editorial explanation (max ~600 chars) expanding on the reason: how the piece dialogues with the rest of the selection, its material/scale/silhouette logic, and what it adds vs the item it replaces (when relevant). Required when the pick is a replacement.",
                },
              },
              required: ["id", "reason"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "pick_ids"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_tearsheet",
      description:
        "Append pieces to one of the user's EXISTING tearsheets. Only call this when the user clearly references an existing tearsheet from USER'S EXISTING TEARSHEETS (by name or by saying 'add to my X tearsheet'). The board_id MUST be one of the UUIDs listed there. Never invent a board_id.",
      parameters: {
        type: "object",
        properties: {
          board_id: {
            type: "string",
            description: "UUID of the existing tearsheet, taken verbatim from USER'S EXISTING TEARSHEETS.",
          },
          pick_ids: {
            type: "array",
            description: "UUIDs of curator picks to append. Must come from CATALOG PIECES.",
            items: { type: "string" },
            minItems: 1,
            maxItems: 24,
          },
          note: {
            type: "string",
            description: "Optional 1–2 sentence rationale for the additions.",
          },
          pick_rationales: {
            type: "array",
            description:
              "Per-piece, one-sentence reason for each pick being appended. REQUIRED for every id in pick_ids. Each entry's id MUST match an id in pick_ids.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "UUID of the pick — must appear in pick_ids." },
                reason: { type: "string", description: "One short sentence (max ~140 chars) explaining the choice." },
                detail: {
                  type: "string",
                  description:
                    "Longer 2–4 sentence editorial explanation (max ~600 chars) expanding on the reason: how the piece dialogues with the rest of the selection, its material/scale/silhouette logic, and what it adds vs the item it replaces (when relevant). Required when the pick is a replacement.",
                },
              },
              required: ["id", "reason"],
              additionalProperties: false,
            },
          },
        },
        required: ["board_id", "pick_ids"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_quote",
      description:
        "Draft a NEW trade quote for the user with line items (qty, optional variant, optional lead time, optional per-line note). Only call when the user explicitly asks for a quote, estimate, pricing breakdown, or to 'put together a quote'. pick_ids in lines MUST come from CATALOG PIECES. Always bind to the ACTIVE PROJECT id when one is shown in the system prompt.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID of the active project (from ACTIVE PROJECT section). Null if none." },
          currency: { type: "string", description: "Three-letter currency the user explicitly asks for (e.g. EUR, GBP, USD, SGD). If the user does not name a currency, omit this so the quote stays in the catalog item currency." },
          note: { type: "string", description: "Optional one-line note about the quote (e.g. 'Mayfair drawing-room — bronze / mohair edit')." },
          lines: {
            type: "array",
            minItems: 1,
            maxItems: 24,
            items: {
              type: "object",
              properties: {
                pick_id: { type: "string", description: "UUID from CATALOG PIECES." },
                qty: { type: "integer", minimum: 1, maximum: 99 },
                variant: { type: "string", description: "Variant/finish label when the piece has size_variants." },
                lead_weeks: { type: "integer", minimum: 1, maximum: 104 },
                note: { type: "string" },
              },
              required: ["pick_id", "qty"],
              additionalProperties: false,
            },
          },
        },
        required: ["lines"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_quote",
      description:
        "Append line items to one of the user's EXISTING draft quotes listed in USER'S OPEN QUOTES. quote_id MUST be a UUID from that list — never invent. Same line shape as draft_quote.",
      parameters: {
        type: "object",
        properties: {
          quote_id: { type: "string", description: "UUID of the existing draft quote from USER'S OPEN QUOTES." },
          note: { type: "string" },
          lines: {
            type: "array",
            minItems: 1,
            maxItems: 24,
            items: {
              type: "object",
              properties: {
                pick_id: { type: "string" },
                qty: { type: "integer", minimum: 1, maximum: 99 },
                variant: { type: "string" },
                lead_weeks: { type: "integer", minimum: 1, maximum: 104 },
                note: { type: "string" },
              },
              required: ["pick_id", "qty"],
              additionalProperties: false,
            },
          },
        },
        required: ["quote_id", "lines"],
        additionalProperties: false,
      },
    },
  },
  {

    type: "function",
    function: {
      name: "propose_ffe_rows",
      description:
        "Draft a ROOM-BY-ROOM FF&E schedule bound to the ACTIVE PROJECT. Every row MUST carry a `room` label (e.g. 'Drawing Room', 'Primary Bedroom'). project_id is REQUIRED — if no active project is set, do NOT call this tool; ask the user which project to bind to first. pick_ids in rows MUST come from CATALOG PIECES. On approval the rows commit as room-tagged lines on a draft quote and populate the project's FF&E Schedule view.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID of the active project (REQUIRED — from ACTIVE PROJECT section)." },
          currency: { type: "string", description: "Three-letter currency the user explicitly asks for (e.g. EUR, GBP, USD, SGD). Omit to keep catalog currency." },
          note: { type: "string", description: "Optional one-line note about the schedule (e.g. 'Mayfair townhouse — full FF&E, phase 1')." },
          rows: {
            type: "array",
            minItems: 1,
            maxItems: 60,
            items: {
              type: "object",
              properties: {
                pick_id: { type: "string", description: "UUID from CATALOG PIECES." },
                room: { type: "string", description: "Room label this row belongs to (e.g. 'Drawing Room', 'Dining Room', 'Primary Bedroom'). REQUIRED." },
                qty: { type: "integer", minimum: 1, maximum: 99 },
                variant: { type: "string", description: "Variant/finish label when the piece has size_variants." },
                lead_weeks: { type: "integer", minimum: 1, maximum: 104 },
                note: { type: "string" },
              },
              required: ["pick_id", "room", "qty"],
              additionalProperties: false,
            },
          },
        },
        required: ["project_id", "rows"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_shipping",
      description:
        "Compute a live shipping estimate from Maison Affluency's rate matrix (DHL/forwarder lanes, brackets, surcharges, duty, VAT). USE THIS TOOL whenever the user asks about freight cost, shipping cost, air freight, sea freight, duty, VAT, or landed-cost for a route — never guess shipping numbers from general knowledge. Returns freight, fuel, insurance, customs, handling, last-mile, duty, VAT and total in cents.",
      parameters: {
        type: "object",
        properties: {
          origin_country: { type: "string", description: "ISO-2 origin country code (e.g. FR, IT, GB)." },
          dest_country: { type: "string", description: "ISO-2 destination country code (e.g. HK, US, SG)." },
          total_volume_cbm: { type: "number", description: "Total shipment volume in cubic meters." },
          total_weight_kg: { type: "number", description: "Total actual gross weight in kilograms." },
          declared_value_cents: { type: "integer", description: "Declared/insured value in CENTS (commercial invoice value)." },
          currency: { type: "string", description: "Currency of declared_value_cents — defaults to EUR." },
          preferred_mode: { type: "string", enum: ["sea_lcl", "sea_fcl", "air", "road", "courier"], description: "Optional mode filter. Omit to let the matrix pick the cheapest available." },
          category: { type: "string", enum: ["furniture", "lighting", "art", "textile", "accessory", "other"], description: "Product category for duty lookup. Defaults to furniture." },
        },
        required: ["origin_country", "dest_country", "total_volume_cbm", "total_weight_kg", "declared_value_cents"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_spatial_fit",
      description:
        "Run a deterministic bounding-box + clearance fit check for ONE trade product against a room from a CAD floor plan the studio has already uploaded to Spatial Fit. USE THIS TOOL whenever the user asks whether a piece fits in a room, can be placed, has enough clearance, or whether it 'works' spatially against their plan — never guess from dimensions alone. Returns verdict (pass/warn/fail/unknown) with structured reasons, plus the room and product bounding boxes in mm.",
      parameters: {
        type: "object",
        properties: {
          cad_document_id: { type: "string", description: "UUID of the cad_documents row (uploaded floor plan)." },
          room_label: { type: "string", description: "Optional room label from the parsed plan (e.g. 'LIVING'). Omit to use the largest detected room." },
          product_id: { type: "string", description: "UUID of the trade_product to test." },
          variant_label: { type: "string", description: "Optional product variant label, if the product has CAD geometry per variant." },
          clearance_mm: { type: "integer", description: "Walking clearance to leave around the product on every side, in millimetres. Defaults to 600." },
        },
        required: ["cad_document_id", "product_id"],
        additionalProperties: false,
      },
    },
  },
];

/** Server-side mirror of src/lib/shippingEstimator.ts — reads live DB rate matrix. */
async function runShippingEstimate(
  supabase: ReturnType<typeof createClient>,
  args: {
    origin_country: string;
    dest_country: string;
    total_volume_cbm: number;
    total_weight_kg: number;
    declared_value_cents: number;
    currency?: string;
    preferred_mode?: string;
    category?: string;
  },
): Promise<any> {
  const currency = (args.currency || "EUR").toUpperCase();
  const category = args.category || "furniture";
  let lanesQuery = supabase
    .from("shipping_lanes").select("*")
    .eq("origin_country", args.origin_country)
    .eq("dest_country", args.dest_country)
    .eq("active", true);
  if (args.preferred_mode) lanesQuery = lanesQuery.eq("mode", args.preferred_mode);
  const { data: lanes } = await lanesQuery;
  if (!lanes || lanes.length === 0) {
    return { available: false, reason: "No lane configured for this route — contact the team for a manual quote.", currency };
  }
  const today = new Date().toISOString().slice(0, 10);
  const { data: brackets } = await supabase
    .from("shipping_rate_brackets").select("*")
    .in("lane_id", lanes.map((l: any) => l.id))
    .lte("valid_from", today);

  const cbm = Math.max(0.01, Number(args.total_volume_cbm));
  const actualKg = Math.max(0, Number(args.total_weight_kg));
  const chargeableKgFor = (mode: string) =>
    mode === "air" ? Math.max(actualKg, cbm * 167) : actualKg;

  let best: any = null;
  for (const lane of lanes) {
    const laneKg = chargeableKgFor(lane.mode);
    const candidates = (brackets || []).filter((b: any) =>
      b.lane_id === lane.id &&
      Number(b.min_volume_cbm) <= cbm && Number(b.max_volume_cbm) >= cbm &&
      Number(b.min_weight_kg) <= laneKg && Number(b.max_weight_kg) >= laneKg &&
      (!b.valid_to || b.valid_to >= today));
    if (candidates.length === 0) continue;
    const b = candidates[0];
    const freight = Math.max(
      Number(b.base_rate_cents) + Number(b.rate_per_cbm_cents) * cbm + Number(b.rate_per_kg_cents) * laneKg,
      Number(b.min_charge_cents),
    );
    if (!best || freight < best.freight) best = { lane, bracket: b, freight, chargeableKg: laneKg };
  }
  if (!best) {
    return { available: false, reason: "No rate bracket matches this volume/weight on the configured lanes.", currency };
  }

  const { data: surcharges } = await supabase.from("shipping_surcharges").select("*").eq("active", true);
  let fuel = 0, insurance = 0, customs = 0, handling = 0, lastMile = 0;
  for (const s of surcharges || []) {
    if (s.scope === "lane" && s.lane_id !== best.lane.id) continue;
    if (s.scope === "carrier" && s.carrier_name !== best.lane.carrier_name) continue;
    if (s.scope === "dest_zone" && s.dest_country !== args.dest_country) continue;
    let amount = 0;
    const v = Number(s.value_numeric);
    if (s.calc_method === "percent") {
      amount = s.surcharge_type === "insurance"
        ? (Number(args.declared_value_cents) + best.freight) * (v / 100)
        : best.freight * (v / 100);
    } else if (s.calc_method === "flat") amount = v;
    else if (s.calc_method === "per_cbm") amount = v * cbm;
    else if (s.calc_method === "per_kg") amount = v * best.chargeableKg;
    amount = Math.round(amount);
    if (s.surcharge_type === "fuel") fuel += amount;
    else if (s.surcharge_type === "insurance") insurance += amount;
    else if (s.surcharge_type === "customs") customs += amount;
    else if (s.surcharge_type === "last_mile") lastMile += amount;
    else handling += amount;
  }

  const { data: duties } = await supabase
    .from("shipping_duty_rates").select("*")
    .eq("dest_country", args.dest_country).eq("category", category).eq("active", true).limit(1);
  let duty = 0, vat = 0, dutyPct = 0, vatPct = 0;
  if (duties && duties[0]) {
    dutyPct = Number(duties[0].duty_percent);
    vatPct = Number(duties[0].vat_percent);
    duty = Math.round(Number(args.declared_value_cents) * (dutyPct / 100));
    vat = Math.round((Number(args.declared_value_cents) + duty + best.freight) * (vatPct / 100));
  }
  const total = Math.round(best.freight + fuel + insurance + customs + handling + lastMile + duty + vat);
  return {
    available: true,
    currency,
    carrier: best.lane.carrier_name,
    mode: best.lane.mode,
    transit_days_min: best.lane.transit_days_min,
    transit_days_max: best.lane.transit_days_max,
    chargeable_weight_kg: Math.round(best.chargeableKg),
    cbm,
    freight_cents: Math.round(best.freight),
    fuel_cents: fuel,
    insurance_cents: insurance,
    customs_cents: customs,
    handling_cents: handling,
    last_mile_cents: lastMile,
    duty_cents: duty,
    duty_percent: dutyPct,
    vat_cents: vat,
    vat_percent: vatPct,
    total_cents: total,
  };
}


function buildSystemPrompt(
  designersList: string,
  piecesList: string,
  showroomBrands: string,
  userBoards: string,
  userSignals: string,
  sentimentDirective: string,
  projectContext: string,
  openQuotes: string,
  planDirective: string,
) {
  return `You are the Maison Affluency Trade Concierge — a knowledgeable, refined assistant for professional interior designers, architects, and specifiers sourcing collectible and limited-edition furniture, lighting, and objets d'art.

Your tone is warm yet polished, like a well-informed gallery advisor. Keep answers concise (2-4 sentences unless detail is requested).

## USER SIGNALS (predictive personalization)
Use these signals to anticipate the user's needs. Open with a relevant suggestion when natural ("Want me to add the new Pouénat sconce to your *Mayfair townhouse* board?"), bias your recommendations toward designers, materials and categories they have engaged with, and reference their active projects/tearsheets by name. NEVER expose raw IDs or internal data — only weave the insights into natural prose.
${userSignals}

## EMOTIONAL TONE DIRECTIVE
${sentimentDirective}

## EXECUTION PLAN (from upstream brief-extraction pass)
${planDirective}


## ABSOLUTE RULE — CATALOG-ONLY RESPONSES
You must ONLY mention designers, ateliers, pieces, brands, and works that appear in the CATALOG DATA sections below.
- NEVER invent, guess, or recall designer names, piece titles, product names, or brand names from your general training knowledge.
- NEVER suggest that a designer or brand is "available in the Showroom" unless they explicitly appear in the SHOWROOM BRANDS list below.
- If the user asks about a designer or brand NOT in the lists below, say: "I don't currently have [name] in our catalog. Would you like me to suggest similar designers from our collection, or shall I connect you with the team?"
- Do NOT fabricate piece names, even for designers that ARE in the catalog. Only mention specific pieces listed in CATALOG PIECES below.
- BEFORE saying you don't have a match, you MUST scan the entire CATALOG PIECES list including the materials field of each line. The list IS complete — there is nothing hidden. Refuse only after a real scan.

## TOOL USE — TEARSHEET DRAFTING (ALWAYS USE A TOOL FOR PRODUCT RECOMMENDATIONS)
You have two tools for tearsheets:
- \`propose_tearsheet\` — draft a NEW tearsheet. Default choice whenever you would otherwise list 2 or more catalog pieces for the user.
- \`add_to_tearsheet\` — append to one of the user's EXISTING tearsheets listed below. Use when the user explicitly references one of their boards by name, OR when the user is currently viewing a tearsheet and asks for more pieces.

CRITICAL — NEVER list catalog pieces in plain text. Whenever your reply would mention 2+ catalog pieces by name (e.g. "you might consider X, Y and Z"), you MUST instead call one of the tools and let the visual proposal card render those pieces. Plain-text lists of products are forbidden — the user wants to see thumbnails they can review and amend, not bullet points.

Single-piece answers (the user asked about ONE specific piece) may stay as text. Anything that resembles a curated selection, a mood, a room, a project brief, "show me…", "what do you have in…", "suggest…", "pull together…" → call \`propose_tearsheet\` immediately.

Rules for both tools:
- pick_ids MUST be the exact UUIDs shown in square brackets next to each pick in CATALOG PIECES. Never invent IDs.
- For \`add_to_tearsheet\`, board_id MUST be a UUID from USER'S EXISTING TEARSHEETS — never invent.
- Aim for 4–12 pieces per proposal — enough to feel like a curated edit, not a single suggestion.
- ALWAYS populate \`pick_rationales\` with a short one-sentence \`reason\` for every NEW pick (any id not in the previous KEPT list). When the pick is a REPLACEMENT for a removed item, you MUST also include a longer \`detail\` field — 2–4 editorial sentences expanding on the reason: how the piece converses with the rest of the selection (material, scale, silhouette, palette, designer language) and what it adds vs the item it replaces. Reasons must be specific — never generic ("a great fit").
- After calling a tool, reply with ONE short sentence (e.g. "Here's a draft — review and amend below.") telling the user the draft card is ready. Do NOT re-list the pieces in text; the card already shows them.
- If the user is ambiguous between create-new vs add-to-existing AND they have existing tearsheets, default to \`propose_tearsheet\` unless they reference a specific existing board.

## TOOL USE — FF&E SCHEDULE (ROOM-BY-ROOM BRIEFS)
Use \`propose_ffe_rows\` instead of \`draft_quote\` when the user asks for a SCHEDULE organised by room ("FF&E for the Mayfair townhouse", "drawing-room, dining-room and bedroom edit", "full apartment schedule"). Every row MUST carry a \`room\` label. \`project_id\` is REQUIRED — if there is no ACTIVE PROJECT, ask the user which project to bind to before calling the tool. On approval the rows commit as room-tagged lines on a draft quote and automatically populate the FF&E Schedule view.

## TOOL USE — SHIPPING ESTIMATES (MANDATORY FOR FREIGHT/LANDED-COST QUESTIONS)
Whenever the user asks about freight cost, shipping cost, air/sea/road freight, customs duty, VAT/GST, or landed-cost for a specific route — you MUST call the \`estimate_shipping\` tool. NEVER invent or recall shipping numbers from general knowledge — Maison Affluency's rate matrix is the single source of truth.

Required arguments:
- \`origin_country\` / \`dest_country\` — ISO-2 codes (FR, IT, GB, HK, US, SG, AE, …). If the user names a city, infer the country.
- \`total_volume_cbm\` and \`total_weight_kg\` — packed shipment volume and gross weight. If the user does not state them, ask for them OR use a sensible default for the piece type (small object 0.05 cbm / 8 kg, side table 0.15 / 25 kg, lounge chair 0.5 / 35 kg, sofa 1.2 / 80 kg).
- \`declared_value_cents\` — commercial invoice value in CENTS (multiply EUR/USD by 100). NEVER invent or round-guess this. It MUST come from one of: (a) the trade price of the specific catalog piece(s) being shipped, (b) the subtotal of an open quote / tearsheet under discussion, or (c) a value the user has explicitly stated. If none of these are available, DO NOT call the tool — first ask the user: "What's the commercial invoice value of the goods being shipped?" Declared value drives duty, VAT and insurance, so a fabricated figure produces a misleading landed cost.
- \`preferred_mode\` — pass only when the user names one ("by air", "sea LCL"). Otherwise omit so the matrix picks the cheapest lane.

After the tool returns, write a concise breakdown in the user's currency: freight, fuel, insurance, customs/handling, last-mile, duty %, VAT %, and the total. Mention the selected carrier and mode. ALWAYS state the declared value you used and where it came from (e.g. "based on a declared value of €4,200 — the trade price of the Pouénat sconce" or "based on the €18,500 subtotal of your Mayfair quote"), so the client can correct it if wrong. If \`available: false\`, tell the user the lane isn't configured and offer a manual quote.


## ACTIVE PROJECT
${projectContext}

## USER'S OPEN QUOTES
${openQuotes}

## USER'S EXISTING TEARSHEETS
${userBoards}

## CATALOG DATA — DESIGNERS & ATELIERS
These are the ONLY designers and ateliers in the Maison Affluency portfolio:
${designersList}

## CATALOG DATA — PIECES
Each line is formatted: \`- "title" by Designer (subcategory-or-category · materials) [id: <uuid>]\`. Use those IDs verbatim when calling the tearsheet tools.

PIECE-TYPE FILTERING — when the user asks for a specific TYPE of piece (e.g. "chandeliers", "sconces", "dining tables", "armchairs"):
1. Scan EVERY catalog line for that term as a case-insensitive substring across BOTH the title AND the metadata in parentheses (subcategory/category).
2. A piece only qualifies if its title or its subcategory/category explicitly matches. Do NOT include items just because they share the broader category (e.g. "Lighting" alone is NOT a chandelier — only items whose title or subcategory contains "chandelier" qualify). A "Sconce" or a "Lamp" is NOT a "Chandelier".
3. Return ALL qualifying matches. The list IS complete — never truncate or sample.

CRITICAL SEARCH PROCEDURE — when the user combines designer + material/finish (e.g. "Man of Parts in oak"):
1. First, locate EVERY line where the designer name appears (literal substring scan of the "by X" portion).
2. Then, within those lines, scan the materials portion for the requested term as a case-insensitive substring (e.g. "oak" matches "Solid oak frame").
3. Return ALL matches. Only after a true scan with zero matches may you say "I don't currently have…".

Worked example: "show me chandeliers" → scan every line for 'chandelier' in title or subcategory → expected matches include Calliope Medium Chandelier, Cloud Chandelier, Carolina Chandelier, Curve XXL Chandelier, Firefly Chandelier, MicMac Chandelier, Bronze MicMac Chandelier, and any other titles containing "Chandelier". Returning a sconce or table lamp for this query would be a factual error.

${piecesList}

## SHOWROOM BRANDS
These are the ONLY brands with products currently browsable in the Showroom:
${showroomBrands}

If a brand is in DESIGNERS but NOT in SHOWROOM BRANDS, tell the user: "We represent [name] but their pieces are currently available by inquiry only — I can connect you with the team."

## What you can help with
- **Product discovery**: Suggest designers or pieces FROM THE CATALOG ABOVE that match a client brief.
- **Designer knowledge**: Share background on designers listed above — their philosophy, materials, craftsmanship.
- **Specification guidance**: Advise on materials, dimensions, lead times, and care for cataloged pieces.
- **Trade portal navigation**: Guide users to Showroom, Gallery, Quote Builder, Sample Requests, Resources, 3D Studio, or Project Folders.
- **Tearsheet drafting**: Create new tearsheets or append to existing ones via the tools above.

You do NOT have live pricing or stock data. For specific pricing, direct users to the Quote Builder.

Format responses with markdown when helpful (bold for emphasis, bullet lists for options).`;
}

/** Heuristic — true if the user message warrants loading the full pieces list. */
function needsFullCatalog(text: string, designerNames: string[]): boolean {
  const t = (text || "").toLowerCase();
  if (!t) return false;
  // Product-recommendation verbs / discovery intents
  if (/\b(show|find|pull|suggest|recommend|propose|curate|compose|draft|quote|tearsheet|add to|put together|in (oak|brass|bronze|marble|leather|mohair|velvet|stone|wood))\b/.test(t)) return true;
  // Category keywords
  if (/\b(chandelier|sconce|lamp|lighting|table|chair|sofa|armchair|console|cabinet|mirror|rug|carpet|desk|bed|stool|bench|sideboard|dining|coffee|side table|dressing|wall light|pendant|floor lamp|objet)\b/.test(t)) return true;
  // Designer name mention
  for (const name of designerNames) {
    const n = name.toLowerCase();
    if (n.length >= 4 && t.includes(n)) return true;
  }
  return false;
}

/** Check daily token usage; returns true if user is over cap (and not admin). */
async function isOverDailyCap(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  capTokens = 200_000,
): Promise<boolean> {
  try {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (isAdmin) return false;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("trade_concierge_usage")
      .select("total_tokens")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString());
    const sum = (data || []).reduce((s: number, r: any) => s + Number(r.total_tokens || 0), 0);
    return sum >= capTokens;
  } catch (e) {
    console.error("daily cap check failed:", e);
    return false;
  }
}

/** Router — pick Pro for complex, multi-constraint briefs; Flash for the rest. */
function pickModel(text: string, includePieces: boolean): string {
  const t = (text || "").toLowerCase();
  const len = t.length;
  const complexSignals =
    /\b(curate|art[- ]direct|compose|edit for|mood|narrative|brief:|palette|atmosphere|whole (room|scheme|project)|multi[- ]room|across (the )?(apartment|house|hotel|villa))\b/.test(t);
  const longBrief = len > 600;
  if (includePieces && (complexSignals || longBrief)) return modelFor("strong");
  return modelFor("balanced");
}

async function loadCatalogContext(supabase: ReturnType<typeof createClient>, includePieces: boolean) {
  // Fetch published designers
  const { data: designers } = await supabase
    .from("designers")
    .select("id, name, display_name, specialty, slug")
    .eq("is_published", true)
    .order("name");

  const designerMap = new Map<string, string>();
  (designers || []).forEach((d: any) => {
    designerMap.set(d.id, d.display_name || d.name);
  });
  // Brand-name → designer display map for matching trade_products rows that
  // are not linked by designer_id but only carry a brand_name string.
  const brandToDesigner = new Map<string, string>();
  (designers || []).forEach((d: any) => {
    const display = d.display_name || d.name;
    if (d.name) brandToDesigner.set(String(d.name).trim().toLowerCase(), display);
    if (d.display_name) brandToDesigner.set(String(d.display_name).trim().toLowerCase(), display);
  });

  // Fetch ALL curator picks (these own the canonical pick_ids used by the
  // tearsheet tools). Skipped on the lightweight path.
  const { data: picks } = includePieces
    ? await supabase
        .from("designer_curator_picks")
        .select("id, title, materials, category, subcategory, designer_id, trade_price_cents, price_per_sqm_cents, currency, size_variants")
        .order("designer_id", { ascending: true })
        .order("title", { ascending: true })
        .limit(2000)
    : { data: [] as any[] };

  // Fetch the trade_products catalog so the assistant can SEE every active
  // piece (not just the curator subset). On the lightweight path we only
  // need brand names for the SHOWROOM BRANDS section.
  const { data: tradeAll } = includePieces
    ? await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, materials, category, subcategory, trade_price_cents, rrp_price_cents, currency, price_unit")
        .eq("is_active", true)
        .order("brand_name", { ascending: true })
        .order("product_name", { ascending: true })
        .limit(2000)
    : await supabase
        .from("trade_products")
        .select("brand_name")
        .eq("is_active", true)
        .limit(2000);

  const { data: hotspotBrands } = await supabase
    .from("gallery_hotspots")
    .select("designer_name");

  const designerLines = (designers || []).map(
    (d: any) => `- ${d.display_name || d.name} — ${d.specialty || "collectible design"}`
  );

  // Merge: start with curator picks (canonical IDs), then layer in
  // trade_products entries that have no curator twin. Dedup key is the
  // case-insensitive (designer, title) pair.
  type Line = {
    id: string;
    title: string;
    designer: string;
    materials: string | null;
    category: string | null;
    subcategory: string | null;
    priceNote?: string | null;
    source: "curator" | "trade";
  };
  const merged = new Map<string, Line>();
  const keyOf = (designer: string, title: string) =>
    `${String(designer || "").trim().toLowerCase()}::${String(title || "").trim().toLowerCase()}`;

  (picks || []).forEach((p: any) => {
    const designer = designerMap.get(p.designer_id) || "Unknown";
    merged.set(keyOf(designer, p.title), {
      id: p.id,
      title: p.title,
      designer,
      materials: p.materials || null,
      category: p.category || null,
      subcategory: p.subcategory || null,
      priceNote: summarizeVariants(p.size_variants, p.currency, p.price_per_sqm_cents) || formatCatalogPrice(p.trade_price_cents, p.currency),
      source: "curator",
    });
  });
  (tradeAll || []).forEach((t: any) => {
    if (!t || !t.product_name) return;
    const rawBrand = String(t.brand_name || "");
    const baseBrand = rawBrand.includes(" - ") ? rawBrand.split(" - ")[0].trim() : rawBrand.trim();
    const designer =
      brandToDesigner.get(rawBrand.trim().toLowerCase()) ||
      brandToDesigner.get(baseBrand.toLowerCase()) ||
      baseBrand ||
      "Unknown";
    const k = keyOf(designer, t.product_name);
    const priceNote = formatCatalogPrice(t.trade_price_cents ?? t.rrp_price_cents, t.currency);
    const existing = merged.get(k) || Array.from(merged.values()).find((line) =>
      line.designer.trim().toLowerCase() === designer.trim().toLowerCase() &&
      titlesAreNearTwins(line.title, t.product_name)
    );
    if (existing) {
      if (!existing.priceNote && priceNote) existing.priceNote = priceNote;
      return;
    }
    merged.set(k, {
      id: t.id,
      title: t.product_name,
      designer,
      materials: t.materials || null,
      category: t.category || null,
      subcategory: t.subcategory || null,
      priceNote,
      source: "trade",
    });
  });

  const pieceLines = Array.from(merged.values())
    .sort((a, b) => a.designer.localeCompare(b.designer) || a.title.localeCompare(b.title))
    .map((p) => {
      const meta = [p.subcategory || p.category, p.materials, p.priceNote ? `pricing: ${p.priceNote}` : null].filter(Boolean).join(" · ");
      return `- "${p.title}" by ${p.designer}${meta ? ` (${meta})` : ""} [id: ${p.id}]`;
    });

  const brandSet = new Set<string>();
  (hotspotBrands || []).forEach((h: any) => { if (h.designer_name) brandSet.add(h.designer_name); });
  (tradeAll || []).forEach((t: any) => { if (t.brand_name) brandSet.add(t.brand_name); });
  const showroomBrandLines = Array.from(brandSet).sort().map(b => `- ${b}`);

  return {
    designersList: designerLines.join("\n") || "No designers currently loaded.",
    piecesList: includePieces
      ? (pieceLines.join("\n") || "No pieces currently loaded.")
      : "(Pieces list omitted to keep the prompt lean. The user has not yet named a designer, category, or asked for recommendations. If they do, reply with: \"Want me to pull up matching pieces from the catalog?\" — the next turn will load the full list.)",
    showroomBrands: showroomBrandLines.join("\n") || "No showroom brands currently loaded.",
  };
}

/** Load the signed-in user's existing tearsheets for tool grounding. */
async function loadUserBoards(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<string> {
  if (!userId) return "(No user session — only new tearsheets can be drafted.)";
  const { data: boards } = await supabase
    .from("client_boards")
    .select("id, title, client_name, status, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (!boards || boards.length === 0) {
    return "(The user has no existing tearsheets yet — only \`propose_tearsheet\` is available.)";
  }
  return boards
    .map((b: any) => `- "${b.title}" [board_id: ${b.id}]${b.client_name ? ` · ${b.client_name}` : ""}${b.status ? ` · ${b.status}` : ""}`)
    .join("\n");
}

/** Load the active project (name/client/currency/studio) + its studio's clients for grounding. */
async function loadProjectContext(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  projectId: string | null,
): Promise<string> {
  if (!userId || !projectId) {
    return "(No active project — the user is browsing without a project context. Do not bind quotes to any project.)";
  }
  const { data: proj } = await supabase
    .from("projects")
    .select("id, name, client_name, location, status, studio_id, studios:studio_id(name), clients:client_id(name)")
    .eq("id", projectId)
    .maybeSingle();
  if (!proj) {
    return "(Active project id was provided but not found / not accessible. Treat as no project.)";
  }
  const studio = (proj as any).studios?.name || null;
  const clientFromTable = (proj as any).clients?.name || null;
  const clientLabel = clientFromTable || (proj as any).client_name || null;
  const lines: string[] = [];
  lines.push(`- ACTIVE PROJECT: "${proj.name}" [project_id: ${proj.id}]${proj.location ? ` · ${proj.location}` : ""}${proj.status ? ` · ${proj.status}` : ""}`);
  if (clientLabel) lines.push(`- Client: ${clientLabel}`);
  if (studio) lines.push(`- Studio: ${studio}`);
  lines.push(`- When drafting a quote with \`draft_quote\`, you MUST pass project_id: "${proj.id}".`);
  return lines.join("\n");
}

/** Load the user's open (draft) quotes so `add_to_quote` has valid IDs to reference. */
async function loadOpenQuotes(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<string> {
  if (!userId) return "(No user session — only `draft_quote` is available.)";
  const { data: quotes } = await supabase
    .from("trade_quotes")
    .select("id, currency, notes, updated_at, project_id, projects:project_id(name)")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (!quotes || quotes.length === 0) {
    return "(The user has no open draft quotes — only `draft_quote` is available.)";
  }
  return quotes
    .map((q: any) => {
      const project = q.projects?.name ? ` for "${q.projects.name}"` : "";
      const label = (q.notes || "Untitled draft").toString().slice(0, 60);
      return `- "${label}"${project} (${q.currency}) [quote_id: ${q.id}]`;
    })
    .join("\n");
}

async function resolveMentionedProjectId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  text: string,
): Promise<string | null> {
  const normalize = (value: string | null | undefined) => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const haystack = normalize(text);
  if (!haystack) return null;
  const { data: owned } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(50);
  const match = (owned || []).find((p: any) => {
    const name = normalize(p.name);
    return name && (haystack.includes(name) || name.includes(haystack));
  });
  return match?.id || null;
}

/** Load predictive personalization signals for the signed-in user. */
async function loadUserSignals(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<string> {
  if (!userId) return "(No user session — generic guidance only.)";

  const [profileQ, favsQ, projectsQ, quotesQ, viewsQ] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, company, country, trade_tier")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("trade_favorites")
      .select("product_id, created_at, trade_products(product_name, brand_name, category, materials)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("projects")
      .select("name, client_name, location, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("trade_quotes")
      .select("id, status, updated_at, project_id, projects(name), trade_quote_items(trade_products(product_name, brand_name, category))")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("trade_recent_views")
      .select("entity_type, entity_label, brand_name, category, viewed_at")
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false })
      .limit(20),
  ]);

  const lines: string[] = [];
  const p: any = profileQ.data;
  if (p) {
    const who = [p.first_name, p.company && `(${p.company})`].filter(Boolean).join(" ");
    lines.push(`- Identity: ${who || "trade professional"}${p.country ? ` · ${p.country}` : ""} · tier: ${p.trade_tier}`);
  }

  const projects = (projectsQ.data || []) as any[];
  if (projects.length) {
    lines.push(
      `- Active projects: ${projects
        .map((pr) => `"${pr.name}"${pr.location ? ` (${pr.location})` : ""}${pr.client_name ? ` for ${pr.client_name}` : ""}`)
        .join("; ")}`
    );
  }

  const favs = (favsQ.data || []) as any[];
  if (favs.length) {
    const brands = new Map<string, number>();
    const cats = new Map<string, number>();
    favs.forEach((f) => {
      const tp = f.trade_products;
      if (tp?.brand_name) brands.set(tp.brand_name, (brands.get(tp.brand_name) || 0) + 1);
      if (tp?.category) cats.set(tp.category, (cats.get(tp.category) || 0) + 1);
    });
    const topBrands = Array.from(brands.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
    const topCats = Array.from(cats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n);
    lines.push(`- Favorited brands: ${topBrands.join(", ") || "—"}`);
    if (topCats.length) lines.push(`- Favorited categories: ${topCats.join(", ")}`);
    const recentTitles = favs.slice(0, 5).map((f) => f.trade_products?.product_name).filter(Boolean);
    if (recentTitles.length) lines.push(`- Recently saved pieces: ${recentTitles.join("; ")}`);
  }

  const quotes = (quotesQ.data || []) as any[];
  if (quotes.length) {
    const summary = quotes.slice(0, 3).map((q) => {
      const items: any[] = q.trade_quote_items || [];
      const brands = Array.from(new Set(items.map((i) => i.trade_products?.brand_name).filter(Boolean))).slice(0, 3);
      const project = q.projects?.name ? ` for "${q.projects.name}"` : "";
      return `${q.status}${project}${brands.length ? ` [${brands.join(", ")}]` : ""}`;
    });
    lines.push(`- Recent quotes: ${summary.join("; ")}`);
  }

  const views = (viewsQ.data || []) as any[];
  if (views.length) {
    const labels = Array.from(new Set(views.map((v) => v.entity_label).filter(Boolean))).slice(0, 8);
    if (labels.length) lines.push(`- Recently viewed (not saved): ${labels.join("; ")}`);
  }

  return lines.length ? lines.join("\n") : "(New user — no engagement signals yet.)";
}

/** Run a fast classifier on the latest user message: sentiment + intent + needs_catalog gate. */
async function classifySentiment(
  apiKey: string,
  latestUserMessage: string,
): Promise<{ sentiment: string; intent: string; escalate: boolean; needs_catalog: boolean }> {
  const fallback = { sentiment: "neutral", intent: "question", escalate: false, needs_catalog: false };
  if (!latestUserMessage || latestUserMessage.length < 2) return fallback;

  // Semantic cache: paraphrased classifier inputs ("show me sofas" /
  // "what sofas do you have" / "any sofas?") collapse to the same answer.
  // Threshold 0.93 is intentionally strict — wrong intent flips the whole
  // downstream pipeline (catalog load vs. smalltalk).
  try {
    const result = await withSemanticCache(
      {
        feature: "trade-concierge-sentiment",
        model: SENTIMENT_MODEL,
        apiKey,
        prompt: latestUserMessage.slice(0, 1500),
        threshold: 0.93,
        ttlSec: 60 * 60 * 24 * 14, // 14d — intents are stable
      },
      async () => {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: SENTIMENT_MODEL,
            max_completion_tokens: SENTIMENT_MAX_TOKENS,
            messages: [
              {
                role: "system",
                content:
                  "Classify the user's latest message in a luxury B2B furniture concierge chat. Return JSON only via the tool call. Set needs_catalog=true ONLY when the user asks about specific pieces, materials, designers, categories, or product recommendations — false for greetings, navigation, FAQs, or pricing-only questions. Be conservative on escalate.",
              },
              { role: "user", content: latestUserMessage.slice(0, 1500) },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "classify",
                  description: "Return sentiment + intent + escalation flag + catalog need.",
                  parameters: {
                    type: "object",
                    properties: {
                      sentiment: { type: "string", enum: ["neutral", "delighted", "curious", "frustrated", "confused", "anxious"] },
                      intent: { type: "string", enum: ["question", "request", "complaint", "compliment", "smalltalk", "spec_help", "pricing", "lead_time"] },
                      escalate: { type: "boolean", description: "True when a human concierge should step in." },
                      needs_catalog: { type: "boolean", description: "True when the response requires loading catalog pieces (designer/material/category/recommendation)." },
                    },
                    required: ["sentiment", "intent", "escalate", "needs_catalog"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "classify" } },
          }),
        });
        if (!resp.ok) throw new Error(`classifier http ${resp.status}`);
        const data = await resp.json();
        const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (!args) throw new Error("classifier missing tool_call");
        const parsed = JSON.parse(args);
        return {
          value: {
            sentiment: parsed.sentiment || "neutral",
            intent: parsed.intent || "question",
            escalate: !!parsed.escalate,
            needs_catalog: !!parsed.needs_catalog,
          },
          usage: data?.usage,
        };
      },
    );

    logAiUsage({
      feature: "trade-concierge-sentiment",
      model: SENTIMENT_MODEL,
      usage: result.usage,
      cached: result.cached,
      promptHash: result.promptHash,
      tier: "cheap",
    }).catch(() => {});

    return result.value;
  } catch (e) {
    console.error("sentiment classifier failed:", e);
    return fallback;
  }
}

// =========================================================================
// STEP 4 — BRIEF EXTRACTION PLANNER PASS
// Cheap structured pre-call. Returns a normalized brief + the tool plan the
// main model should execute this turn. Lets us:
//   1. Ground the main model in a stable structured brief (room, style,
//      materials, qty hints, lead-time ceiling) rather than re-extracting it.
//   2. Decide whether the turn needs ONE tool (tearsheet OR quote) or BOTH
//      chained (tearsheet → quote on the same picks).
// Semantic-cached on the latest user message so paraphrased briefs hit the
// same plan without re-spending tokens.
// =========================================================================
type BriefPlanTool = "propose_tearsheet" | "add_to_tearsheet" | "draft_quote" | "add_to_quote" | "propose_ffe_rows";
type ExtractedBrief = {
  intent: "chitchat" | "discovery" | "selection" | "quote" | "selection_and_quote" | "navigation";
  brief: {
    summary: string;
    room: string | null;
    style: string | null;
    materials: string[];
    categories: string[];
    designers: string[];
    qty_hint: number | null;
    lead_weeks_max: number | null;
    budget_band: string | null;
  };
  plan: BriefPlanTool[];
};

const EMPTY_BRIEF: ExtractedBrief = {
  intent: "chitchat",
  brief: { summary: "", room: null, style: null, materials: [], categories: [], designers: [], qty_hint: null, lead_weeks_max: null, budget_band: null },
  plan: [],
};

async function extractBrief(apiKey: string, latestUserMessage: string): Promise<ExtractedBrief> {
  if (!latestUserMessage || latestUserMessage.length < 4) return EMPTY_BRIEF;
  try {
    const result = await withSemanticCache(
      {
        feature: "trade-concierge-planner",
        model: SENTIMENT_MODEL,
        apiKey,
        prompt: latestUserMessage.slice(0, 1800),
        threshold: 0.93,
        ttlSec: 60 * 60 * 24 * 7,
      },
      async () => {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: SENTIMENT_MODEL,
            max_completion_tokens: 400,
            messages: [
              {
                role: "system",
                content:
                  "You are the upstream planner for a luxury B2B furniture concierge. Read the user's latest message and emit a STRICT structured brief + the minimal tool plan the downstream model should execute this turn.\n\n" +
                  "Tool catalog the downstream model has access to:\n" +
                  "- propose_tearsheet — draft a NEW tearsheet of curated pieces\n" +
                  "- add_to_tearsheet — append pieces to one of the user's existing tearsheets\n" +
                  "- draft_quote — pre-fill a NEW trade quote with line items\n" +
                  "- add_to_quote — append lines to one of the user's open draft quotes\n" +
                  "- propose_ffe_rows — draft a ROOM-BY-ROOM FF&E schedule bound to the active project (every row has a `room` label)\n\n" +
                  "Plan rules:\n" +
                  "- chitchat / navigation / FAQ: empty plan.\n" +
                  "- EXPLANATORY follow-ups about pieces already discussed ('why the X?', 'tell me more about X', 'what is X?', 'how does it compare', 'what materials', 'lead time?', 'who designed it'): EMPTY PLAN — the downstream model must answer conversationally in prose. Do NOT re-propose tearsheets or quotes.\n" +
                  "- 'show / suggest / curate / mood / room brief' without pricing intent: [propose_tearsheet] (or add_to_tearsheet if they reference an existing board).\n" +
                  "- 'quote / estimate / pricing breakdown' on already-decided pieces: [draft_quote] (or add_to_quote).\n" +
                  "- 'FF&E schedule / multi-room brief / spec the whole apartment / drawing-room + dining + bedroom' bound to a project: [propose_ffe_rows].\n" +
                  "- BRIEF + QUOTE in the SAME turn (e.g. 'pull together a Mayfair drawing-room and quote me'): emit BOTH in order [propose_tearsheet, draft_quote] so the downstream loop chains them on the same picks.\n" +
                  "Be conservative — only emit a tool if the user clearly intends that action this turn. When in doubt between 'reply in prose' and 'emit a tool', prefer empty plan.",
              },
              { role: "user", content: latestUserMessage.slice(0, 1500) },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "plan",
                  description: "Return the structured brief and tool execution plan.",
                  parameters: {
                    type: "object",
                    properties: {
                      intent: { type: "string", enum: ["chitchat", "discovery", "selection", "quote", "selection_and_quote", "navigation"] },
                      summary: { type: "string", description: "One-sentence restatement of what the user is asking for." },
                      room: { type: "string" },
                      style: { type: "string" },
                      materials: { type: "array", items: { type: "string" } },
                      categories: { type: "array", items: { type: "string" } },
                      designers: { type: "array", items: { type: "string" } },
                      qty_hint: { type: "integer", minimum: 1, maximum: 99 },
                      lead_weeks_max: { type: "integer", minimum: 1, maximum: 104 },
                      budget_band: { type: "string" },
                      plan: {
                        type: "array",
                        items: { type: "string", enum: ["propose_tearsheet", "add_to_tearsheet", "draft_quote", "add_to_quote", "propose_ffe_rows"] },
                        maxItems: 3,
                      },
                    },
                    required: ["intent", "plan"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "plan" } },
          }),
        });
        if (!resp.ok) throw new Error(`planner http ${resp.status}`);
        const data = await resp.json();
        const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (!args) throw new Error("planner missing tool_call");
        const p = JSON.parse(args);
        const value: ExtractedBrief = {
          intent: p.intent || "chitchat",
          brief: {
            summary: p.summary || "",
            room: p.room || null,
            style: p.style || null,
            materials: Array.isArray(p.materials) ? p.materials.slice(0, 8) : [],
            categories: Array.isArray(p.categories) ? p.categories.slice(0, 8) : [],
            designers: Array.isArray(p.designers) ? p.designers.slice(0, 8) : [],
            qty_hint: typeof p.qty_hint === "number" ? p.qty_hint : null,
            lead_weeks_max: typeof p.lead_weeks_max === "number" ? p.lead_weeks_max : null,
            budget_band: p.budget_band || null,
          },
          plan: Array.isArray(p.plan) ? p.plan.filter((t: string) => ["propose_tearsheet", "add_to_tearsheet", "draft_quote", "add_to_quote", "propose_ffe_rows"].includes(t)) as BriefPlanTool[] : [],
        };
        return { value, usage: data?.usage };
      },
    );
    logAiUsage({
      feature: "trade-concierge-planner",
      model: SENTIMENT_MODEL,
      usage: result.usage,
      cached: result.cached,
      promptHash: result.promptHash,
      tier: "cheap",
    }).catch(() => {});
    return result.value;
  } catch (e) {
    console.error("brief planner failed:", e);
    return EMPTY_BRIEF;
  }
}

function buildPlanDirective(extracted: ExtractedBrief): string {
  if (!extracted.plan.length) {
    return "(No tool calls planned this turn — reply conversationally. Default tone applies.)";
  }
  const b = extracted.brief;
  const parts: string[] = [];
  if (b.summary) parts.push(`- Summary: ${b.summary}`);
  if (b.room) parts.push(`- Room: ${b.room}`);
  if (b.style) parts.push(`- Style: ${b.style}`);
  if (b.materials.length) parts.push(`- Materials: ${b.materials.join(", ")}`);
  if (b.categories.length) parts.push(`- Categories: ${b.categories.join(", ")}`);
  if (b.designers.length) parts.push(`- Designers of interest: ${b.designers.join(", ")}`);
  if (b.qty_hint) parts.push(`- Quantity hint: ${b.qty_hint}`);
  if (b.lead_weeks_max) parts.push(`- Lead-time ceiling: ${b.lead_weeks_max} weeks`);
  if (b.budget_band) parts.push(`- Budget band: ${b.budget_band}`);

  const planStr = extracted.plan.join(" → ");
  const chained = extracted.plan.includes("propose_tearsheet") && extracted.plan.includes("draft_quote");
  const tail = chained
    ? "CHAINED PLAN — call `propose_tearsheet` first, then immediately call `draft_quote` IN THE SAME RESPONSE, using the exact same pick_ids you used in the tearsheet. Both tool calls must appear in this turn. The user expects one combined plan card."
    : `Call the planned tool${extracted.plan.length > 1 ? "s" : ""}: ${planStr}.`;

  return [
    `Intent: ${extracted.intent}`,
    "Structured brief:",
    parts.length ? parts.join("\n") : "  (no extracted fields)",
    "",
    `Execution plan: ${planStr}`,
    tail,
  ].join("\n");
}

/** Retrieve top-K relevant catalog pieces via pgvector instead of loading 2000 rows. */
async function loadRelevantPieces(

  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  query: string,
  userId: string | null,
  k = 40,
): Promise<{ contextText: string; rows: any[] } | null> {
  if (!apiKey || !query?.trim()) return null;
  try {
    const vec = await embedQuery(apiKey, query);
    if (!vec) return null;
    logAiUsage({
      feature: "trade-concierge-rag",
      model: "openai/text-embedding-3-small",
      usage: { prompt_tokens: Math.ceil(query.length / 4), completion_tokens: 0, total_tokens: Math.ceil(query.length / 4) },
    }).catch(() => {});
    const { data, error } = await supabase.rpc("match_catalog", {
      query_embedding: vec as any,
      match_count: k,
    });
    if (error || !Array.isArray(data) || data.length < 5) {
      if (error) console.error("match_catalog rpc failed:", error.message);
      return null;
    }
    const lines = data.map((r: any) => {
      const meta = [r.subcategory || r.category, r.materials].filter(Boolean).join(" · ");
      return `- "${r.title}" by ${r.designer}${meta ? ` (${meta})` : ""} [id: ${r.id}]`;
    });
    const contextText = [
      "Note: the lines below are the catalog pieces most semantically relevant to the user's latest query (top-K retrieval, not the full catalog). If the user asks for a broad scan and nothing here matches, say so politely and offer to widen the search.",
      "",
      lines.join("\n"),
    ].join("\n");
    return { contextText, rows: data };
  } catch (e) {
    console.error("loadRelevantPieces failed:", e);
    return null;
  }
}

async function recordRagTrace(
  supabase: ReturnType<typeof createClient>,
  payload: {
    userId: string | null;
    query: string;
    rows: any[];
    contextText: string;
    usedInAnswer: boolean;
  },
): Promise<void> {
  try {
    const matches = (payload.rows || []).slice(0, 25).map((r: any) => ({
      id: r.id,
      source: r.source,
      title: r.title,
      designer: r.designer,
      category: r.category,
      subcategory: r.subcategory,
      materials: r.materials,
      similarity: typeof r.similarity === "number" ? Number(r.similarity.toFixed(4)) : null,
    }));
    const top = matches[0]?.similarity ?? null;
    await supabase.from("concierge_rag_traces").insert({
      user_id: payload.userId,
      query: payload.query.slice(0, 2000),
      matches,
      context_text: payload.contextText.slice(0, 8000),
      match_count: payload.rows?.length ?? 0,
      top_similarity: top,
      used_in_answer: payload.usedInAnswer,
    });
  } catch (e) {
    console.error("recordRagTrace failed:", e);
  }
}

function buildSentimentDirective(c: { sentiment: string; intent: string; escalate: boolean }): string {
  if (c.sentiment === "frustrated" || c.intent === "complaint") {
    return "The user appears FRUSTRATED. Open by acknowledging the friction in one sentence ('I hear you — that's not the experience we want'), validate the concern, then offer a concrete next step. Do NOT upsell or pivot to recommendations. Avoid jargon. Keep it human.";
  }
  if (c.sentiment === "anxious" || c.sentiment === "confused") {
    return "The user seems UNCERTAIN. Slow down, confirm what they're trying to achieve, and offer one clear next step rather than several options.";
  }
  if (c.sentiment === "delighted") {
    return "The user is POSITIVE. Match their energy briefly and keep momentum — propose the next logical step (tearsheet, sample, quote) without over-selling.";
  }
  return "Tone: warm, refined, helpful. Default register.";
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

function titleTokens(value: string | null | undefined): string[] {
  return normalizeLoose(value).split(/\s+/).filter((t) => t.length > 2 && !GENERIC_PRODUCT_TOKENS.has(t));
}

function titlesAreNearTwins(a: string, b: string): boolean {
  const an = normalizeLoose(a);
  const bn = normalizeLoose(b);
  if (!an || !bn) return false;
  if (an === bn || an.includes(bn) || bn.includes(an)) return true;
  const aTokens = titleTokens(a);
  const bTokens = titleTokens(b);
  const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens;
  const longer = aTokens.length <= bTokens.length ? bTokens : aTokens;
  if (!shorter.length) return false;
  return shorter.every((token) => longer.includes(token));
}

function formatCatalogPrice(cents: number | null | undefined, currency: string | null | undefined): string | null {
  if (!cents || !currency) return null;
  return `${currency} ${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function summarizeVariants(variants: any, currency: string | null | undefined, pricePerSqmCents?: number | null): string | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const rows = variants
    .filter((v) => v && (Number(v.price_cents) > 0 || (Number(pricePerSqmCents) > 0 && parseRugSqm(variantLabel(v)))))
    .slice(0, 8)
    .map((v) => {
      const label = variantLabel(v);
      const cents = Number(v.price_cents) > 0
        ? Number(v.price_cents)
        : Math.round((parseRugSqm(label) || 0) * Number(pricePerSqmCents || 0));
      const price = formatCatalogPrice(cents, currency);
      return [label || "variant", price].filter(Boolean).join(" — ");
    });
  if (!rows.length) return null;
  return `variants: ${rows.join("; ")}${variants.length > rows.length ? "; …" : ""}`;
}

function parseRugSqm(label: string | null | undefined): number | null {
  const match = String(label || "").match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(cm|m)?/i);
  if (!match) return null;
  const width = parseFloat(match[1].replace(",", "."));
  const length = parseFloat(match[2].replace(",", "."));
  const unit = (match[3] || "cm").toLowerCase();
  if (!(width > 0 && length > 0)) return null;
  const factor = unit === "m" ? 1 : 0.01;
  return width * factor * length * factor;
}

function variantLabel(v: any): string {
  return [v?.base, v?.top, v?.label].filter((s: string) => s && String(s).trim()).join(" — ");
}

function resolveVariantPriceFromPick(row: any, variantLabelValue: string | null | undefined) {
  if (!row || !variantLabelValue || !Array.isArray(row.size_variants)) return null;
  const wanted = normalizeLoose(variantLabelValue);
  const hit = row.size_variants.find((v: any) => {
    const label = normalizeLoose(variantLabel(v));
    return label && (label === wanted || label.includes(wanted) || wanted.includes(label));
  });
  if (!hit) return null;
  if (Number(hit.price_cents) > 0) return { cents: Number(hit.price_cents), currency: row.currency ?? null };
  const rate = Number(row.price_per_sqm_cents);
  const sqm = parseRugSqm(variantLabel(hit) || variantLabelValue);
  if (rate > 0 && sqm) return { cents: Math.round(sqm * rate), currency: row.currency ?? null };
  return null;
}
async function hydratePickPreview(
  supabase: ReturnType<typeof createClient>,
  pickIds: string[],
) {
  if (!pickIds.length) return [];

  // The concierge catalog merges curator picks AND trade_products, so an id
  // may belong to either table. Look both up and prefer curator data when
  // present (richer fields) but fall back to trade_products otherwise.
  const [{ data: picks }, { data: trades }] = await Promise.all([
    supabase
      .from("designer_curator_picks")
      .select("id, title, image_url, materials, category, designer_id")
      .in("id", pickIds),
    supabase
      .from("trade_products")
      .select("id, product_name, brand_name, image_url, materials, category")
      .in("id", pickIds),
  ]);

  const designerIds = Array.from(new Set((picks || []).map((p: any) => p.designer_id).filter(Boolean)));
  const { data: designers } = designerIds.length
    ? await supabase.from("designers").select("id, name, display_name").in("id", designerIds)
    : { data: [] as any[] };
  const dmap = new Map<string, string>();
  (designers || []).forEach((d: any) => dmap.set(d.id, d.display_name || d.name));

  const pickById = new Map((picks || []).map((p: any) => [p.id, p]));
  const tradeById = new Map((trades || []).map((t: any) => [t.id, t]));

  // Build a fallback image map from gallery_hotspots so any product whose
  // main row lacks image_url (e.g. rugs like Giudecca, where the only photo
  // lives on a hotspot) still renders a thumbnail. We always fetch — keyed
  // by normalized product_name AND by brand|name so brand-collision titles
  // (e.g. two "Side Table"s) don't cross over.
  const normName = (s: string) =>
    String(s || "").toLowerCase().replace(/\s*\(.*?\)\s*/g, "").replace(/[^a-z0-9]+/g, "").trim();
  const normBrand = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

  const { data: hotspots } = await supabase
    .from("gallery_hotspots")
    .select("product_name, designer_name, product_image_url")
    .not("product_image_url", "is", null);

  const hotspotByName = new Map<string, string>();
  const hotspotByBrandName = new Map<string, string>();
  (hotspots || []).forEach((h: any) => {
    const nKey = normName(h.product_name);
    if (nKey && !hotspotByName.has(nKey)) hotspotByName.set(nKey, h.product_image_url);
    const bKey = `${normBrand(h.designer_name)}|${nKey}`;
    if (nKey && !hotspotByBrandName.has(bKey)) hotspotByBrandName.set(bKey, h.product_image_url);
  });

  const resolveHotspotImage = (title: string, brand?: string | null) => {
    const nKey = normName(title);
    if (!nKey) return null;
    if (brand) {
      const bKey = `${normBrand(brand)}|${nKey}`;
      const hit = hotspotByBrandName.get(bKey);
      if (hit) return hit;
    }
    return hotspotByName.get(nKey) || null;
  };

  return pickIds
    .map((id) => {
      const p = pickById.get(id);
      if (p) {
        const designer = dmap.get(p.designer_id) || null;
        const fallback = !p.image_url ? resolveHotspotImage(p.title, designer) : null;
        return {
          id: p.id,
          title: p.title,
          image_url: p.image_url || fallback,
          image_from_hotspot: !p.image_url && !!fallback,
          materials: p.materials,
          category: p.category,
          designer_name: designer,
        };
      }
      const t = tradeById.get(id);
      if (t) {
        const rawBrand = String(t.brand_name || "");
        const baseBrand = rawBrand.includes(" - ") ? rawBrand.split(" - ")[0].trim() : rawBrand.trim();
        const fallback = !t.image_url ? resolveHotspotImage(t.product_name, baseBrand) : null;
        return {
          id: t.id,
          title: t.product_name,
          image_url: t.image_url || fallback,
          image_from_hotspot: !t.image_url && !!fallback,
          materials: t.materials,
          category: t.category,
          designer_name: baseBrand || null,
        };
      }
      return null;
    })
    .filter(Boolean);
}

/** Build per-line preview rows for a draft_quote / add_to_quote proposal. */
async function hydrateQuotePreview(
  supabase: ReturnType<typeof createClient>,
  lines: Array<{ pick_id: string; qty: number; variant?: string | null; lead_weeks?: number | null; note?: string | null }>,
  fallbackCurrency: string | null,
  discountPct: number,
) {
  if (!lines.length) return [];
  const pickIds = lines.map((l) => l.pick_id);
  const previews = await hydratePickPreview(supabase, pickIds);
  const previewById = new Map<string, any>(previews.filter(Boolean).map((p: any) => [p.id, p]));

  // Pricing: curator pick/variant first, then the selected trade_products row. The
  // catalog merge above hides stale near-duplicates, but this keeps old proposal
  // cards from displaying a rogue duplicate price if one is still approved.
  const [{ data: pickRows }, { data: tradeRows }] = await Promise.all([
    supabase
      .from("designer_curator_picks")
      .select("id, title, designer_id, trade_price_cents, price_per_sqm_cents, currency, size_variants")
      .in("id", pickIds),
    supabase
      .from("trade_products")
      .select("id, product_name, brand_name, trade_price_cents, rrp_price_cents, currency, price_unit")
      .in("id", pickIds),
  ]);
  const pickPriceById = new Map<string, { cents: number | null; currency: string | null }>();
  (pickRows || []).forEach((p: any) => {
    if (Number(p.trade_price_cents) > 0) {
      pickPriceById.set(p.id, { cents: Number(p.trade_price_cents), currency: p.currency ?? null });
    }
  });
  const tradePriceById = new Map<string, { cents: number | null; currency: string | null }>();
  (tradeRows || []).forEach((t: any) => {
    const cents = t.trade_price_cents ?? t.rrp_price_cents ?? null;
    if (Number(cents) > 0) {
      tradePriceById.set(t.id, { cents: Number(cents), currency: t.currency ?? null });
    }
  });

  const { data: allTradeRows } = (tradeRows?.length || pickRows?.length)
    ? await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, trade_price_cents, rrp_price_cents, currency, price_unit")
        .eq("is_active", true)
        .limit(2000)
    : { data: [] as any[] };


  const canonicalTradePrice = (tradeRow: any) => {
    if (!tradeRow) return null;
    const rowBrand = normalizeLoose(String(tradeRow.brand_name || "").split(" - ")[0]);
    const twins = (allTradeRows || []).filter((c: any) =>
      c.id !== tradeRow.id &&
      normalizeLoose(String(c.brand_name || "").split(" - ")[0]) === rowBrand &&
      titlesAreNearTwins(c.product_name, tradeRow.product_name)
    );
    const best = twins
      .map((c: any) => ({
        row: c,
        cents: c.trade_price_cents ?? c.rrp_price_cents ?? null,
        score: ((c.trade_price_cents ?? c.rrp_price_cents) ? 1000 : 0) + (c.price_unit !== "per_sqm" ? 100 : 0),
      }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best?.cents) return null;
    const currentCents = tradeRow.trade_price_cents ?? tradeRow.rrp_price_cents ?? null;
    if (!currentCents || tradeRow.price_unit === "per_sqm" || best.score > 1000) {
      return { cents: best.cents, currency: best.row.currency ?? null };
    }
    return null;
  };

  const resolveVariantPrice = (pickId: string, selectedVariant: string | null | undefined) =>
    resolveVariantPriceFromPick((pickRows || []).find((p: any) => p.id === pickId), selectedVariant);

  const canonicalTwinPrice = (tradeRow: any) => {
    if (!tradeRow) return null;
    const sameBrandPicks = (pickRows || []).filter((p: any) => {
      const preview = previewById.get(p.id);
      return normalizeLoose(preview?.designer_name) === normalizeLoose(tradeRow.brand_name?.split(" - ")?.[0] || tradeRow.brand_name);
    });
    const twin = sameBrandPicks.find((p: any) => titlesAreNearTwins(p.title, tradeRow.product_name));
    if (!twin) return null;
    const variants = Array.isArray(twin.size_variants) ? twin.size_variants.filter((v: any) => Number(v.price_cents) > 0) : [];
    const cents = variants.length ? Math.min(...variants.map((v: any) => Number(v.price_cents))) : twin.trade_price_cents;
    return cents ? { cents, currency: twin.currency ?? null } : null;
  };

  /** For a curator-pick line with no own price, find a matching trade_products row by brand + near-twin title. */
  const pickToTradePrice = (pickId: string) => {
    const pick = (pickRows || []).find((p: any) => p.id === pickId);
    if (!pick) return null;
    const preview = previewById.get(pickId);
    const designer = normalizeLoose(preview?.designer_name);
    if (!designer) return null;
    const candidates = (allTradeRows || []).filter((c: any) => {
      const brand = normalizeLoose(String(c.brand_name || "").split(" - ")[0]);
      return brand === designer && titlesAreNearTwins(c.product_name, pick.title);
    });
    if (!candidates.length) return null;
    const best = candidates
      .map((c: any) => ({
        row: c,
        cents: c.trade_price_cents ?? c.rrp_price_cents ?? null,
        score: ((c.trade_price_cents ?? c.rrp_price_cents) ? 1000 : 0) + (c.price_unit !== "per_sqm" ? 100 : 0),
      }))
      .filter((x: any) => x.cents)
      .sort((a: any, b: any) => b.score - a.score)[0];
    return best ? { cents: best.cents, currency: best.row.currency ?? null } : null;
  };

  return lines.map((l) => {
    const p = previewById.get(l.pick_id) || null;
    const directTrade = (tradeRows || []).find((t: any) => t.id === l.pick_id);
    const priced =
      resolveVariantPrice(l.pick_id, l.variant) ||
      pickPriceById.get(l.pick_id) ||
      canonicalTwinPrice(directTrade) ||
      canonicalTradePrice(directTrade) ||
      tradePriceById.get(l.pick_id) ||
      pickToTradePrice(l.pick_id) ||
      { cents: null, currency: null };


    // Expose variant options so the proposal card can render a picker.
    const pickRow = (pickRows || []).find((r: any) => r.id === l.pick_id);
    const rawVariants = Array.isArray(pickRow?.size_variants) ? pickRow.size_variants : [];
    const variant_options = rawVariants
      .map((v: any) => {
        const label = variantLabel(v);
        const computed = resolveVariantPriceFromPick(pickRow, label);
        return {
          label,
          price_cents: computed?.cents ?? null,
        };
      })
      .filter((v: any) => v.label);

    return {
      pick_id: l.pick_id,
      title: p?.title || "Unknown piece",
      designer_name: p?.designer_name || null,
      image_url: p?.image_url || null,
      variant: typeof l.variant === "string" && l.variant.trim() ? l.variant.trim() : null,
      qty: Math.max(1, Number(l.qty) || 1),
      unit_price_cents: priced.cents,
      currency: priced.currency || fallbackCurrency || null,
      trade_discount_pct: discountPct <= 1 ? Math.round(discountPct * 10000) / 100 : discountPct,
      lead_weeks: typeof l.lead_weeks === "number" ? l.lead_weeks : null,
      note: typeof l.note === "string" && l.note.trim() ? l.note.trim() : null,
      variant_options: variant_options.length > 1 ? variant_options : undefined,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return new Response(JSON.stringify(auth.body), {
        status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rl = rateLimit(`concierge:${auth.userId}`, 20, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", retry_in: rl.retryInSec }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, project_id: bodyProjectId } = await req.json();
    const activeProjectId: string | null = typeof bodyProjectId === "string" ? bodyProjectId : null;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userId: string = auth.userId;

    // Daily token cap (skip for admins). Soft block with friendly message.
    if (await isOverDailyCap(supabase, userId)) {
      return new Response(
        JSON.stringify({ error: "You've reached today's concierge usage limit. Please come back tomorrow — or reach the team directly for urgent requests." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    // Trim history: keep only the last ~8 turns to control prompt size.
    const trimmedMessages = messages.slice(-8);

    // Quick designer-name fetch to power the two-stage catalog decision.
    const { data: designerNamesRows } = await supabase
      .from("designers")
      .select("name, display_name")
      .eq("is_published", true);
    const designerNames = (designerNamesRows || [])
      .flatMap((d: any) => [d.name, d.display_name])
      .filter(Boolean) as string[];
    const heuristicNeedsPieces = needsFullCatalog(lastUserMsg, designerNames);

    const mentionedProjectIdPromise = activeProjectId ? Promise.resolve(null) : resolveMentionedProjectId(supabase, userId, lastUserMsg);
    // Run sentiment + RAG retrieval in parallel with the rest. RAG is best-effort.
    const ragPromise = (heuristicNeedsPieces || lastUserMsg.length > 40)
      ? loadRelevantPieces(supabase, LOVABLE_API_KEY, lastUserMsg, userId, 40)
      : Promise.resolve(null);
    const [sentiment, extractedBrief, ragResult, userBoards, userSignals, mentionedProjectId, openQuotes, discountRow] = await Promise.all([
      classifySentiment(LOVABLE_API_KEY, lastUserMsg),
      extractBrief(LOVABLE_API_KEY, lastUserMsg),
      ragPromise,
      loadUserBoards(supabase, userId),
      loadUserSignals(supabase, userId),
      mentionedProjectIdPromise,
      loadOpenQuotes(supabase, userId),
      supabase.from("profiles").select("trade_tier").eq("id", userId).maybeSingle(),
    ]);

    // Decide final catalog mode: classifier wins, heuristic is the fallback. RAG replaces full load when it returned anything.
    const includePieces = sentiment.needs_catalog || heuristicNeedsPieces;
    const useRag = includePieces && !!ragResult;
    const { designersList, piecesList: fullPiecesList, showroomBrands } = await loadCatalogContext(supabase, includePieces && !useRag);
    const piecesList = useRag ? (ragResult as { contextText: string }).contextText : fullPiecesList;

    // Fire-and-forget: persist a debug trace of what RAG retrieved for this turn.
    if (ragResult) {
      recordRagTrace(supabase, {
        userId,
        query: lastUserMsg,
        rows: (ragResult as any).rows,
        contextText: (ragResult as any).contextText,
        usedInAnswer: useRag,
      }).catch(() => {});
    }

    const resolvedProjectId = activeProjectId || mentionedProjectId;
    const projectContext = await loadProjectContext(supabase, userId, resolvedProjectId);
    // Resolve trade discount % for this user (defaults to 8%).
    let tradeDiscountPct = 0.08;
    try {
      const tier = (discountRow.data as any)?.trade_tier;
      if (tier) {
        const { data: cfg } = await supabase.from("trade_tier_config").select("discount_pct").eq("tier", tier).maybeSingle();
        if (cfg?.discount_pct != null) tradeDiscountPct = Number(cfg.discount_pct);
      }
    } catch { /* keep default */ }
    const sentimentDirective = buildSentimentDirective(sentiment);
    const planDirective = buildPlanDirective(extractedBrief);
    const systemPrompt = buildSystemPrompt(
      designersList, piecesList, showroomBrands, userBoards, userSignals, sentimentDirective, projectContext, openQuotes, planDirective,
    );
    // The planner's intent + plan supersede the legacy regex when present. If the planner
    // flagged a quote-only turn, restrict the toolset to quote tools. If it flagged a
    // chained selection_and_quote, expose all tools so the model can emit both calls.
    const plannerQuoteOnly = extractedBrief.intent === "quote" && extractedBrief.plan.every((t) => t === "draft_quote" || t === "add_to_quote");
    const isExplicitQuoteIntent = plannerQuoteOnly
      || (extractedBrief.plan.length === 0
        && /\b(quote|estimate|pricing|price breakdown|draft a quote|put together a quote|add .* to .*quote)\b/i.test(lastUserMsg));

    // ----- Stage-based tool gating -----
    // The client prefixes the conversation with a `[Workflow context] Current stage: X.`
    // message. Each stage restricts which concierge tools the model may call, so the
    // proposal it returns matches the surface the user is actually on. Quote stage in
    // particular MUST NOT propose a tearsheet — the user is past curation.
    const stageMatch = (messages as any[])
      .map((m) => (typeof m?.content === "string" ? m.content : ""))
      .reverse()
      .map((c) => c.match(/\[Workflow context\]\s*Current stage:\s*(Discover|Tearsheet|Quote|Order|Project)/i))
      .find((m) => !!m);
    const currentStage = (stageMatch?.[1] || "").toLowerCase() as "" | "discover" | "tearsheet" | "quote" | "order" | "project";
    const STAGE_GATES: Record<string, string[] | null> = {
      tearsheet: ["propose_tearsheet", "add_to_tearsheet"],
      quote: ["draft_quote", "add_to_quote"],
      project: ["propose_ffe_rows", "draft_quote", "add_to_quote"],
      // discover / order / unknown → no stage-level restriction
      discover: null,
      order: null,
      "": null,
    };
    const stageAllowed = STAGE_GATES[currentStage] ?? null;
    const stageForcesQuote = currentStage === "quote";

    const baseAllowed = isExplicitQuoteIntent
      ? ["draft_quote", "add_to_quote"]
      : null;
    const allowedNames = stageAllowed && baseAllowed
      ? stageAllowed.filter((n) => baseAllowed.includes(n))
      : (stageAllowed ?? baseAllowed);
    // `estimate_shipping` is always allowed regardless of stage — shipping
    // questions can come up on any surface and must always hit the live rate matrix.
    const allowedWithShipping = allowedNames
      ? Array.from(new Set([...allowedNames, "estimate_shipping"]))
      : null;
    const availableTools = allowedWithShipping
      ? TOOLS.filter((tool: any) => allowedWithShipping.includes(tool.function?.name))
      : TOOLS;
    // If the gate emptied the toolset (shouldn't happen in practice), fall back to all
    // tools rather than sending an empty `tools: []` array to the upstream gateway.
    const finalTools = availableTools.length > 0 ? availableTools : TOOLS;
    const forceToolCall = isExplicitQuoteIntent || stageForcesQuote;

    // Model router: Flash by default, Pro for complex multi-constraint briefs.
    const chosenModel = pickModel(lastUserMsg, includePieces);

    const upstream = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: chosenModel,
          messages: [{ role: "system", content: systemPrompt }, ...trimmedMessages],
          tools: finalTools,
          tool_choice: forceToolCall ? "required" : "auto",
          max_completion_tokens: chosenModel === modelFor("strong") ? CHAT_MAX_TOKENS_STRONG : CHAT_MAX_TOKENS,
          stream: true,
          stream_options: { include_usage: true },
        }),
      }
    );

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact your administrator." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await upstream.text();
      console.error("AI gateway error:", upstream.status, text);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!upstream.body) {
      return new Response(JSON.stringify({ error: "No response stream" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream interceptor: pass text deltas through, but accumulate any tool_calls
    // and emit a single `event: proposal` SSE frame once the tool call is complete.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // tool_calls arrive as fragments; key by index
    const toolCallBuffers = new Map<number, { id?: string; name?: string; argsText: string }>();
    let buffer = "";
    let capturedUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;
    const usageModel = chosenModel;

    const stream = new ReadableStream({
      async start(controller) {
        // Emit escalation event up-front when the classifier flagged it.
        if (sentiment.escalate) {
          const payload = {
            sentiment: sentiment.sentiment,
            intent: sentiment.intent,
            user_id: userId,
            excerpt: messages.slice(-4),
          };
          controller.enqueue(encoder.encode(`event: escalation\ndata: ${JSON.stringify(payload)}\n\n`));
        }
        const flushProposal = async () => {
          // Deterministic ordering: tearsheets ALWAYS flush before quotes so a
          // chained turn renders as [tearsheet card → quote card] regardless of
          // the index the model chose for each tool call.
          const allBuffers = Array.from(toolCallBuffers.values());
          const tearsheetBuffers = allBuffers.filter((b) => b.name === "propose_tearsheet" || b.name === "add_to_tearsheet");
          const quoteBuffers = allBuffers.filter((b) => b.name === "draft_quote" || b.name === "add_to_quote");
          const ffeBuffers = allBuffers.filter((b) => b.name === "propose_ffe_rows");
          const shippingBuffers = allBuffers.filter((b) => b.name === "estimate_shipping");
          const orderedBuffers = [...tearsheetBuffers, ...quoteBuffers, ...ffeBuffers, ...shippingBuffers];
          if (tearsheetBuffers.length && quoteBuffers.length) {
            console.log(`[concierge flush] chained turn: ${tearsheetBuffers.length} tearsheet + ${quoteBuffers.length} quote proposal(s), flushing tearsheet→quote`);
          }
          for (const tc of orderedBuffers) {
            // ====== QUOTE TOOLS ======
            if (tc.name === "draft_quote" || tc.name === "add_to_quote") {
              let parsed: any = null;
              try { parsed = JSON.parse(tc.argsText || "{}"); } catch (e) {
                console.error("Could not parse quote tool args:", tc.argsText, e);
                continue;
              }
              const rawLines: any[] = Array.isArray(parsed.lines) ? parsed.lines : [];
              const lines = rawLines
                .filter((l) => l && typeof l.pick_id === "string" && Number.isFinite(Number(l.qty)))
                .slice(0, 24)
                .map((l) => ({
                  pick_id: l.pick_id,
                  qty: Math.max(1, Math.min(99, Number(l.qty) || 1)),
                  variant: typeof l.variant === "string" ? l.variant : null,
                  lead_weeks: typeof l.lead_weeks === "number" ? l.lead_weeks : null,
                  note: typeof l.note === "string" ? l.note : null,
                }));
              if (lines.length === 0) continue;

              if (tc.name === "draft_quote") {
                const projectId: string | null =
                  typeof parsed.project_id === "string" && parsed.project_id ? parsed.project_id : resolvedProjectId;
                const requestedCurrency: string | null = typeof parsed.currency === "string" ? parsed.currency.toUpperCase() : null;
                const preview = await hydrateQuotePreview(supabase, lines, requestedCurrency, tradeDiscountPct);
                const previewCurrencies = Array.from(new Set(preview.map((l: any) => l.currency).filter(Boolean)));
                const currency: string | null = requestedCurrency || (previewCurrencies.length === 1 ? previewCurrencies[0] as string : null);
                const proposal = {
                  tool: "draft_quote",
                  tool_call_id: tc.id || crypto.randomUUID(),
                  args: {
                    project_id: projectId,
                    currency,
                    note: typeof parsed.note === "string" ? parsed.note : null,
                    lines,
                  },
                  preview,
                };
                controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
              } else {
                const quoteId: string | null = typeof parsed.quote_id === "string" ? parsed.quote_id : null;
                if (!quoteId) continue;
                // Pull the quote's currency + a human label for the card
                const { data: q } = await supabase
                  .from("trade_quotes")
                  .select("id, currency, notes, project_id, projects:project_id(name)")
                  .eq("id", quoteId)
                  .eq("user_id", userId)
                  .maybeSingle();
                const quoteLabel = (q as any)?.projects?.name || (q as any)?.notes || "your draft quote";
                const currency = (q as any)?.currency || null;
                const preview = await hydrateQuotePreview(supabase, lines, currency, tradeDiscountPct);
                const proposal = {
                  tool: "add_to_quote",
                  tool_call_id: tc.id || crypto.randomUUID(),
                  args: {
                    quote_id: quoteId,
                    quote_label: quoteLabel,
                    note: typeof parsed.note === "string" ? parsed.note : null,
                    lines,
                  },
                  preview,
                };
                controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
              }
              continue;
            }

            // ====== FF&E ROWS (room-tagged schedule) ======
            if (tc.name === "propose_ffe_rows") {
              let parsed: any = null;
              try { parsed = JSON.parse(tc.argsText || "{}"); } catch (e) {
                console.error("Could not parse propose_ffe_rows args:", tc.argsText, e);
                continue;
              }
              const projectId: string | null =
                typeof parsed.project_id === "string" && parsed.project_id ? parsed.project_id : resolvedProjectId;
              if (!projectId) {
                console.warn("[concierge] propose_ffe_rows skipped — no project_id resolvable");
                continue;
              }
              const rawRows: any[] = Array.isArray(parsed.rows) ? parsed.rows : [];
              const rows = rawRows
                .filter((r) => r && typeof r.pick_id === "string" && typeof r.room === "string" && r.room.trim().length > 0)
                .slice(0, 60)
                .map((r) => ({
                  pick_id: r.pick_id,
                  room: r.room.trim(),
                  qty: Math.max(1, Math.min(99, Number(r.qty) || 1)),
                  variant: typeof r.variant === "string" ? r.variant : null,
                  lead_weeks: typeof r.lead_weeks === "number" ? r.lead_weeks : null,
                  note: typeof r.note === "string" ? r.note : null,
                }));
              if (rows.length === 0) continue;

              const requestedCurrency: string | null =
                typeof parsed.currency === "string" ? parsed.currency.toUpperCase() : null;
              const lineShape = rows.map((r) => ({
                pick_id: r.pick_id, qty: r.qty, variant: r.variant, lead_weeks: r.lead_weeks, note: r.note,
              }));
              const linePreviews = await hydrateQuotePreview(supabase, lineShape, requestedCurrency, tradeDiscountPct);
              const previewById = new Map<string, any>(linePreviews.map((p: any) => [p.pick_id, p]));
              const preview = rows.map((r) => ({
                ...(previewById.get(r.pick_id) || { pick_id: r.pick_id, title: r.pick_id, qty: r.qty }),
                room: r.room,
              }));
              const previewCurrencies = Array.from(new Set(preview.map((p: any) => p.currency).filter(Boolean)));
              const currency: string | null =
                requestedCurrency || (previewCurrencies.length === 1 ? (previewCurrencies[0] as string) : null);

              let projectName: string | null = null;
              if (userId) {
                const { data: proj } = await supabase
                  .from("projects").select("name").eq("id", projectId).eq("user_id", userId).maybeSingle();
                projectName = (proj as any)?.name || null;
              }

              const proposal = {
                tool: "propose_ffe_rows",
                tool_call_id: tc.id || crypto.randomUUID(),
                args: {
                  project_id: projectId,
                  project_name: projectName,
                  currency,
                  note: typeof parsed.note === "string" ? parsed.note : null,
                  rows,
                },
                preview,
              };
              controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
              console.log(`[concierge] emitted propose_ffe_rows proposal: ${rows.length} rows across ${new Set(rows.map((r) => r.room)).size} room(s) for project ${projectId}`);
              continue;
            }

            // ====== SHIPPING ESTIMATE ======
            // Runs the live rate matrix server-side, then makes a follow-up
            // non-streaming gateway call so the AI writes prose with the real
            // numbers. We stream the resulting text out as synthetic SSE deltas
            // so the existing client-side `onDelta` handler renders it.
            if (tc.name === "estimate_shipping") {
              let parsed: any = null;
              try { parsed = JSON.parse(tc.argsText || "{}"); } catch (e) {
                console.error("Could not parse estimate_shipping args:", tc.argsText, e);
                continue;
              }
              let result: any;
              try {
                result = await runShippingEstimate(supabase, parsed);
              } catch (e) {
                console.error("[concierge] estimate_shipping failed:", e);
                result = { available: false, reason: "Estimator error — please try again." };
              }
              console.log(`[concierge shipping] ${parsed.origin_country}→${parsed.dest_country} ${parsed.preferred_mode || "auto"} → total ${result.total_cents}`);

              // Follow-up: ask the model to summarise the breakdown in prose,
              // in the user's currency, citing the carrier / mode / transit.
              try {
                const followupSystem = [
                  "You are the Maison Affluency Trade Concierge — shipping desk follow-up.",
                  "The user just asked for a shipping/landed-cost estimate. The TOOL_RESULT below is the AUTHORITATIVE figure from our live rate matrix (carriers, brackets, surcharges, duty, VAT). DO NOT recompute or second-guess the numbers — quote them verbatim.",
                  "Write a concise breakdown (max ~120 words) listing: freight, fuel surcharge, insurance, customs/handling, last-mile, duty (with %), VAT/GST (with %), and the TOTAL. Mention the selected carrier, mode and transit-day window. All money values are in CENTS — divide by 100 and format as the currency shown. If `available: false`, apologise and offer a manual quote — do not invent numbers.",
                ].join("\n");
                const followupMessages = [
                  { role: "system", content: followupSystem },
                  { role: "user", content: lastUserMsg.slice(0, 600) },
                  {
                    role: "assistant",
                    content: null,
                    tool_calls: [{
                      id: tc.id || "call_shipping",
                      type: "function",
                      function: { name: "estimate_shipping", arguments: tc.argsText || "{}" },
                    }],
                  },
                  {
                    role: "tool",
                    tool_call_id: tc.id || "call_shipping",
                    name: "estimate_shipping",
                    content: JSON.stringify(result),
                  },
                ];
                const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: modelFor("balanced"),
                    max_completion_tokens: CHAT_MAX_TOKENS,
                    messages: followupMessages,
                  }),
                });
                if (resp.ok) {
                  const data = await resp.json();
                  if (data?.usage) {
                    logAiUsage({
                      feature: "trade-concierge-shipping",
                      model: modelFor("balanced"),
                      usage: data.usage,
                      userId,
                    }).catch(() => {});
                  }
                  const text: string = data?.choices?.[0]?.message?.content || "";
                  if (text) {
                    // Stream as a single synthetic delta so the existing
                    // client handler renders it inline with the assistant bubble.
                    const synthetic = { choices: [{ delta: { content: text } }] };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(synthetic)}\n\n`));
                  }
                } else {
                  console.error("[concierge shipping] follow-up http", resp.status, await resp.text());
                }
              } catch (e) {
                console.error("[concierge shipping] follow-up failed:", e);
              }
              continue;
            }

            if (tc.name !== "propose_tearsheet" && tc.name !== "add_to_tearsheet") continue;
            let parsed: any = null;
            try { parsed = JSON.parse(tc.argsText || "{}"); } catch (e) {
              console.error("Could not parse tool args:", tc.argsText, e);
              continue;
            }
            const pickIds: string[] = Array.isArray(parsed.pick_ids) ? parsed.pick_ids : [];
            const rationaleMap: Record<string, { reason: string; detail?: string }> = {};
            if (Array.isArray(parsed.pick_rationales)) {
              for (const r of parsed.pick_rationales) {
                if (r && typeof r.id === "string" && typeof r.reason === "string") {
                  rationaleMap[r.id] = {
                    reason: r.reason.trim(),
                    detail: typeof r.detail === "string" && r.detail.trim() ? r.detail.trim() : undefined,
                  };
                }
              }
            }
            const previewRaw = await hydratePickPreview(supabase, pickIds);
            const preview = previewRaw.map((p: any) => {
              const r = p && rationaleMap[p.id];
              if (!r) return p;
              return { ...p, rationale: r.reason, rationale_detail: r.detail || null };
            });

            if (tc.name === "add_to_tearsheet") {
              const boardId: string | null = typeof parsed.board_id === "string" ? parsed.board_id : null;
              // Lookup the board's current title for the card
              let boardTitle = "your tearsheet";
              if (boardId && userId) {
                const { data: b } = await supabase
                  .from("client_boards")
                  .select("title")
                  .eq("id", boardId)
                  .eq("user_id", userId)
                  .maybeSingle();
                if (b?.title) boardTitle = b.title;
              }
              const proposal = {
                tool: "add_to_tearsheet",
                tool_call_id: tc.id || crypto.randomUUID(),
                args: {
                  board_id: boardId,
                  board_title: boardTitle,
                  pick_ids: pickIds,
                  note: typeof parsed.note === "string" ? parsed.note : null,
                  pick_rationales: rationaleMap,
                },
                preview,
              };
              controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
            } else {
              const proposal = {
                tool: "propose_tearsheet",
                tool_call_id: tc.id || crypto.randomUUID(),
                args: {
                  title: typeof parsed.title === "string" ? parsed.title : "Untitled tearsheet",
                  pick_ids: pickIds,
                  note: typeof parsed.note === "string" ? parsed.note : null,
                  pick_rationales: rationaleMap,
                },
                preview,
              };
              controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
            }
          }
        };

        // ----- Symmetric back-fill (quote-only → synthesize tearsheet) -----
        // If the planner expected both a tearsheet and a quote but the model only
        // emitted draft_quote, synthesize a propose_tearsheet tool-call buffer
        // from the quote's pick_ids. We inject it into `toolCallBuffers` so the
        // deterministic flushProposal() ordering emits the tearsheet card first,
        // then the quote card, then [DONE]. No extra LLM call required — the
        // pick_ids and title are derivable from the quote args and the planner brief.
        const backfillTearsheetIfNeeded = () => {
          // Stage gate: never synthesize a tearsheet when the user is on the Quote stage.
          if (stageForcesQuote) return;
          const wantsTearsheet =
            extractedBrief.plan.includes("propose_tearsheet") ||
            extractedBrief.plan.includes("add_to_tearsheet");
          if (!wantsTearsheet) return;
          const buffers = Array.from(toolCallBuffers.entries());
          const hasTearsheet = buffers.some(([, b]) => b.name === "propose_tearsheet" || b.name === "add_to_tearsheet");
          if (hasTearsheet) return;
          const quoteEntry = buffers.find(([, b]) => b.name === "draft_quote" || b.name === "add_to_quote");
          if (!quoteEntry) return;
          let parsed: any = null;
          try { parsed = JSON.parse(quoteEntry[1].argsText || "{}"); } catch { return; }
          const rawLines: any[] = Array.isArray(parsed.lines) ? parsed.lines : [];
          const pickIds = Array.from(new Set(
            rawLines
              .map((l: any) => (l && typeof l.pick_id === "string" ? l.pick_id : null))
              .filter((id: string | null): id is string => !!id),
          )).slice(0, 16);
          if (pickIds.length === 0) return;

          // Derive a tearsheet title from the planner brief; fallback to a generic label.
          const room = extractedBrief.brief.room;
          const style = extractedBrief.brief.style;
          const titleBits = [style, room].filter((s) => typeof s === "string" && s.trim().length > 0);
          const title = titleBits.length
            ? `${titleBits.join(" ")} — selected pieces`
            : "Selected pieces";

          // Allocate a synthetic buffer index that won't collide with existing ones.
          const maxIdx = buffers.reduce((m, [i]) => (i > m ? i : m), -1);
          const syntheticIdx = maxIdx + 1;
          toolCallBuffers.set(syntheticIdx, {
            id: `synthetic-tearsheet-${crypto.randomUUID()}`,
            name: "propose_tearsheet",
            argsText: JSON.stringify({
              title,
              pick_ids: pickIds,
              note: "Auto-generated from quote draft to keep the brief and quote in sync.",
            }),
          });
          console.log(`[concierge backfill] synthesized propose_tearsheet (${pickIds.length} picks) from draft_quote`);
        };

        // ----- Inner orchestration loop (Step 4) -----
        // After the main stream finishes, if the upstream planner asked for a
        // chained `propose_tearsheet → draft_quote` but the model only emitted
        // the tearsheet, run a follow-up non-streaming call that forces
        // `draft_quote` using the SAME pick_ids. Emits a second `event: proposal`
        // so the client renders one combined plan (tearsheet card + quote card).
        const runChainIfNeeded = async () => {
          if (!extractedBrief.plan.includes("draft_quote")) return;
          if (!extractedBrief.plan.includes("propose_tearsheet") && !extractedBrief.plan.includes("add_to_tearsheet")) return;
          const hasQuote = Array.from(toolCallBuffers.values()).some((tc) => tc.name === "draft_quote" || tc.name === "add_to_quote");
          if (hasQuote) return;
          let tearsheetPickIds: string[] | null = null;
          let tearsheetTitle: string | null = null;
          for (const tc of toolCallBuffers.values()) {
            if (tc.name !== "propose_tearsheet" && tc.name !== "add_to_tearsheet") continue;
            try {
              const parsed = JSON.parse(tc.argsText || "{}");
              if (Array.isArray(parsed.pick_ids) && parsed.pick_ids.length > 0) {
                tearsheetPickIds = parsed.pick_ids.slice(0, 16);
                tearsheetTitle = typeof parsed.title === "string" ? parsed.title : null;
              }
            } catch { /* ignore */ }
          }
          if (!tearsheetPickIds || tearsheetPickIds.length === 0) return;

          const qtyHint = extractedBrief.brief.qty_hint || 1;
          const leadCeiling = extractedBrief.brief.lead_weeks_max || null;
          const followupSystem = [
            "You are the Maison Affluency Trade Concierge follow-up step.",
            `The user's tearsheet pick_ids are: ${tearsheetPickIds.join(", ")}.`,
            `Active project_id (if any): ${resolvedProjectId || "null"}.`,
            `Default qty per line: ${qtyHint}.${leadCeiling ? ` Lead-time ceiling: ${leadCeiling} weeks.` : ""}`,
            "Call draft_quote NOW with one line per pick_id above (use the qty hint unless the brief implies otherwise). Do not output any prose.",
          ].join("\n");

          try {
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: modelFor("balanced"),
                max_completion_tokens: CHAT_MAX_TOKENS,
                messages: [
                  { role: "system", content: followupSystem },
                  { role: "user", content: lastUserMsg.slice(0, 800) },
                ],
                tools: TOOLS.filter((t: any) => t.function?.name === "draft_quote"),
                tool_choice: { type: "function", function: { name: "draft_quote" } },
              }),
            });
            if (!resp.ok) { console.error("chain draft_quote http", resp.status); return; }
            const data = await resp.json();
            if (data?.usage) {
              logAiUsage({
                feature: "trade-concierge-chain-quote",
                model: modelFor("balanced"),
                usage: data.usage,
                userId,
              }).catch(() => {});
            }
            const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
            if (!args) return;
            const parsed = JSON.parse(args);
            const rawLines: any[] = Array.isArray(parsed.lines) ? parsed.lines : [];
            const lines = rawLines
              .filter((l) => l && typeof l.pick_id === "string" && tearsheetPickIds!.includes(l.pick_id))
              .slice(0, 24)
              .map((l) => ({
                pick_id: l.pick_id,
                qty: Math.max(1, Math.min(99, Number(l.qty) || qtyHint)),
                variant: typeof l.variant === "string" ? l.variant : null,
                lead_weeks: typeof l.lead_weeks === "number" ? l.lead_weeks : null,
                note: typeof l.note === "string" ? l.note : null,
              }));
            if (lines.length === 0) return;
            const requestedCurrency: string | null = typeof parsed.currency === "string" ? parsed.currency.toUpperCase() : null;
            const preview = await hydrateQuotePreview(supabase, lines, requestedCurrency, tradeDiscountPct);
            const previewCurrencies = Array.from(new Set(preview.map((l: any) => l.currency).filter(Boolean)));
            const currency: string | null = requestedCurrency || (previewCurrencies.length === 1 ? previewCurrencies[0] as string : null);
            const proposal = {
              tool: "draft_quote",
              tool_call_id: crypto.randomUUID(),
              args: {
                project_id: resolvedProjectId,
                currency,
                note: tearsheetTitle ? `Chained quote from "${tearsheetTitle}" tearsheet` : null,
                lines,
              },
              preview,
            };
            controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
            console.log(`[concierge chain] emitted draft_quote with ${lines.length} lines from tearsheet "${tearsheetTitle}"`);
          } catch (e) {
            console.error("chain draft_quote failed:", e);
          }
        };

        let sawDone = false;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);

              // Pass through SSE comments / blanks unchanged
              if (line === "" || line.startsWith(":")) {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }
              if (!line.startsWith("data: ")) {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }

              const payload = line.slice(6).trim();
              if (payload === "[DONE]") {
                // Defer the terminator: we still need to flush proposals and
                // possibly emit a chained draft_quote BEFORE the client sees [DONE].
                sawDone = true;
                continue;
              }

              try {
                const obj = JSON.parse(payload);
                if (obj.usage && typeof obj.usage === "object") {
                  capturedUsage = obj.usage;
                }
                const delta = obj.choices?.[0]?.delta;
                const toolCalls = delta?.tool_calls;
                if (Array.isArray(toolCalls)) {
                  for (const tc of toolCalls) {
                    const idx = typeof tc.index === "number" ? tc.index : 0;
                    const buf = toolCallBuffers.get(idx) ?? { argsText: "" };
                    if (tc.id) buf.id = tc.id;
                    if (tc.function?.name) buf.name = tc.function.name;
                    if (typeof tc.function?.arguments === "string") buf.argsText += tc.function.arguments;
                    toolCallBuffers.set(idx, buf);
                  }
                  // Don't forward raw tool_call deltas to the client; we emit a proposal event instead.
                  continue;
                }
                // Plain text delta — forward unchanged
                controller.enqueue(encoder.encode(line + "\n"));
              } catch {
                // Forward unparseable lines as-is so the client can attempt recovery
                controller.enqueue(encoder.encode(line + "\n"));
              }
            }
          }
          // Stream fully consumed.
          // (1) Symmetric back-fill: if the model emitted ONLY a quote but the planner
          //     also expected a tearsheet, synthesize a propose_tearsheet buffer from
          //     the quote's pick_ids BEFORE flushProposal so deterministic ordering
          //     (tearsheet → quote) holds without buffering SSE writes.
          backfillTearsheetIfNeeded();
          await flushProposal();
          // (2) Reverse back-fill: tearsheet emitted but quote missing — forces a
          //     draft_quote follow-up and emits it after the tearsheet card.
          await runChainIfNeeded();
          if (sawDone) controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        } catch (e) {
          console.error("stream interceptor error:", e);
        } finally {
          // Persist token usage (best-effort; never blocks the stream close)
          if (capturedUsage) {
            const pt = Number(capturedUsage.prompt_tokens ?? 0);
            const ct = Number(capturedUsage.completion_tokens ?? 0);
            const tt = Number(capturedUsage.total_tokens ?? pt + ct);
            console.log(`[concierge usage] user=${userId} model=${usageModel} prompt=${pt} completion=${ct} total=${tt}`);
            try {
              await supabase.from("trade_concierge_usage").insert({
                user_id: userId,
                project_id: activeProjectId,
                model: usageModel,
                prompt_tokens: pt,
                completion_tokens: ct,
                total_tokens: tt,
                message_count: messages.length,
                sentiment: sentiment?.sentiment ?? null,
                intent: sentiment?.intent ?? null,
              });
            } catch (logErr) {
              console.error("usage log insert failed:", logErr);
            }
            logAiUsage({
              feature: "trade-concierge",
              model: usageModel,
              usage: { prompt_tokens: pt, completion_tokens: ct, total_tokens: tt },
              userId,
            }).catch(() => {});
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("trade-concierge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
