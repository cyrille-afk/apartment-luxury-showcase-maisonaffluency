// Structured validation for tearsheet manual edits.
//
// Takes a DIFF (skipped ids, locked ids, title rename, kept items) and asks
// a fast model to return a structured verdict with per-row status
// (green/yellow/red + reason) and an overall banner. Read-only — never
// mutates anything. Fail-open: on any error returns a graceful "no verdict"
// payload so the UI can degrade cleanly.
//
// Row locks are respected: the AI is told which ids are locked so it never
// suggests removing them, and the server drops any per_row entry whose id
// isn't in the input set.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const TIMEOUT_MS = 15_000;

type Item = {
  pick_id: string;
  title: string;
  designer_name: string | null;
  materials: string | null;
  category: string | null;
};

type Body = {
  title: string;
  original_note?: string | null;
  kept: Item[];
  skipped: Item[];
  locked: Item[];
  title_change?: { from: string; to: string } | null;
};

type PerRow = { pick_id: string; status: "green" | "yellow" | "red"; reason: string };
type Verdict = {
  overall: "green" | "yellow" | "red";
  summary: string;
  per_row: PerRow[];
  global_warnings: string[];
};

const emptyVerdict = (reason: string): Verdict => ({
  overall: "yellow",
  summary: reason,
  per_row: [],
  global_warnings: [],
});

const SYSTEM = `You are the Validator — a senior interior-design reviewer.
You are given a tearsheet DRAFT and the user's pending manual edits.
Return a strict JSON verdict on whether the remaining set still holds together.

Rules:
- Return per-row status ONLY for items in the KEPT list. Never propose removing a LOCKED item.
- Use status "green" (no issue), "yellow" (soft warning), or "red" (real conflict — palette clash, scale imbalance, brief gap the locked+kept pieces can't fill).
- Overall = worst per-row status, or "green" if all green.
- summary: ONE sentence, editorial and specific. No preamble.
- global_warnings: 0-3 short bullets about the SET as a whole (scale imbalance, missing typology given locked anchors, palette drift). Empty array is fine.
- Be terse. Reference pieces by title when useful.

Output STRICT JSON only, no code fences:
{
  "overall": "green"|"yellow"|"red",
  "summary": "...",
  "per_row": [{ "pick_id": "...", "status": "green"|"yellow"|"red", "reason": "..." }],
  "global_warnings": ["..."]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return json(500, { error: "LOVABLE_API_KEY missing" });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  if (!Array.isArray(body?.kept)) {
    return json(400, { error: "kept must be an array" });
  }

  const keptIds = new Set(body.kept.map((k) => k.pick_id));
  const lockedIds = new Set((body.locked || []).map((k) => k.pick_id));

  const userPayload = {
    TITLE: body.title,
    ORIGINAL_NOTE: body.original_note || null,
    KEPT: body.kept,
    SKIPPED: body.skipped || [],
    LOCKED: body.locked || [],
    TITLE_CHANGE: body.title_change || null,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });
    if (!resp.ok) {
      const status = resp.status;
      if (status === 429) return json(200, emptyVerdict("Validator rate-limited — please retry in a moment."));
      if (status === 402) return json(200, emptyVerdict("Validator unavailable — AI credits exhausted."));
      return json(200, emptyVerdict(`Validator unavailable (${status}).`));
    }
    const j = await resp.json().catch(() => null);
    const raw = j?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return json(200, emptyVerdict("Validator returned no content."));

    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) { try { parsed = JSON.parse(fence[1]); } catch { /* fall through */ } }
    }
    if (!parsed || typeof parsed.overall !== "string") {
      return json(200, emptyVerdict("Validator response could not be parsed."));
    }

    // Sanitize + enforce locks: drop any per_row entry whose id isn't KEPT.
    // Locked items are never a valid target for a per_row verdict (they are
    // frozen anchors, not up for review).
    const overall = normalizeStatus(parsed.overall);
    const per_row: PerRow[] = Array.isArray(parsed.per_row)
      ? parsed.per_row
          .filter((r: any) => r && typeof r.pick_id === "string" && keptIds.has(r.pick_id) && !lockedIds.has(r.pick_id))
          .slice(0, 30)
          .map((r: any) => ({
            pick_id: String(r.pick_id),
            status: normalizeStatus(r.status),
            reason: String(r.reason || "").slice(0, 240),
          }))
      : [];
    const global_warnings: string[] = Array.isArray(parsed.global_warnings)
      ? parsed.global_warnings.filter((s: any) => typeof s === "string").slice(0, 3).map((s: string) => s.slice(0, 200))
      : [];
    const summary = String(parsed.summary || "").slice(0, 400);

    return json(200, { overall, summary, per_row, global_warnings } satisfies Verdict);
  } catch (e) {
    const reason = (e as Error)?.name === "AbortError" ? "Validator timed out." : `Validator error: ${(e as Error)?.message || "unknown"}`;
    return json(200, emptyVerdict(reason));
  } finally {
    clearTimeout(timer);
  }
});

function normalizeStatus(s: any): "green" | "yellow" | "red" {
  const v = String(s || "").toLowerCase();
  if (v === "red" || v === "fail" || v === "error") return "red";
  if (v === "yellow" || v === "warn" || v === "warning") return "yellow";
  return "green";
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
