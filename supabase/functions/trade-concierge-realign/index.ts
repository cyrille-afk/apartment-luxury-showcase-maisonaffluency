// Cascading re-align: given the user's LOCKED anchors + EXCLUDED skips +
// UNLOCKED current items, propose a DELTA (replacements/additions/removals)
// that keeps the design coherent. Locked and excluded ids are guaranteed
// untouched by post-filtering.
//
// Candidate pool: designer_curator_picks rows whose category/subcategory
// overlaps the unlocked items' categories. We ship 40 rows to the model and
// ask it to pick from them by id only — no free-text invention.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const TIMEOUT_MS = 20_000;

type Item = {
  pick_id: string;
  title: string;
  designer_name: string | null;
  materials: string | null;
  category: string | null;
};

type Body = {
  title: string;
  locked: Item[];   // frozen anchors
  excluded: Item[]; // user-skipped, must never come back
  unlocked: Item[]; // current unlocked+kept items — replaceable
};

type NewPickPreview = {
  id: string;
  title: string;
  image_url: string | null;
  materials: string | null;
  category: string | null;
  designer_name: string | null;
};

type Delta = {
  replacements: { old_pick_id: string; new_pick_id: string; reason: string }[];
  additions:    { new_pick_id: string; reason: string }[];
  removals:     { pick_id: string; reason: string }[];
  new_previews: NewPickPreview[];
  summary: string;
};

const empty = (summary: string): Delta => ({
  replacements: [], additions: [], removals: [], new_previews: [], summary,
});

