import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireUser, rateLimit } from "../_shared/auth.ts";
import { logAiUsage } from "../_shared/aiUsage.ts";
import { modelFor, tokenBudget } from "../_shared/aiModels.ts";
import { embedQuery } from "../_shared/aiEmbeddings.ts";

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
];

function buildSystemPrompt(
  designersList: string,
  piecesList: string,
  showroomBrands: string,
  userBoards: string,
  userSignals: string,
  sentimentDirective: string,
  projectContext: string,
  openQuotes: string,
) {
  return `You are the Maison Affluency Trade Concierge — a knowledgeable, refined assistant for professional interior designers, architects, and specifiers sourcing collectible and limited-edition furniture, lighting, and objets d'art.

Your tone is warm yet polished, like a well-informed gallery advisor. Keep answers concise (2-4 sentences unless detail is requested).

## USER SIGNALS (predictive personalization)
Use these signals to anticipate the user's needs. Open with a relevant suggestion when natural ("Want me to add the new Pouénat sconce to your *Mayfair townhouse* board?"), bias your recommendations toward designers, materials and categories they have engaged with, and reference their active projects/tearsheets by name. NEVER expose raw IDs or internal data — only weave the insights into natural prose.
${userSignals}

## EMOTIONAL TONE DIRECTIVE
${sentimentDirective}

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
    `${designer.trim().toLowerCase()}::${title.trim().toLowerCase()}`;

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

/** Run a fast classifier on the latest user message to detect sentiment + intent. */
async function classifySentiment(
  apiKey: string,
  latestUserMessage: string,
): Promise<{ sentiment: string; intent: string; escalate: boolean }> {
  const fallback = { sentiment: "neutral", intent: "question", escalate: false };
  if (!latestUserMessage || latestUserMessage.length < 2) return fallback;

  try {
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
              "Classify the user's latest message in a luxury B2B furniture concierge chat. Return JSON only via the tool call. Be conservative — only flag escalate=true when the user is clearly frustrated, complains repeatedly, threatens to leave, or explicitly asks for a human.",
          },
          { role: "user", content: latestUserMessage.slice(0, 1500) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify",
              description: "Return sentiment + intent + escalation flag.",
              parameters: {
                type: "object",
                properties: {
                  sentiment: { type: "string", enum: ["neutral", "delighted", "curious", "frustrated", "confused", "anxious"] },
                  intent: { type: "string", enum: ["question", "request", "complaint", "compliment", "smalltalk", "spec_help", "pricing", "lead_time"] },
                  escalate: { type: "boolean", description: "True when a human concierge should step in." },
                },
                required: ["sentiment", "intent", "escalate"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify" } },
      }),
    });
    if (!resp.ok) return fallback;
    const data = await resp.json();
    logAiUsage({ feature: "trade-concierge-sentiment", model: SENTIMENT_MODEL, usage: data?.usage }).catch(() => {});
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return fallback;
    const parsed = JSON.parse(args);
    return {
      sentiment: parsed.sentiment || "neutral",
      intent: parsed.intent || "question",
      escalate: !!parsed.escalate,
    };
  } catch (e) {
    console.error("sentiment classifier failed:", e);
    return fallback;
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
    const includePieces = needsFullCatalog(lastUserMsg, designerNames);

    const mentionedProjectIdPromise = activeProjectId ? Promise.resolve(null) : resolveMentionedProjectId(supabase, userId, lastUserMsg);
    const [{ designersList, piecesList, showroomBrands }, userBoards, userSignals, sentiment, mentionedProjectId, openQuotes, discountRow] = await Promise.all([
      loadCatalogContext(supabase, includePieces),
      loadUserBoards(supabase, userId),
      loadUserSignals(supabase, userId),
      classifySentiment(LOVABLE_API_KEY, lastUserMsg),
      mentionedProjectIdPromise,
      loadOpenQuotes(supabase, userId),
      supabase.from("profiles").select("trade_tier").eq("id", userId).maybeSingle(),
    ]);
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
    const systemPrompt = buildSystemPrompt(
      designersList, piecesList, showroomBrands, userBoards, userSignals, sentimentDirective, projectContext, openQuotes,
    );
    const isExplicitQuoteIntent = /\b(quote|estimate|pricing|price breakdown|draft a quote|put together a quote|add .* to .*quote)\b/i.test(lastUserMsg);
    const availableTools = isExplicitQuoteIntent
      ? TOOLS.filter((tool: any) => ["draft_quote", "add_to_quote"].includes(tool.function?.name))
      : TOOLS;

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
          tools: availableTools,
          tool_choice: isExplicitQuoteIntent ? "required" : "auto",
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
          for (const tc of toolCallBuffers.values()) {
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
                await flushProposal();
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
          // Stream ended without [DONE] — still flush any pending proposal
          await flushProposal();
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
