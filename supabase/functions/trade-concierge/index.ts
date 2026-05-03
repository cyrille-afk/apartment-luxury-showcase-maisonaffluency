import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
];

function buildSystemPrompt(
  designersList: string,
  piecesList: string,
  showroomBrands: string,
  userBoards: string,
  userSignals: string,
  sentimentDirective: string,
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

async function loadCatalogContext(supabase: ReturnType<typeof createClient>) {
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
  // tearsheet tools).
  const { data: picks } = await supabase
    .from("designer_curator_picks")
    .select("id, title, materials, category, subcategory, designer_id")
    .order("designer_id", { ascending: true })
    .order("title", { ascending: true })
    .limit(2000);

  // Fetch the trade_products catalog so the assistant can SEE every active
  // piece (not just the curator subset). Merged below by (brand,title) so
  // we never list the same item twice.
  const { data: tradeAll } = await supabase
    .from("trade_products")
    .select("id, product_name, brand_name, materials, category, subcategory")
    .eq("is_active", true)
    .order("brand_name", { ascending: true })
    .order("product_name", { ascending: true })
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
    if (merged.has(k)) return; // curator pick already covers it
    merged.set(k, {
      id: t.id,
      title: t.product_name,
      designer,
      materials: t.materials || null,
      category: t.category || null,
      subcategory: t.subcategory || null,
    });
  });

  const pieceLines = Array.from(merged.values())
    .sort((a, b) => a.designer.localeCompare(b.designer) || a.title.localeCompare(b.title))
    .map((p) => {
      const meta = [p.subcategory || p.category, p.materials].filter(Boolean).join(" · ");
      return `- "${p.title}" by ${p.designer}${meta ? ` (${meta})` : ""} [id: ${p.id}]`;
    });

  const brandSet = new Set<string>();
  (hotspotBrands || []).forEach((h: any) => { if (h.designer_name) brandSet.add(h.designer_name); });
  (tradeAll || []).forEach((t: any) => { if (t.brand_name) brandSet.add(t.brand_name); });
  const showroomBrandLines = Array.from(brandSet).sort().map(b => `- ${b}`);

  return {
    designersList: designerLines.join("\n") || "No designers currently loaded.",
    piecesList: pieceLines.join("\n") || "No pieces currently loaded.",
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
    .map((b: any) => {
      const meta = [b.client_name, b.status].filter(Boolean).join(" · ");
      return `- "${b.title || "Untitled"}"${meta ? ` (${meta})` : ""} [board_id: ${b.id}]`;
    })
    .join("\n");
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
        model: "google/gemini-2.5-flash-lite",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

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

    // Try to extract a user from the bearer token (optional — function is anon-callable).
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const { data: u } = await supabase.auth.getUser(token);
      userId = u?.user?.id || null;
    }

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    const [{ designersList, piecesList, showroomBrands }, userBoards, userSignals, sentiment] = await Promise.all([
      loadCatalogContext(supabase),
      loadUserBoards(supabase, userId),
      loadUserSignals(supabase, userId),
      classifySentiment(LOVABLE_API_KEY, lastUserMsg),
    ]);
    const sentimentDirective = buildSentimentDirective(sentiment);
    const systemPrompt = buildSystemPrompt(
      designersList, piecesList, showroomBrands, userBoards, userSignals, sentimentDirective,
    );

    const upstream = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          tools: TOOLS,
          tool_choice: "auto",
          stream: true,
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

    const stream = new ReadableStream({
      async start(controller) {
        const flushProposal = async () => {
          for (const tc of toolCallBuffers.values()) {
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