const SYSTEM = `You are the Re-aligner — a senior curator revising a tearsheet draft.
The user has LOCKED some pieces (frozen anchors, DO NOT touch or reference for removal).
They EXCLUDED others (rejected, never propose them again).
You may propose changes ONLY to the UNLOCKED list.

You are given a CANDIDATE POOL of alternative pieces from the catalog. You may ONLY reference:
- ids from UNLOCKED (for removals / old_pick_id)
- ids from CANDIDATE_POOL (for new_pick_id / additions)
Never invent an id. Never propose LOCKED ids for removal. Never propose EXCLUDED ids as additions.

Return a compact JSON delta. Prefer FEW, high-quality moves over many. Aim for 1-4 replacements total.

Output STRICT JSON only, no code fences:
{
  "summary": "One editorial sentence explaining the shift.",
  "replacements": [{ "old_pick_id": "...", "new_pick_id": "...", "reason": "why this swap tightens the set" }],
  "additions":    [{ "new_pick_id": "...", "reason": "why this fills a gap the locks reveal" }],
  "removals":     [{ "pick_id": "...", "reason": "why this piece no longer fits" }]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !SUPABASE_URL || !SERVICE_KEY) {
    return json(500, empty("Server missing required env vars."));
  }

  let body: Body;
  try { body = await req.json(); } catch { return json(400, empty("Invalid JSON body.")); }
  if (!Array.isArray(body?.locked) || !Array.isArray(body?.unlocked)) {
    return json(400, empty("locked and unlocked must be arrays."));
  }

  const lockedIds = new Set(body.locked.map((i) => i.pick_id));
  const excludedIds = new Set((body.excluded || []).map((i) => i.pick_id));
  const unlockedIds = new Set(body.unlocked.map((i) => i.pick_id));
  const seenIds = new Set<string>([...lockedIds, ...excludedIds, ...unlockedIds]);

  if (body.unlocked.length === 0) {
    return json(200, empty("Nothing unlocked to re-align."));
  }

  // Extract category tokens from unlocked items to build the candidate pool.
  const catTokens = new Set<string>();
  for (const it of body.unlocked) {
    const c = String(it.category || "").trim();
    if (c) catTokens.add(c);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  let candidates: any[] = [];
  try {
    if (catTokens.size > 0) {
      // Build an OR filter: category or subcategory ilike any token.
      const parts: string[] = [];
      for (const t of catTokens) {
        const esc = t.replace(/[,()]/g, " ").trim();
        if (!esc) continue;
        parts.push(`category.ilike.%${esc}%`);
        parts.push(`subcategory.ilike.%${esc}%`);
      }
      const orExpr = parts.join(",");
      const { data } = await supabase
        .from("designer_curator_picks")
        .select("id, title, image_url, materials, category, subcategory, designer_id")
        .or(orExpr)
        .limit(80);
      candidates = data || [];
    }
  } catch (e) {
    console.warn("[realign] candidate query failed", (e as Error)?.message);
  }

  // Attach designer names, then filter and cap.
  const designerIds = Array.from(new Set(candidates.map((c) => c.designer_id).filter(Boolean)));
  let designerMap = new Map<string, string>();
  if (designerIds.length) {
    try {
      const { data: dRows } = await supabase
        .from("designers")
        .select("id, name")
        .in("id", designerIds);
      for (const d of dRows || []) designerMap.set(d.id, d.name);
    } catch { /* non-fatal */ }
  }

  const pool = candidates
    .filter((c) => !seenIds.has(c.id))
    .slice(0, 40)
    .map((c) => ({
      id: c.id,
      title: c.title,
      designer_name: designerMap.get(c.designer_id) || null,
      category: c.category || c.subcategory || null,
      materials: c.materials || null,
    }));

  const poolIds = new Set(pool.map((p) => p.id));

  if (pool.length === 0) {
    return json(200, empty("No catalog alternatives matched the unlocked categories."));
  }

  const userPayload = {
    TITLE: body.title,
    LOCKED: body.locked,
    UNLOCKED: body.unlocked,
    EXCLUDED: body.excluded || [],
    CANDIDATE_POOL: pool,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let delta: Delta;
  try {
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });
    if (!resp.ok) {
      if (resp.status === 429) return json(200, empty("Re-aligner rate-limited — please retry."));
      if (resp.status === 402) return json(200, empty("Re-aligner unavailable — AI credits exhausted."));
      return json(200, empty(`Re-aligner unavailable (${resp.status}).`));
    }
    const j = await resp.json().catch(() => null);
    const raw = j?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return json(200, empty("Re-aligner returned no content."));
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) { try { parsed = JSON.parse(fence[1]); } catch { /* fall through */ } }
    }
    if (!parsed) return json(200, empty("Re-aligner response could not be parsed."));

    // Enforce locks and candidate-pool membership. Also dedupe.
    const replacements = (Array.isArray(parsed.replacements) ? parsed.replacements : [])
      .filter((r: any) =>
        r &&
        typeof r.old_pick_id === "string" &&
        typeof r.new_pick_id === "string" &&
        unlockedIds.has(r.old_pick_id) &&      // old must be an unlocked kept item
        !lockedIds.has(r.old_pick_id) &&        // never remove a locked anchor
        poolIds.has(r.new_pick_id) &&           // new must come from pool
        !excludedIds.has(r.new_pick_id) &&      // never resurrect a skipped id
        !lockedIds.has(r.new_pick_id))
      .slice(0, 8)
      .map((r: any) => ({
        old_pick_id: String(r.old_pick_id),
        new_pick_id: String(r.new_pick_id),
        reason: String(r.reason || "").slice(0, 240),
      }));

    const additions = (Array.isArray(parsed.additions) ? parsed.additions : [])
      .filter((a: any) =>
        a && typeof a.new_pick_id === "string" &&
        poolIds.has(a.new_pick_id) &&
        !excludedIds.has(a.new_pick_id) &&
        !lockedIds.has(a.new_pick_id) &&
        !unlockedIds.has(a.new_pick_id))
      .slice(0, 4)
      .map((a: any) => ({
        new_pick_id: String(a.new_pick_id),
        reason: String(a.reason || "").slice(0, 240),
      }));

    const removals = (Array.isArray(parsed.removals) ? parsed.removals : [])
      .filter((r: any) =>
        r && typeof r.pick_id === "string" &&
        unlockedIds.has(r.pick_id) &&
        !lockedIds.has(r.pick_id))
      .slice(0, 4)
      .map((r: any) => ({
        pick_id: String(r.pick_id),
        reason: String(r.reason || "").slice(0, 240),
      }));

    // Hydrate previews for any referenced new_pick_id.
    const newIds = new Set<string>([
      ...replacements.map((r) => r.new_pick_id),
      ...additions.map((a) => a.new_pick_id),
    ]);
    const new_previews: NewPickPreview[] = pool
      .filter((p) => newIds.has(p.id))
      .map((p) => ({
        id: p.id,
        title: p.title,
        image_url: candidates.find((c) => c.id === p.id)?.image_url || null,
        materials: p.materials,
        category: p.category,
        designer_name: p.designer_name,
      }));

    delta = {
      summary: String(parsed.summary || "").slice(0, 400) || "Re-alignment ready.",
      replacements,
      additions,
      removals,
      new_previews,
    };
    return json(200, delta);
  } catch (e) {
    const reason = (e as Error)?.name === "AbortError" ? "Re-aligner timed out." : `Re-aligner error: ${(e as Error)?.message || "unknown"}`;
    return json(200, empty(reason));
  } finally {
    clearTimeout(timer);
  }
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
