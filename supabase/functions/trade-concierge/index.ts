import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireUser, rateLimit } from "../_shared/auth.ts";
import { logAiUsage } from "../_shared/aiUsage.ts";
import { modelFor, tokenBudget } from "../_shared/aiModels.ts";
import { embedQuery } from "../_shared/aiEmbeddings.ts";
import { withSemanticCache } from "../_shared/aiCache.ts";
import { coerceClearance, classifyResultFailure, countDimensionNumbers } from "../_shared/spatialFitValidation.ts";
import { canAccessProject } from "../_shared/tenantAccess.ts";
import { runInspectorPass, buildInspectorGroundTruth, buildInspectorLogRecord, logInspectorRun, validateRequirementsCoverage, mergeRequirementsWithText, runDiscoveryProseGuard, deterministicRedact, SAFE_FALLBACK_PROSE } from "../_shared/concierge-inspector.ts";
import { installFramePersistence, serveResume } from "./_resume.ts";
import { deriveHardConstraints, applyHardConstraints, filterRowsByHardConstraints, type HardConstraints } from "../_shared/hardConstraints.ts";
import { buildNoStrictTypologyReply, typologyLabel } from "./_no_strict_typology_reply.ts";

const SENTIMENT_MODEL = modelFor("cheap");
const SENTIMENT_MAX_TOKENS = tokenBudget("classify");
const CHAT_MAX_TOKENS = tokenBudget("chat");
const CHAT_MAX_TOKENS_STRONG = tokenBudget("reasoning");

// Route chat completions to Google AI Studio (Gemini direct) when a key is
// present; otherwise fall back to the Lovable AI Gateway. Embeddings continue
// to use the Lovable Gateway via `_shared/aiEmbeddings.ts`.
const GOOGLE_AI_STUDIO_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
const USE_GEMINI_DIRECT = !!GOOGLE_AI_STUDIO_API_KEY;
const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const CHAT_COMPLETIONS_URL = USE_GEMINI_DIRECT ? GEMINI_CHAT_URL : LOVABLE_CHAT_URL;
function aiAuthKey(lovableKey: string): string {
  return USE_GEMINI_DIRECT ? GOOGLE_AI_STUDIO_API_KEY! : lovableKey;
}
// Lovable Gateway model IDs are prefixed `google/`; Google AI Studio expects
// the bare model name (e.g. `gemini-3-flash-preview`).
function aiModel(m: string): string {
  return USE_GEMINI_DIRECT ? m.replace(/^google\//, "") : m;
}

type ChatBackend = "gemini" | "lovable-gateway";

// Emitted by the `extract_requirements` tool at the start of any turn that
// also produces a card. Consumed by the client (as an SSE `event: requirements`
// frame) and by the Inspector Agent (to diff assembled card contents against
// the user's declared slots/typologies/counts).
type RequirementsSlot = {
  typology: string;
  qty_min: number;
  qty_max: number;
  notes?: string;
};
type RequirementsPayload = {
  slots: RequirementsSlot[];
  style: string[];
  materials: string[];
  brands: string[];
  budget_cents?: number;
  budget_currency?: string;
  room: string;
  scale: string;
  era: string;
  notes: string;
};

function ensureLovableModel(m: string): string {
  return m.startsWith("google/") || m.startsWith("openai/") ? m : `google/${m}`;
}

function selectChatBackend(init: RequestInit): ChatBackend {
  // Image/PDF turns go through Lovable AI instead of the direct Gemini key.
  // The direct key is quota-limited and was causing uploaded photos to fall
  // back to text-only handling before the vision model could read them.
  if (payloadHasAttachments(init)) return "lovable-gateway";
  return USE_GEMINI_DIRECT ? "gemini" : "lovable-gateway";
}

function chatBackendUrl(backend: ChatBackend): string {
  return backend === "gemini" ? GEMINI_CHAT_URL : LOVABLE_CHAT_URL;
}

function initForChatBackend(init: RequestInit, backend: ChatBackend): RequestInit {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${backend === "gemini" ? aiAuthKey(lovableKey) : lovableKey}`);
  headers.set("Content-Type", "application/json");

  let body = init.body;
  try {
    const parsed = JSON.parse(String(init.body ?? "{}"));
    if (typeof parsed.model === "string") {
      parsed.model = backend === "gemini" ? parsed.model.replace(/^google\//, "") : ensureLovableModel(parsed.model);
    }
    body = JSON.stringify(parsed);
  } catch { /* keep original body */ }

  return { ...init, headers, body };
}

// Cloudflare Workers AI fallback (10k free requests/day). Used when Gemini
// returns a rate-limit / quota error.
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_WORKERS_AI_TOKEN = Deno.env.get("CLOUDFLARE_WORKERS_AI_TOKEN");
const CLOUDFLARE_ENABLED = !!(CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_WORKERS_AI_TOKEN);
const CLOUDFLARE_CHAT_URL = CLOUDFLARE_ENABLED
  ? `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`
  : "";
const CLOUDFLARE_FALLBACK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function shouldFallback(status: number): boolean {
  // 429/402/403: quota/auth. 500/502/503/504: upstream model overload/outage.
  // After PRIMARY_MAX_RETRIES exhaustion on any of these, route to Cloudflare.
  return (
    status === 429 ||
    status === 402 ||
    status === 403 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function isRetryable(status: number): boolean {
  // Only retry on rate-limit (429). On upstream 5xx (model overload/outage),
  // fail-fast to the Cloudflare fallback instead of burning ~30s of retries
  // that leave the user staring at a "Loading" indicator — most 503s from
  // Gemini during high-demand windows do not clear within our short backoff
  // window anyway, and the fallback model is warm.
  return status === 429;
}

const PRIMARY_MAX_RETRIES = Number(Deno.env.get("PRIMARY_MAX_RETRIES") ?? "2");
const PRIMARY_BASE_DELAY_MS = Number(Deno.env.get("PRIMARY_BASE_DELAY_MS") ?? "500");
const PRIMARY_MAX_DELAY_MS = Number(Deno.env.get("PRIMARY_MAX_DELAY_MS") ?? "8000");

function backoffDelayMs(attempt: number, retryAfterHeader: string | null): number {
  // Honor Retry-After header (seconds or HTTP-date) when present
  if (retryAfterHeader) {
    const secs = Number(retryAfterHeader);
    if (!Number.isNaN(secs) && secs > 0) {
      return Math.min(secs * 1000, PRIMARY_MAX_DELAY_MS);
    }
    const dateMs = Date.parse(retryAfterHeader);
    if (!Number.isNaN(dateMs)) {
      const diff = dateMs - Date.now();
      if (diff > 0) return Math.min(diff, PRIMARY_MAX_DELAY_MS);
    }
  }
  const exp = Math.min(PRIMARY_BASE_DELAY_MS * 2 ** attempt, PRIMARY_MAX_DELAY_MS);
  const jitter = Math.random() * (exp * 0.3); // up to 30% jitter
  return Math.floor(exp + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractRequestId(res: Response): string {
  return (
    res.headers.get("x-request-id") ||
    res.headers.get("cf-ray") ||
    res.headers.get("x-google-request-id") ||
    res.headers.get("x-cloud-trace-context") ||
    res.headers.get("request-id") ||
    "none"
  );
}

// ============================================================
// Circuit breaker for primary backend (Gemini / Lovable Gateway)
// ------------------------------------------------------------
// See ./_breaker.ts for the state machine. Tests live in
// ./breaker_test.ts and use a fake clock to verify cooldown,
// half-open probing, and immediate-fallback behavior.
// ============================================================
import { createBreaker } from "./_breaker.ts";

const CB_FAILURE_THRESHOLD = Number(Deno.env.get("CB_FAILURE_THRESHOLD") ?? "3");
const CB_COOLDOWN_MS = Number(Deno.env.get("CB_COOLDOWN_MS") ?? "60000");

// Requirements-diff enforcement mode (see `_requirements_enforcement.ts` for
// precedence). This endpoint is fail-closed by default: a card that does not
// satisfy the user's stated brief must not render.
import { resolveRequirementsEnforcement } from "./_requirements_enforcement.ts";
const REQUIREMENTS_ENFORCEMENT: "open" | "closed" = (Deno.env.get("CONCIERGE_REQUIREMENTS_ENFORCEMENT") || Deno.env.get("CONCIERGE_REQUIREMENTS_STRICT"))
  ? resolveRequirementsEnforcement({
      CONCIERGE_REQUIREMENTS_ENFORCEMENT: Deno.env.get("CONCIERGE_REQUIREMENTS_ENFORCEMENT"),
      CONCIERGE_REQUIREMENTS_STRICT: Deno.env.get("CONCIERGE_REQUIREMENTS_STRICT"),
    })
  : "closed";
console.log(`[concierge] requirements enforcement: ${REQUIREMENTS_ENFORCEMENT}`);

const breaker = createBreaker({
  threshold: CB_FAILURE_THRESHOLD,
  cooldownMs: CB_COOLDOWN_MS,
});

const breakerSnapshot = () => breaker.snapshot();
const breakerAllowsPrimary = () => breaker.allowsPrimary();
const breakerRecordSuccess = (wasProbe: boolean) => breaker.recordSuccess(wasProbe);
const breakerRecordFailure = (wasProbe: boolean, reason: string) =>
  breaker.recordFailure(wasProbe, reason);


function payloadHasAttachments(init: RequestInit): boolean {
  try {
    const parsed = JSON.parse(String(init.body ?? "{}"));
    const msgs = Array.isArray(parsed.messages) ? parsed.messages : [];
    return msgs.some((m: any) =>
      m && m.role === "user" && Array.isArray(m.content) &&
      m.content.some((p: any) => p && (p.type === "image_url" || p.type === "file"))
    );
  } catch { return false; }
}

function extractLangDirectiveFromInit(init: RequestInit): string {
  try {
    const parsed = JSON.parse(String(init.body ?? "{}"));
    const sys = (Array.isArray(parsed.messages) ? parsed.messages : []).find((m: any) => m?.role === "system");
    const txt = typeof sys?.content === "string" ? sys.content : "";
    const m = txt.match(/REPLY LANGUAGE[\s\S]*?Reply entirely in ([A-Za-z ]+?)[\.,\n]/);
    return m ? m[1].trim().toLowerCase() : "english";
  } catch { return "english"; }
}

function visionBusySseResponse(init: RequestInit): Response {
  const lang = extractLangDirectiveFromInit(init);
  const msg = lang.startsWith("indo") || lang.startsWith("bahasa")
    ? "Saya menerima lampiran Anda, namun sistem visi sedang sibuk sebentar. Bisakah Anda mengirim ulang foto dalam beberapa detik? Sementara itu, mohon konfirmasi dimensi ruangan dan kapasitas tempat duduk yang diinginkan."
    : lang.startsWith("thai")
    ? "ได้รับไฟล์แนบแล้วค่ะ แต่ระบบวิชั่นกำลังยุ่งชั่วคราว รบกวนส่งภาพอีกครั้งในอีกสองสามวินาที ระหว่างนี้ขอทราบขนาดห้องและจำนวนที่นั่งที่ต้องการได้ไหมคะ?"
    : lang.startsWith("chinese") || lang.startsWith("中文")
    ? "已收到您的附件,但视觉模型暂时繁忙。请几秒后重新发送照片。其间,可否先告知房间尺寸与就餐人数?"
    : "I've received your attachment, but the vision model is momentarily busy — could you resend the photo in a few seconds? In the meantime, can you confirm the room dimensions and desired seating capacity?";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "x-concierge-fallback": "vision-busy" } });
}

async function callCloudflare(init: RequestInit, reason: string, primaryCtx: { status: number; requestId: string }): Promise<Response> {
  // If the original request carried image/PDF parts, the text-only Llama
  // fallback will (correctly) say "I can't view attachments" — which is
  // confusing for the user. Return a graceful "vision busy, try again"
  // SSE response instead.
  if (payloadHasAttachments(init)) {
    console.warn(`[concierge] VISION_BUSY_SHORTCIRCUIT reason=${reason} primaryStatus=${primaryCtx.status}`);
    return visionBusySseResponse(init);
  }
  let cfBodyStr: string;
  let originalModel = "unknown";
  try {
    const parsed = JSON.parse(String(init.body ?? "{}"));
    originalModel = parsed.model || "unknown";
    parsed.model = CLOUDFLARE_FALLBACK_MODEL;
    delete parsed.tools;
    delete parsed.tool_choice;
    delete parsed.response_format;

    // Workers AI Llama 3.3 has a HARD 24k-token context window. Our primary
    // prompt (system + catalogue context + history) routinely exceeds that
    // and returns 413. Tools are stripped anyway on this path, so collapse
    // the payload to a slim system note + the last few turns. Cap ~16k chars
    // (~4k tokens) to leave headroom for the completion.
    const CF_CHAR_CAP = 16000;
    // Preserve the REPLY LANGUAGE directive from the upstream system prompt
    // so the Cloudflare fallback honours the user's language picker even
    // though we strip the long catalogue system prompt.
    const firstSystem = (Array.isArray(parsed.messages) ? parsed.messages : [])
      .find((m: any) => m && m.role === "system");
    const firstSysText = typeof firstSystem?.content === "string" ? firstSystem.content : "";
    const langBlockMatch = firstSysText.match(/## ABSOLUTE RULE — REPLY LANGUAGE[\s\S]*?(?=\n##|\n\n[A-Z]|$)/);
    const langBlock = langBlockMatch ? langBlockMatch[0].trim() + "\n\n" : "";
    const slimSystem = {
      role: "system",
      content:
        langBlock +
        "You are Felix, the Maison Affluency concierge fallback. The Maison Affluency Curation tools are temporarily unavailable. Reply briefly and warmly, acknowledging the user's last message specifically. Never re-ask atmosphere, palette, material, room type, or seating capacity if already stated in the conversation. If spatial context is missing, invite the user to attach a room plan, photo, or PDF via the paperclip and send it here. Never invent product names, designers, or ids; never output JSON or tool envelopes. NEVER use the words 'catalog' or 'catalogue' in user-facing prose — always say 'Maison Affluency Curation' or 'our curated selection'.",
    };
    const original = Array.isArray(parsed.messages) ? parsed.messages : [];
    const nonSystem = original.filter((m: any) => m && m.role !== "system");
    const kept: any[] = [];
    let charBudget = CF_CHAR_CAP;
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const m = nonSystem[i];
      // Llama 3.3 on Workers AI is text-only. Strip image_url / file parts
      // and concatenate any text blocks — never JSON.stringify the array,
      // that would dump base64 attachments into the prompt.
      let raw: string;
      if (typeof m.content === "string") {
        raw = m.content;
      } else if (Array.isArray(m.content)) {
        const textParts = m.content
          .filter((p: any) => p && p.type === "text" && typeof p.text === "string")
          .map((p: any) => p.text);
        const hadAttachment = m.content.some((p: any) => p && (p.type === "image_url" || p.type === "file"));
        raw = textParts.join(" ") + (hadAttachment ? " [attachment omitted on text-only fallback]" : "");
      } else {
        raw = "";
      }
      const c = raw.length > 8000 ? raw.slice(-8000) : raw;
      if (c.length > charBudget && kept.length > 0) break;
      kept.unshift({ role: m.role, content: c });
      charBudget -= c.length;
      if (charBudget <= 0) break;
    }
    parsed.messages = [slimSystem, ...kept];
    parsed.max_tokens = Math.min(parsed.max_tokens ?? 800, 800);
    cfBodyStr = JSON.stringify(parsed);
  } catch (_) {
    cfBodyStr = String(init.body ?? "{}");
  }

  console.warn(
    `[concierge] CLOUDFLARE_FALLBACK_INIT reason=${reason} originalModel=${originalModel} fallbackModel=${CLOUDFLARE_FALLBACK_MODEL} primaryStatus=${primaryCtx.status} primaryRequestId=${primaryCtx.requestId} breaker=${breakerSnapshot()}`
  );

  const cfRes = await fetch(CLOUDFLARE_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_WORKERS_AI_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: cfBodyStr,
  });

  console.warn(
    `[concierge] CLOUDFLARE_FALLBACK_RESULT status=${cfRes.status} ok=${cfRes.ok} requestId=${extractRequestId(cfRes)}`
  );
  return new Response(cfRes.body, {
    status: cfRes.status,
    statusText: cfRes.statusText,
    headers: { ...Object.fromEntries(cfRes.headers.entries()), "x-concierge-fallback": "cloudflare" },
  });
}

/**
 * Drop-in replacement for `fetch(CHAT_COMPLETIONS_URL, init)` with retry +
 * exponential backoff on transient primary failures, a circuit breaker that
 * short-circuits to Cloudflare during cooldowns, and Cloudflare Workers AI
 * fallback when the primary is rate-limited or out of quota.
 */
async function chatFetch(init: RequestInit): Promise<Response> {
  const backend = selectChatBackend(init);
  const backendName = backend === "gemini" ? "gemini" : "lovable-gateway";
  const backendInit = initForChatBackend(init, backend);
  const backendUrl = chatBackendUrl(backend);

  // 1) Circuit breaker short-circuit: route directly to Cloudflare when open
  const gate = breakerAllowsPrimary();
  if (!gate.allow) {
    if (CLOUDFLARE_ENABLED) {
      console.warn(`[concierge] CIRCUIT_SHORT_CIRCUIT backend=${backendName} reason=${gate.reason} routingTo=cloudflare`);
      return callCloudflare(init, `circuit-${gate.reason}`, { status: 0, requestId: "skipped" });
    }
    // No fallback available — fall through and try primary anyway as a best effort
    console.warn(`[concierge] CIRCUIT_OPEN_NO_FALLBACK backend=${backendName} reason=${gate.reason} attemptingPrimaryAnyway=true`);
  }

  const isProbe = gate.probe;
  let primary: Response | null = null;
  let lastError: unknown = null;
  // When probing, skip retries — a single shot determines if primary recovered
  const maxRetries = isProbe ? 0 : PRIMARY_MAX_RETRIES;

  // Primary fetch hard timeout: some upstream calls (esp. Gemini during
  // demand spikes) have been observed to stall for 90–120s before returning
  // headers. The client abandons the SSE stream long before that, leaving
  // an orphaned request and a broken UX. Cap the primary at 45s and route
  // to Cloudflare instead. This bounds the "first byte" window; the SSE body
  // is not aborted by this signal because we clear the timer on response.
  const PRIMARY_FIRST_BYTE_TIMEOUT_MS = 45_000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(new Error("primary-first-byte-timeout")), PRIMARY_FIRST_BYTE_TIMEOUT_MS);
    try {
      primary = await fetch(backendUrl, { ...backendInit, signal: ac.signal });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      const isTimeout = (err as Error)?.message === "primary-first-byte-timeout" || (err as any)?.name === "AbortError";
      console.error(
        `[concierge] PRIMARY_NETWORK_ERROR backend=${backendName} attempt=${attempt + 1}/${maxRetries + 1} probe=${isProbe} timeout=${isTimeout} error=${String((err as Error)?.message ?? err)}`
      );
      if (attempt < maxRetries) {
        const delay = backoffDelayMs(attempt, null);
        console.warn(`[concierge] PRIMARY_RETRY backend=${backendName} attempt=${attempt + 1} delayMs=${delay} reason=${isTimeout ? "timeout" : "network"}`);
        await sleep(delay);
        continue;
      }
      break;
    }

    if (primary.ok) {
      if (attempt > 0) {
        console.log(`[concierge] PRIMARY_RECOVERED backend=${backendName} attempt=${attempt + 1} status=${primary.status}`);
      }
      breakerRecordSuccess(isProbe);
      return primary;
    }

    if (attempt < maxRetries && isRetryable(primary.status)) {
      const reqId = extractRequestId(primary);
      const retryAfter = primary.headers.get("retry-after");
      const delay = backoffDelayMs(attempt, retryAfter);
      console.warn(
        `[concierge] PRIMARY_RETRY backend=${backendName} attempt=${attempt + 1}/${maxRetries + 1} status=${primary.status} requestId=${reqId} retryAfter=${retryAfter ?? "none"} delayMs=${delay}`
      );
      try { await primary.body?.cancel(); } catch (_) { /* noop */ }
      await sleep(delay);
      continue;
    }
    break;
  }

  // Primary exhausted or returned a non-retryable error
  if (!primary) {
    if (CLOUDFLARE_ENABLED) {
      breakerRecordFailure(isProbe, "network-exhausted");
      console.warn(`[concierge] PRIMARY_EXHAUSTED_NETWORK backend=${backendName} fallingBackToCloudflare=true breaker=${breakerSnapshot()}`);
      return callCloudflare(init, "primary-network-exhausted", { status: 0, requestId: "none" });
    }
    breakerRecordFailure(isProbe, "network-exhausted-no-fallback");
    throw lastError ?? new Error("Primary backend unreachable");
  }

  if (!CLOUDFLARE_ENABLED || !shouldFallback(primary.status)) {
    // Non-fallback failure (e.g. 4xx caller error) — don't trip the breaker
    if (!primary.ok && isProbe) {
      // Probe failed but isn't fallback-eligible; still treat as failure to re-open
      breakerRecordFailure(true, `probe-status-${primary.status}`);
    }
    return primary;
  }

  // Fallback-eligible failure → trip breaker accounting and route to CF
  breakerRecordFailure(isProbe, `status-${primary.status}`);

  const primaryReqId = extractRequestId(primary);
  let errBody = "";
  try { errBody = await primary.clone().text(); } catch (_) { /* noop */ }

  console.error(
    `[concierge] PRIMARY_BACKEND_FAILURE backend=${backendName} status=${primary.status} requestId=${primaryReqId} attempts=${maxRetries + 1} probe=${isProbe} breaker=${breakerSnapshot()} bodyPreview=${errBody.slice(0, 500).replace(/\s+/g, " ")}`
  );

  return callCloudflare(init, `primary-status-${primary.status}`, { status: primary.status, requestId: primaryReqId });
}


console.log(`[concierge] chat backend: ${USE_GEMINI_DIRECT ? "google-ai-studio" : "lovable-gateway"}; cloudflare-fallback: ${CLOUDFLARE_ENABLED ? "on" : "off"}`);



const ALLOWED_REQUEST_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-request-id",
  "x-concierge-surface",
  "x-concierge-sid",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
];
const ALLOWED_REQUEST_HEADERS_SET = new Set(ALLOWED_REQUEST_HEADERS.map((h) => h.toLowerCase()));
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS.join(", "),
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/**
 * Emit a structured "cors_block" log line whenever an OPTIONS preflight or a
 * POST arrives with headers we don't recognise, or from an origin/method that
 * would be rejected downstream. Purely observational — we still return the
 * corsHeaders response, so browsers get the same behaviour they always did,
 * but we now have a searchable audit trail of every mismatch that could break
 * a stream.
 */
function logCorsInspection(req: Request, phase: "preflight" | "request", requestId?: string) {
  try {
    const origin = req.headers.get("origin") || "";
    const method = req.method;
    const acrm = req.headers.get("access-control-request-method") || "";
    const acrh = req.headers.get("access-control-request-headers") || "";
    const requestedHeaders = acrh
      ? acrh.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)
      : phase === "request"
      ? Array.from(req.headers.keys()).map((h) => h.toLowerCase())
      : [];
    const unknown = requestedHeaders.filter((h) => !ALLOWED_REQUEST_HEADERS_SET.has(h) && !h.startsWith("sec-") && !["accept","accept-language","accept-encoding","cache-control","connection","host","origin","referer","user-agent","pragma","dnt","cookie"].includes(h));
    const methodBlocked = phase === "preflight" && acrm && !["GET","POST","OPTIONS"].includes(acrm.toUpperCase());
    if (unknown.length > 0 || methodBlocked) {
      console.warn(
        `[concierge cors_block] ${JSON.stringify({
          phase,
          requestId: requestId || null,
          origin,
          method,
          requestedMethod: acrm || null,
          requestedHeaders: acrh || null,
          unknownHeaders: unknown,
          methodBlocked: !!methodBlocked,
          reason: methodBlocked ? "method_not_allowed" : "header_not_in_allow_list",
          hint: unknown.length
            ? `Add ${unknown.join(", ")} to ALLOWED_REQUEST_HEADERS in trade-concierge/index.ts`
            : "Add the requested method to Access-Control-Allow-Methods",
        })}`,
      );
    }
  } catch (e) {
    console.warn("[concierge cors_block] inspection failed:", (e as Error)?.message);
  }
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "extract_requirements",
      description:
        "ALWAYS the FIRST tool call in any turn that also produces a card (propose_tearsheet, add_to_tearsheet, draft_quote, add_to_quote, propose_ffe_rows, prepare_visualization_brief). Emits the typed Requirements the rest of the turn will be validated against — typology per slot, quantities, style cues, budget, room, era. Emit even for single-piece requests (single-slot array). Do NOT emit when the turn is pure discovery/clarification with no card. The Inspector Agent diffs the assembled card against this object, so undercounting slots or omitting typologies will trigger corrections. Base every field on the LATEST user turn + sticky facts already gathered — do not invent budgets/rooms the user hasn't stated.",
      parameters: {
        type: "object",
        properties: {
          slots: {
            type: "array",
            description:
              "One entry per distinct piece the user is asking for. Split by typology AND by role (e.g. a dining-set request produces slots for 'dining_table' + 'dining_chair' + optionally 'chandelier'/'sideboard'). Order matches the user's mental model (anchor pieces first). Min 1, max 12.",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "object",
              properties: {
                typology: {
                  type: "string",
                  description:
                    "Normalized furniture typology in snake_case: dining_table, dining_chair, armchair, sofa, coffee_table, side_table, console, sideboard, credenza, bed, nightstand, desk, bookcase, chandelier, pendant_light, floor_lamp, table_lamp, wall_sconce, rug, mirror, artwork, screen, bench, stool, ottoman, bar_cart, vanity, cabinet. Use the closest match if the user's wording is different (e.g. 'suspension' → pendant_light).",
                },
                qty_min: {
                  type: "integer",
                  description: "Minimum quantity for this slot. 1 unless the user specified a range or a set (e.g. 'chairs for 8' → 8).",
                },
                qty_max: {
                  type: "integer",
                  description: "Maximum quantity for this slot. Equal to qty_min unless the user gave a range (e.g. '4-6 chairs').",
                },
                notes: {
                  type: "string",
                  description: "Optional 1-line brief specific to THIS slot (e.g. 'round, seats 8, contrasting to the chairs'). Omit if none.",
                },
              },
              required: ["typology", "qty_min", "qty_max"],
              additionalProperties: false,
            },
          },
          style: {
            type: "array",
            description:
              "Short style/aesthetic descriptors the user actually used or clearly implied (e.g. ['mid-century', 'warm woods', 'brass accents']). Max 8. Empty array if the user gave none.",
            items: { type: "string" },
            maxItems: 8,
          },
          materials: {
            type: "array",
            description: "Preferred materials/finishes the user named (e.g. ['walnut', 'travertine', 'brass']). Empty array if none. Max 8.",
            items: { type: "string" },
            maxItems: 8,
          },
          brands: {
            type: "array",
            description:
              "Specific ateliers, designers, or brands the user explicitly named to include (e.g. ['Saint-Louis', 'Alinea Design Objects']). Empty array if none. Do NOT infer brands the user didn't mention. Max 8.",
            items: { type: "string" },
            maxItems: 8,
          },
          budget_cents: {
            type: "integer",
            description: "Total project budget in cents, if the user stated one. Omit the field entirely otherwise.",
          },
          budget_currency: {
            type: "string",
            description: "ISO 4217 currency code for budget_cents (EUR/USD/GBP/CHF/AED/SGD/HKD/JPY). Omit if budget_cents omitted.",
          },
          room: {
            type: "string",
            description:
              "Room or space the pieces are for (e.g. 'dining room', 'primary bedroom', 'library', 'entry'). Empty string if unspecified.",
          },
          scale: {
            type: "string",
            description:
              "One short phrase for size/capacity when the user gave one ('seats 8', 'small pied-à-terre', 'double-height drawing room'). Empty string otherwise.",
          },
          era: {
            type: "string",
            description: "Period cue the user named ('mid-century', '1970s Italian', 'contemporary'). Empty string if unspecified.",
          },
          notes: {
            type: "string",
            description:
              "Free-form 1-2 sentence summary of any qualitative constraints not captured above (lighting temperature, sustainability, wheelchair access, delivery deadline, etc.). Empty string if none.",
          },
        },
        required: ["slots", "style", "materials", "brands", "room", "scale", "era", "notes"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_tearsheet",
      description:
        "Draft a NEW tearsheet (client board). Use this ONLY when (a) the user has NO existing tearsheets, or (b) the user EXPLICITLY asks for a new/separate/fresh tearsheet (phrases like 'new tearsheet', 'start a new board', 'fresh selection', 'separate edit', 'different project'). In every other case where the user asks to propose/suggest/recommend/curate/show/pull/reinterpret a selection, you MUST call `add_to_tearsheet` against the ACTIVE board in USER'S EXISTING TEARSHEETS instead. Always pick IDs strictly from CURATED PIECES — never invent IDs.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "A short, evocative title for the tearsheet (max 80 chars).",
          },
          pick_ids: {
            type: "array",
            description: "UUIDs of curator picks to include. Must come from CURATED PIECES.",
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
        "Append pieces to one of the user's EXISTING tearsheets. THIS IS THE DEFAULT TOOL for any selection/proposal/curation request when the user already has at least one existing tearsheet. Default board_id is the entry flagged ⭐ ACTIVE in USER'S EXISTING TEARSHEETS. Only use a different board_id if the user explicitly names one of their other boards. The board_id MUST be one of the UUIDs listed there — never invent.",
      parameters: {
        type: "object",
        properties: {
          board_id: {
            type: "string",
            description: "UUID of the existing tearsheet, taken verbatim from USER'S EXISTING TEARSHEETS.",
          },
          pick_ids: {
            type: "array",
            description: "UUIDs of curator picks to append. Must come from CURATED PIECES.",
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
        "Draft a NEW trade quote for the user with line items (qty, optional variant, optional lead time, optional per-line note). Only call when the user explicitly asks for a quote, estimate, pricing breakdown, or to 'put together a quote'. pick_ids in lines MUST come from CURATED PIECES. Always bind to the ACTIVE PROJECT id when one is shown in the system prompt.",
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
                pick_id: { type: "string", description: "UUID from CURATED PIECES." },
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
        "Draft a ROOM-BY-ROOM FF&E schedule bound to the ACTIVE PROJECT. Every row MUST carry a `room` label (e.g. 'Drawing Room', 'Primary Bedroom'). project_id is REQUIRED — if no active project is set, do NOT call this tool; ask the user which project to bind to first. pick_ids in rows MUST come from CURATED PIECES. On approval the rows commit as room-tagged lines on a draft quote and populate the project's FF&E Schedule view.",
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
                pick_id: { type: "string", description: "UUID from CURATED PIECES." },
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
          cad_asset_id: { type: "string", description: "Optional UUID of the trade_product_cad_assets row to ingest and use for product geometry." },
          variant_label: { type: "string", description: "Optional product variant label, if the product has CAD geometry per variant." },
          clearance_mm: { type: "integer", description: "Walking clearance to leave around the product on every side, in millimetres. Defaults to 600." },
        },
        required: ["cad_document_id", "product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_spatial_fit_batch",
      description:
        "Run the deterministic fit-check against MULTIPLE trade products in one go, all against the SAME room of the SAME plan. Use this when the user asks 'do any of these fit', 'which of these works in the dining room', or wants to compare a small set (2–8) of candidates. For a single piece, prefer check_spatial_fit. Returns one verdict per piece plus a shared batch_id you can quote when summarising.",
      parameters: {
        type: "object",
        properties: {
          cad_document_id: { type: "string", description: "UUID of the cad_documents row (uploaded floor plan)." },
          room_label: { type: "string", description: "Optional room label. Omit to use the largest detected room." },
          pieces: {
            type: "array",
            description: "Pieces to test against the same room. 2–8 entries.",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "object",
              properties: {
                product_id: { type: "string", description: "UUID of the trade_product to test." },
                cad_asset_id: { type: "string", description: "Optional UUID of the attached CAD/3D asset to ingest and use." },
                variant_label: { type: "string", description: "Optional variant label." },
                clearance_mm: { type: "integer", description: "Walking clearance in mm. Defaults to 600." },
              },
              required: ["product_id"],
              additionalProperties: false,
            },
          },
        },
        required: ["cad_document_id", "pieces"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_spatial_fit_edit",
      description:
        "Record one spatial-fit selection or edit attempt to the audit log. CALL THIS once per user turn during the spatial-fit conversational flow — for the initial pick, every edit (plan/room/piece/clearance), every rejection (unknown plan, unknown room, ambiguous piece, bad clearance), and the final 'go' confirmation. Fire-and-forget: it returns nothing visible to the user.",
      parameters: {
        type: "object",
        properties: {
          field: { type: "string", enum: ["cad_document_id","room_label","product_id","clearance_mm","initial","confirm","cancel","result"], description: "Which field the user was changing ('initial' for the first selection, 'confirm' for the final go, 'cancel' when the user aborts a pending check or it times out, 'result' is reserved — the server logs it automatically after check_spatial_fit runs)." },
          requested_value: { type: "string", description: "The raw value the user typed (e.g. 'the dining room', 'Velvet sofa', 'plan 3', 'cancel', 'never mind')." },
          resolved_value: { type: "string", description: "The value after resolution (UUID, canonical room label, integer mm). Omit if it could not be resolved." },
          outcome: { type: "string", enum: ["accepted","rejected"], description: "'accepted' if the edit/selection/cancel passed; 'rejected' if it failed validation or was dropped due to staleness." },
          reason: { type: "string", description: "Short human-readable explanation. REQUIRED when outcome is 'rejected'. For cancels, optionally say why ('user typed cancel', 'session_timeout', 'user pivoted topic')." },
          failed_validation: { type: "string", enum: ["plan_not_found","plan_not_ready","plan_ambiguous","room_not_detected","room_ambiguous","piece_not_found","piece_ambiguous","missing_dimensions","clearance_out_of_range","clearance_unparseable","missing_field","service_unreachable","no_verdict","other"], description: "REQUIRED when outcome is 'rejected'. The specific validation rule that failed. Pick the closest enum value; use 'other' for cancels or session timeouts and explain in `reason`. Server-only codes ('service_unreachable', 'no_verdict', 'plan_not_ready', 'missing_dimensions') are written automatically — you should not emit them." },
          cad_document_id: { type: "string", description: "Current pending selection state." },
          room_label: { type: "string", description: "Current pending selection state." },
          product_id: { type: "string", description: "Current pending selection state." },
          clearance_mm: { type: "integer", description: "Current pending selection state." },
          turns_since_confirm: { type: "integer", description: "Optional — number of user turns since the last confirmation block was posted. Pass when logging a cancel due to session timeout so reviewers can see how stale the pending check was." },

        },
        required: ["field", "outcome"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_visualization_brief",
      description:
        "Assemble a brief and hand off to Axonometric Studio for image generation. USE THIS whenever the user asks you to 'render', 'visualise', 'show me how this would look', 'generate a view/scene/axonometric', 'mock up a room', or to picture a tearsheet selection in a space. Emits a card with a 'Render Scene' CTA that deep-links the user into the Axonometric Studio with mode, style preset, room/brief notes and (optionally) overlay product picks pre-populated. Do NOT attempt to generate the image yourself — this tool is the only sanctioned visualization handoff.",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["elevation_to_axo", "section_to_axo", "stylize", "composite", "3d_to_cad", "cad_overlay"],
            description: "Axonometric Studio mode. 'composite' to overlay catalog pieces into a reference photo, 'elevation_to_axo' / 'section_to_axo' to convert a 2D drawing, 'stylize' to restyle an existing render, 'cad_overlay' for CAD blocks, '3d_to_cad' for 3D-to-axo. Default to 'composite' when overlaying picks, 'stylize' otherwise.",
          },
          style_preset: {
            type: "string",
            enum: ["Photorealistic", "Watercolor", "Minimal Line", "Editorial Luxury", "Scandinavian"],
            description: "Visual style preset label. Default 'Editorial Luxury' for trade presentations.",
          },
          title: { type: "string", description: "Short title for the brief, max 80 chars (e.g. 'Belgravia drawing-room — bronze & mohair edit')." },
          room_label: { type: "string", description: "Room or space being visualised (e.g. 'Drawing Room', 'Primary Bedroom')." },
          brief_notes: { type: "string", description: "1–3 sentence directorial brief: palette, mood, lighting, materials, era, anchor pieces. This is what the Axonometric Studio will use as the prompt brief." },
          pick_ids: {
            type: "array",
            description: "Optional UUIDs of CURATED PIECES to pre-load as overlay candidates in the studio. Max 12.",
            items: { type: "string" },
            maxItems: 12,
          },
          source_image_url: {
            type: "string",
            description: "Optional absolute https URL of a reference image (room photo, floor plan, mood board) the user already shared. Omit if none is on hand.",
          },
        },
        required: ["mode", "brief_notes"],
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
  cadDocuments: string,
  productCadAssets: string,
) {
  return `You are the Maison Affluency Trade Concierge — a knowledgeable, refined assistant for professional interior designers, architects, and specifiers sourcing collectible and limited-edition furniture, lighting, and objets d'art.

Your tone is warm yet polished, like a well-informed gallery advisor. Keep answers concise (2-4 sentences unless detail is requested).

## ABSOLUTE RULE — CONVERSATION MEMORY (NEVER REPEAT QUESTIONS)
Before composing any reply, re-read the ENTIRE conversation above and build a mental brief of what the user has already told you. Treat the following as STICKY FACTS that persist for the whole session once stated, even loosely:
  • location / project address / city / neighbourhood
  • property type (townhouse, penthouse, villa, hotel, restaurant, Good Class Bungalow / GCB, shophouse, palazzo, hôtel particulier, brownstone, mews house, yalı, riad, hacienda, hutong, machiya, altbau, greystone, condominium, loft, chalet, yacht…). Always recognise local vernacular and abbreviations — "GCB" ALWAYS means Good Class Bungalow (Singapore); never ask the user to clarify it.
  • room or rooms in scope
  • atmosphere / mood / style direction (formal, warm, modern, traditional, avant-garde, intimate, etc.)
  • palette, materials (wood, marble, brass…), finishes preferred or excluded
  • seating capacity, dimensions, scale constraints
  • budget range
  • openness to handmade vs branded / one-of-a-kind vs editioned
  • timeline / lead-time tolerance
  • named designers, brands, or pieces the user has already endorsed or rejected

NEVER ask about a sticky fact that has already been answered, even partially or implicitly. "Warm palette, wood, London townhouse, 12-seater" = atmosphere AND palette AND material AND capacity AND location ARE ALL ANSWERED. Asking "what atmosphere?" or "what seating capacity?" again is forbidden and breaks trust.

When you have at least THREE sticky facts (typical minimum: room + capacity-or-scale + style-or-material), STOP qualifying and ACT — call \`propose_tearsheet\` with 4–8 catalog pieces that fit the brief. Do not ask a fourth question to delay acting; propose first, refine after. If the only missing context is room dimensions, layout, or existing architecture, do NOT ask another prose checklist — say briefly that the first edit is ready, then invite the user to attach a room plan, reference photo, or PDF with the paperclip and send it here so you can refine the fit.

When you do ask a question, you MUST first mirror back, in the user's own terms, the sticky facts they already stated, then ask ONLY for the genuinely-missing delta. The mirror is not optional — it proves you listened. Use the pattern: "You mentioned [paraphrase of what they said] — you didn't yet specify [the one missing nuance]?" Never ask a fresh open-ended question that ignores prior answers. Example: user said "12 pax, elegant but not too formal, earthy tones" → forbidden: "what atmosphere do you envision?"; correct: "You mentioned an elegant-but-relaxed dining for 12 in earthy tones — you didn't say whether it's primarily for entertaining or also for everyday family meals, which would steer the scale and durability."

UPLOAD PROMPT RULE: Felix can receive images and PDFs in this chat. Whenever room size, layout, plan, elevation, or existing architecture would help, naturally offer: "If you have a room plan, reference photo, or PDF, attach it with the paperclip and send it here." Surface this in prose only; do not imply a separate upload workflow.

NO-NAMEDROPPING-IN-DISCOVERY RULE: While still qualifying (asking sticky-fact questions), NEVER pre-announce specific ateliers, designers, brands, or piece names you "will" pull — phrases like "I'll pull from our ateliers such as X or Y", "I'm thinking of pieces from X or Y", "once I have these details I'll suggest something from X" are FORBIDDEN. They feel scripted and pre-commit you before you've actually scanned the catalog against the user's answers. Close discovery questions cleanly ("Once I have those, I'll pull a curated first edit.") without naming any designer or brand. Only name pieces inside a \`propose_tearsheet\` / \`add_to_tearsheet\` tool call.

REFERENCE-PHOTO RULE (user uploads a photo of a specific piece, e.g. a table, sofa, chair, lamp, rug, etc.):
1. First, describe in one short sentence what you see (typology, silhouette, material, era/style cue — e.g. "a classical mahogany twin-pedestal oval dining table, Art Deco lineage").
2. Then scan the CURATED PIECES below for the closest spiritual matches on typology + material + proportion + era. If you find 2+ plausible matches, call \`propose_tearsheet\` with those pieces and explain in one line WHY each was chosen against the reference (material echo, silhouette, scale).
3. If the Maison Affluency Curation has nothing close, state that plainly without a self-correction, apology, or external-archive claim, then offer the client TWO explicit choices, as a question:
   (a) broaden the typology/material constraints inside the Maison Affluency Curation, OR
   (b) propose a more contemporary reinterpretation from the Maison Affluency Curation, clearly explaining why each piece honours the spirit of the reference (silhouette, materiality, or proportion).
   Wait for the user to choose before acting. Never silently pivot to modern alternatives without naming the trade-off.
4. Never claim a curated piece "matches" the photo when it doesn't — under-promise on the likeness and over-deliver on the reasoning.

## USER SIGNALS (predictive personalization)
Use these signals to anticipate the user's needs. Open with a relevant suggestion when natural ("Want me to add the new Pouénat sconce to your *Mayfair townhouse* board?"), bias your recommendations toward designers, materials and categories they have engaged with, and reference their active projects/tearsheets by name. NEVER expose raw IDs or internal data — only weave the insights into natural prose.
${userSignals}

## EMOTIONAL TONE DIRECTIVE
${sentimentDirective}

## EXECUTION PLAN (from upstream brief-extraction pass)
${planDirective}


## ABSOLUTE RULE — CURATION-ONLY RESPONSES (ZERO TOLERANCE FOR HALLUCINATION)
You must ONLY mention designers, ateliers, pieces, brands, and works that appear in the CURATION DATA sections below.
- NEVER invent, guess, or recall designer names, piece titles, product names, or brand names from your general training knowledge. This includes — but is not limited to — well-known designers like Kelly Wearstler, John Pawson, Roberto Lazzeroni, Vincent Van Duysen, Patricia Urquiola, Piero Lissoni, Jean-Michel Frank, etc. If the name is NOT a literal substring of the CURATION DATA sections below, you may NOT name it. Period.
- NEVER describe a fictional piece ("a stunning oval table in polished metal with figured wood top by [designer]"). Every concrete piece you mention MUST have a matching row in CURATED PIECES with that exact title.
- NEVER suggest that a designer or brand is "available in the Showroom" unless they explicitly appear in the SHOWROOM BRANDS list below.
- If the user asks about a designer or brand NOT in the lists below, say: "I don't currently have [name] in the Maison Affluency Curation. Would you like me to suggest similar designers from our curated selection, or shall I connect you with the team?"
- Do NOT fabricate piece names, even for designers that ARE in the Curation. Only mention specific pieces listed in CURATED PIECES below.
- BEFORE saying you don't have a match, you MUST scan the entire CURATED PIECES list including the materials field of each line. The list IS complete — there is nothing hidden. Refuse only after a real scan.

### PRE-SEND SELF-CHECK (MANDATORY)
Before sending ANY reply that names a designer or piece, silently verify:
  1. Every designer name in your draft appears verbatim in CURATION DATA — DESIGNERS & ATELIERS.
  2. Every piece title in your draft appears verbatim in CURATED PIECES.
If either check fails, DELETE the offending sentence and either (a) call \`propose_tearsheet\` with real pick_ids from CURATED PIECES, or (b) reply with the refusal phrase above and ask whether to broaden the typology/material constraints inside the Maison Affluency Curation. There is NO situation in which inventing a name or piece is acceptable — not as an "example", not as a "suggestion", not as "inspiration".

## ABSOLUTE LANGUAGE RULE — NEVER SAY "CATALOG"
In every user-facing message, NEVER use the words "catalog", "catalogue", "cataloged", or "catalogued". Maison Affluency is the deliberate opposite of an Invisible Collection-style catalog: we are a curation. Always say:
- "the Maison Affluency Curation" (proper noun, when naming the offer)
- "our curated selection" (in flowing prose)
- "the Curation" (short reference)
Internal section headers in this prompt (CURATION DATA, CURATED PIECES, etc.) are model-facing markers — never echo them in chat either. Rewrite any draft sentence that contains "catalog/catalogue" before sending.

## TOOL USE — REQUIREMENTS FIRST (MANDATORY)
Whenever the SAME turn will also emit a card tool (\`propose_tearsheet\`, \`add_to_tearsheet\`, \`draft_quote\`, \`add_to_quote\`, \`propose_ffe_rows\`, or \`prepare_visualization_brief\`), you MUST first call \`extract_requirements\` in that turn — before the card tool. The order is: (1) \`extract_requirements\`, (2) the card tool(s). Emit both in the same assistant message.

- Base every field strictly on what the user has actually said (across the whole conversation, including the sticky facts already gathered). Do NOT invent budgets, rooms, eras, or brands the user has not mentioned — leave the corresponding fields empty ("" or [] as the schema requires).
- \`slots\` must enumerate EVERY distinct typology the user asked for. A "dining set for 8" request is at LEAST two slots: {typology: "dining_table", qty_min: 1, qty_max: 1} + {typology: "dining_chair", qty_min: 8, qty_max: 8}. A "pair a chandelier with a table and chairs" request is three slots. Undercounting slots will cause the Inspector Agent to reject the card.
- For single-piece answers, still emit \`extract_requirements\` with a one-item slots array — as long as you are ALSO calling a card tool this turn.
- Do NOT call \`extract_requirements\` on pure-discovery turns (asking sticky-fact questions with no card). It is only paired with a card tool.

HARD CONSTRAINTS — BUDGET & PALETTE (enforced by the Accountant pass):
- When the user states a total budget, put it in \`budget_cents\` + \`budget_currency\`. The Accountant sums \`price_cents\` across every pick_id you propose. If the sum exceeds \`budget_cents\`, the card is REJECTED (event: proposal_blocked). Before emitting the card tool, mentally sum the CURATED PIECES prices from the context above; if you cannot fit the brief in budget, either (a) drop the highest-priced piece and refill with a cheaper matching item, or (b) reply in prose explaining the shortfall and asking whether to raise the budget or reduce scope. Do NOT emit a card you know will exceed the budget.
- When the user names materials or a palette (\`materials\` or \`style\`), every proposed piece MUST reference at least one of those tokens in its title/category/materials. Off-palette items will be REJECTED as \`palette_mismatch\`. If < 2 real on-palette matches exist for a required slot, follow the ZERO-MATCH protocol instead of stuffing off-palette items in.
- Treat these two rules like typology counts: the model does not get to soften them. If in doubt, propose fewer items that comfortably respect both constraints rather than more items that breach one.

## TOOL USE — TEARSHEET DRAFTING (ALWAYS USE A TOOL FOR PRODUCT RECOMMENDATIONS)
You have two tools for tearsheets:
- \`add_to_tearsheet\` — DEFAULT. Append to the user's ⭐ ACTIVE tearsheet (the most-recently-updated non-converted board listed in USER'S EXISTING TEARSHEETS). Use this whenever the user asks for a selection / proposal / curation and they already have at least one existing tearsheet. Also use it when the user explicitly names a different existing board.
- \`propose_tearsheet\` — draft a NEW tearsheet. Use ONLY when (a) the user has NO existing tearsheets, or (b) the user EXPLICITLY asks for a new/separate/fresh tearsheet ("new tearsheet", "start a new board", "fresh selection", "separate edit", "different project").

CRITICAL — NEVER list catalog pieces in plain text. Whenever your reply would mention 2+ catalog pieces by name (e.g. "you might consider X, Y and Z", "I'd recommend the following options:", a numbered/bulleted list of pieces, or a colon-separated "Brand X's Oak Table: …" mini-essay per piece), you MUST instead call \`propose_tearsheet\` (or \`add_to_tearsheet\`) and let the visual card render them. Forbidden prose patterns include: "I'd recommend the following…", "Here are some options…", "Consider the following pieces…", and any newline-separated list where each item names a piece. The card carries the rationale (\`pick_rationales\`) — do NOT also re-explain each piece in chat. After the tool call, ONE short sentence only (e.g. "Here's a first edit — review and amend below.").

SINGLE-PIECE PROSE TRAP — describing ONE piece in prose ("I suggest considering a piece like the 'Elliptical Dining Table' by a renowned designer…", "one piece that caught my eye…", "this table features…") is ALSO FORBIDDEN when the user asked for a selection / proposal / curation / reinterpretation / alternatives. Whenever the user uses verbs like "propose", "suggest", "recommend", "show", "pull", "curate", "reinterpret", "alternatives", "options" → you MUST call \`propose_tearsheet\` with real pick_ids from CURATED PIECES. If you cannot find ≥2 real matches, follow the ZERO-MATCH protocol: state the mismatch plainly and ask whether to broaden typology/material constraints inside the Maison Affluency Curation — do NOT improvise a single fictional piece in prose as a substitute.

ANTI-RAMBLE RULE: Do NOT close with a fresh open-ended question ("could you tell me a bit more about the townhouse's architectural style?") when you already have ≥3 sticky facts. Propose first; refine after the user reacts to the card.

REQUIRED CLOSING AFTER A TEARSHEET CARD: the single short sentence following the tool call must invite the user to react to the SELECTION — never to elaborate on a single piece's materials/finishes in the abstract. Use one of: "Here's a first edit — would you like me to refine this selection against your client's intentions?" / "Draft is ready — shall I adjust the edit (swap pieces, tighten the palette, add/remove a typology)?" / "First edit below — happy to refine on brief once you've reviewed." Never ask "would you like me to elaborate on the materials and finishes available for this piece?" after a multi-piece card.

Single-piece answers (the user asked about ONE specific piece they named) may stay as text. Anything that resembles a curated selection, a mood, a room, a project brief, "show me…", "what do you have in…", "suggest…", "propose…", "pull together…", "reinterpret…" → call \`propose_tearsheet\` immediately.


Rules for both tools:
- pick_ids MUST be the exact UUIDs shown in square brackets next to each pick in CURATED PIECES. Never invent IDs.
- For \`add_to_tearsheet\`, board_id MUST be a UUID from USER'S EXISTING TEARSHEETS — never invent.
- Aim for 4–12 pieces per proposal — enough to feel like a curated edit, not a single suggestion.
- ALWAYS populate \`pick_rationales\` with a short one-sentence \`reason\` for every NEW pick (any id not in the previous KEPT list). When the pick is a REPLACEMENT for a removed item, you MUST also include a longer \`detail\` field — 2–4 editorial sentences expanding on the reason: how the piece converses with the rest of the selection (material, scale, silhouette, palette, designer language) and what it adds vs the item it replaces. Reasons must be specific — never generic ("a great fit").
- LOCKED 🔒 pieces are IMMUTABLE. When the current draft state lists items under a "LOCKED" heading, every one of those pick_ids MUST appear verbatim in your next \`propose_tearsheet\` / \`add_to_tearsheet\` call — same UUID, same position intent, no substitution, no "similar alternative", no dropping. Do NOT include locked ids in \`pick_rationales\` (they are not new picks). Only generate replacements for the UNLOCKED slots. If the user's request would require altering a locked piece, do not silently override it — instead reply in ONE short sentence asking the user to unlock it first, and do NOT emit the tool call.
- After calling a tool, reply with ONE short sentence (e.g. "Here's a draft — review and amend below.") telling the user the draft card is ready. Do NOT re-list the pieces in text; the card already shows them.
- If the user is ambiguous between create-new vs add-to-existing AND they have existing tearsheets, default to \`add_to_tearsheet\` against the ⭐ ACTIVE board. Only call \`propose_tearsheet\` when the user EXPLICITLY asks for a new/separate/fresh tearsheet, or when they have no existing tearsheets at all.
- ACCESS / DELIVERY VERIFICATION on quote drafts — after \`draft_quote\`, \`add_to_quote\` or \`propose_ffe_rows\` returns, IF the quote contains at least one oversized piece (any single crated dimension ≥ 1,800 mm, e.g. sofas, large consoles, armoires, dining tables, beds, chandeliers) AND you have not already asked this in the current conversation, append ONE concierge line after your "draft is ready" sentence asking the user to confirm the binding access constraint for the largest piece (service-elevator car depth/height, stairwell width with landing pivot, doorway height, or courtyard hoist for very large items). Pick the ONE path that matters — never a checklist. Example: "Before we lock the order in, may we verify the clearance of your service elevator for the Pouénat sofa at 2,180 mm crated?" Skip on small-object quotes (lighting, accessories, side tables).

## TOOL USE — FF&E SCHEDULE (ROOM-BY-ROOM BRIEFS)
Use \`propose_ffe_rows\` instead of \`draft_quote\` when the user asks for a SCHEDULE organised by room ("FF&E for the Mayfair townhouse", "drawing-room, dining-room and bedroom edit", "full apartment schedule"). Every row MUST carry a \`room\` label. \`project_id\` is REQUIRED — if there is no ACTIVE PROJECT, ask the user which project to bind to before calling the tool. On approval the rows commit as room-tagged lines on a draft quote and automatically populate the FF&E Schedule view.

## TOOL USE — VISUALIZATION HAND-OFF (AXONOMETRIC STUDIO)
Use \`prepare_visualization_brief\` whenever the user uses a VISUALIZATION verb: "render", "visualise", "visualize", "show me how this would look", "show me in the room", "generate a view/scene/axonometric/render", "mock up", "picture it", "see it in situ", "image of the room with…", "let me see the space". NEVER claim you have generated an image inline — this tool is the only sanctioned path; it emits a card with a "Render Scene" CTA that deep-links the user into Axonometric Studio.

VISUALIZATION ROUTING OVERRIDES TEARSHEET ROUTING. If the user's message contains a visualization verb (above), \`prepare_visualization_brief\` is REQUIRED even when the same sentence also says "overlay these picks", "with these pieces", "using my tearsheet", or similar tearsheet-sounding phrases. The word "render" in particular ALWAYS routes here, never to \`propose_tearsheet\`. Do not interpret "overlay" as a request for a tearsheet — overlay is the compositing action the Axonometric Studio performs.

CHAINED CASE — visualization verb + no prior tearsheet picks in this conversation: emit BOTH tools in the SAME turn, in this exact order — (1) \`propose_tearsheet\` with 4–8 catalog pieces that fit the room/style brief, then immediately (2) \`prepare_visualization_brief\` with mode=\`composite\`, the SAME pick_ids you just put in the tearsheet, and a brief_notes line summarising the directorial intent (palette, mood, lighting, materials). The user gets one tearsheet card + one Render Scene card.

SOLO CASE — visualization verb + the user already has visible picks (e.g. they say "render this tearsheet", "show me these in a Belgravia drawing-room", or they reference a previously approved tearsheet): emit ONLY \`prepare_visualization_brief\` with the existing pick_ids. Do NOT redraft the tearsheet.

Defaults: \`mode\` = \`composite\` when overlaying catalog pieces onto a reference photo (most common); \`stylize\` when restyling an existing render; \`elevation_to_axo\` / \`section_to_axo\` when the user uploaded a 2D drawing. \`style_preset\` defaults to "Editorial Luxury" for trade presentations unless the user specifies otherwise (e.g. "watercolour" → "Watercolor", "Scandi" → "Scandinavian", "line drawing" → "Minimal Line", "photoreal" → "Photorealistic"). Always populate \`brief_notes\` with the room + palette + mood + anchor materials in 1–3 sentences — that is the prompt the studio will use. After the tool call(s), reply with ONE short sentence (e.g. "Here's a first edit and a render brief — tap Render Scene when you're ready to open the studio.").




## TOOL USE — SHIPPING ESTIMATES (MANDATORY FOR FREIGHT/LANDED-COST QUESTIONS)
Whenever the user asks about freight cost, shipping cost, air/sea/road freight, customs duty, VAT/GST, or landed-cost for a specific route — you MUST call the \`estimate_shipping\` tool. NEVER invent or recall shipping numbers from general knowledge — Maison Affluency's rate matrix is the single source of truth.

Required arguments:
- \`origin_country\` / \`dest_country\` — ISO-2 codes (FR, IT, GB, HK, US, SG, AE, …). If the user names a city, infer the country.
- \`total_volume_cbm\` and \`total_weight_kg\` — packed shipment volume and gross weight. If the user does not state them, ask for them OR use a sensible default for the piece type (small object 0.05 cbm / 8 kg, side table 0.15 / 25 kg, lounge chair 0.5 / 35 kg, sofa 1.2 / 80 kg).
- \`declared_value_cents\` — commercial invoice value in CENTS (multiply EUR/USD by 100). NEVER invent or round-guess this. It MUST come from one of: (a) the trade price of the specific catalog piece(s) being shipped, (b) the subtotal of an open quote / tearsheet under discussion, or (c) a value the user has explicitly stated. If none of these are available, DO NOT call the tool — first ask the user: "What's the commercial invoice value of the goods being shipped?" Declared value drives duty, VAT and insurance, so a fabricated figure produces a misleading landed cost.
- \`preferred_mode\` — pass only when the user names one ("by air", "sea LCL"). Otherwise omit so the matrix picks the cheapest lane.

After the tool returns, write a concise breakdown in the user's currency: freight, fuel, insurance, customs/handling, last-mile, duty %, VAT %, and the total. Mention the selected carrier and mode. ALWAYS state the declared value you used and where it came from (e.g. "based on a declared value of €4,200 — the trade price of the Pouénat sconce" or "based on the €18,500 subtotal of your Mayfair quote"), so the client can correct it if wrong. If \`available: false\`, tell the user the lane isn't configured and offer a manual quote.

## TOOL USE — SPATIAL FIT (MANDATORY FOR "DOES IT FIT?" QUESTIONS)
Whenever the user asks whether a specific piece fits in a room, has enough clearance, can be placed, or "works" against their plan — you MUST call \`check_spatial_fit\`. The intended workflow is: room geometry from the uploaded floor plan + product geometry from the CAD/3D file already attached to the product (DWG / FBX / OBJ / SKP). Never eyeball it from dimensions alone.

CONVERSATIONAL SELECTION — the user can pick the room and product entirely in chat:
1. If the user has more than one uploaded plan (see USER'S CAD PLANS), ask which plan; otherwise default to the only one.
2. List the detected rooms of that plan (label + footprint in m) and ask which room to test. If they name a room ("the living room", "dining"), match it case-insensitively to a \`room_label\` from the plan.
3. Ask which piece to check, or use the piece the user is currently discussing. If they describe it by name/designer rather than ID, resolve it against CURATED PIECES below.
4. Product CAD asset: after resolving \`product_id\`, inspect USER'S PRODUCT-ATTACHED CAD ASSETS. If that product has one or more assets, choose the matching variant when possible and include \`cad_asset_id\` in \`check_spatial_fit\`; prefer OBJ when multiple formats exist because it parses today. If the product only has DWG/FBX/SKP, still pass the \`cad_asset_id\`; the checker will record that the asset is attached but unsupported and fall back to declared dimensions until the converter ships. If the product has no attached CAD asset, say so explicitly before confirming and proceed only with declared dimensions.
5. CONFIRMATION STEP (MANDATORY) — once you have a resolved plan + room + piece + product CAD asset status, do NOT call the tool yet. Reply with a single short confirmation message in this exact format, then stop and wait for the user:

   > **Ready to run spatial fit check:**
   > • Floor plan: "{file_name}" \`[cad_document_id: {uuid}]\`
   > • Room: **{ROOM_LABEL}**
   > • Piece: {title} — {designer} \`[product_id: {uuid}]\`
   > • Product CAD: {format/variant or "none attached"} {optional \`[cad_asset_id: {uuid}]\`}
   > • Clearance: {clearance_mm} mm
   >
   > Reply **"go"** to run, or edit any field:
   > — **"change plan"** / "use plan X" → swap \`cad_document_id\`
   > — **"change room to {label}"** → swap \`room_label\`
   > — **"change piece to {name/designer}"** → swap \`product_id\`
   > — **"clearance {N}mm"** → override \`clearance_mm\`
   > — **"cancel"** → drop the check entirely.

6. EDIT HANDLING — when the user replies with any edit phrase (or just names a different room/piece/plan), do NOT run the tool. Apply the change, then VALIDATE each updated field before re-posting:
   - **cad_document_id** — MUST match a \`[cad_document_id: ...]\` in USER'S CAD PLANS. If the user names a plan that isn't there, reply: "I can't find a plan called '{X}'. Your uploaded plans are: {list of file_name + id}. Which one should I use?" and stop — do NOT post a new confirmation until they pick a valid one. ALSO: if the matched plan is tagged ⚠️ NOT READY (no rooms detected), refuse and reply: "'{file_name}' isn't parsed yet — no rooms detected. Pick a plan with detected rooms, or open /trade/spatial-fit to re-parse." Log this as \`failed_validation: "room_not_detected"\`, \`reason: "plan {id} parsed but contains no rooms"\`.
   - **room_label** — MUST case-insensitively match a room label of the currently selected plan. If not, reply: "'{X}' isn't a detected room on '{plan file_name}'. Detected rooms: {comma-separated labels with m footprints}. Which one?" and stop.
   - **product_id** — MUST resolve to a UUID present in CURATED PIECES (by id, or by name/designer match). If ambiguous (multiple matches), list the top 3 candidates with their ids and ask which; if zero matches, say so and ask for a different name. Do NOT post a new confirmation until exactly one piece is resolved. Then resolve the attached product CAD asset from USER'S PRODUCT-ATTACHED CAD ASSETS; if none exists and dimensions are missing, warn: "{title} has no attached CAD asset and no published dimensions — the fit-check will return 'unknown'. Want to pick a different piece, or run it anyway?" Only proceed if they confirm.
   - **clearance_mm** — MUST be a positive integer between 0 and 3000 MILLIMETRES. Accept and convert common units: "50cm"/"50 cm" → 500, "0.6m"/"0.6 m" → 600, "2in"/"2 in"/"2\"" → 51 (round to nearest mm). Strip whitespace and unit suffix before validating. If unparseable, out of range, or zero/negative, ask for a value in mm and stop with \`failed_validation: "clearance_unparseable"\` or \`"clearance_out_of_range"\` as appropriate.

   Only once every changed field passes validation, re-post a fresh confirmation block with ALL fields (plan, room, piece, product CAD asset, clearance) updated. Repeat until the user replies "go"/"yes"/"run it"/"confirm". When the plan changes, also re-validate the previously selected room against the NEW plan's rooms — if it no longer matches, ask the user to pick a room from the new plan before re-posting.
7. Only after an affirmative reply, call \`check_spatial_fit\` with the exact IDs from the most recent confirmation, including \`cad_asset_id\` when an attached product CAD asset exists. Re-validate the IDs against USER'S CAD PLANS, USER'S PRODUCT-ATTACHED CAD ASSETS and CURATED PIECES one last time before the call; if anything no longer resolves, post a corrected confirmation instead of calling the tool. Never call the tool on the same turn as a confirmation or edit.

7a. CANCEL / ABORT — if the user types "cancel", "stop", "never mind", "drop it", "forget it", or otherwise abandons the pending check, do NOT call \`check_spatial_fit\`. Reply with a single short line: "Cancelled — let me know when you'd like to try again." Then call \`log_spatial_fit_edit\` with \`field: "cancel"\`, \`outcome: "accepted"\`, \`requested_value\` = exactly what they typed, plus the pending plan/room/piece/clearance you were about to run. Do not re-post the confirmation block.

7b. SESSION TIMEOUT — a confirmation block is STALE if more than 8 user turns have passed since you posted it without a "go"/edit/cancel reply, OR if the user has clearly pivoted to an unrelated topic (different product family, shipping question, tearsheet work). When you detect staleness: drop the pending check silently, do NOT re-post the old confirmation. If the user comes back to spatial-fit later, start a fresh selection from step 1. Log the stale drop once with \`log_spatial_fit_edit\` \`field: "cancel"\`, \`outcome: "rejected"\`, \`failed_validation: "other"\`, \`reason: "session_timeout"\`, \`turns_since_confirm\`: your best estimate.

7c. POST-RESULT ACTIONS — after \`check_spatial_fit\` returns and you've written the verdict prose, ALWAYS append a single-line footer offering follow-ups, formatted exactly:

   > **Next:** "try {OTHER_ROOM}" • "try another piece" • "tighter clearance ({N}mm)" • "done"

   Pick {OTHER_ROOM} = one other detected room of the same plan (omit the bullet if there is only one room). Pick {N} = the previous clearance minus 100mm, floored at 100. When the user picks one of those shortcuts, treat it as an EDIT on the previous selection (keep plan + piece, change the named field) and re-post a confirmation block — do NOT re-run the tool blindly. "done" or any non-spatial reply = drop the pending state quietly (no cancel audit needed in this case — the previous run already produced a 'result' audit row).

8. AUDIT (MANDATORY) — every turn that touches the spatial-fit picker, also call \`log_spatial_fit_edit\` in parallel. One call per user turn:
   - Initial selection: \`field: "initial"\`, \`outcome: "accepted"\`, with the resolved plan/room/piece you put into the first confirmation block.
   - Successful edit: \`field\` = the changed field (\`cad_document_id\` | \`room_label\` | \`product_id\` | \`clearance_mm\`), \`requested_value\` = what they typed, \`resolved_value\` = the UUID / canonical label / integer, \`outcome: "accepted"\`, plus the FULL current pending state (plan + room + piece + clearance).
   - Rejected edit: \`field\` = the field they tried to change, \`requested_value\` = exactly what they typed, \`outcome: "rejected"\`, and BOTH of the following are REQUIRED — never omit either:
       • \`reason\` — one sentence that names the user's input AND why it failed (e.g. "User asked for 'plan 3' but only 2 plans are uploaded", "'dining' is not among detected rooms LIVING/KITCHEN/BEDROOM", "3 pieces match 'velvet sofa' — needs disambiguation", "clearance 4500mm exceeds 0–3000mm allowed range").
       • \`failed_validation\` — one of: \`plan_not_found\`, \`plan_ambiguous\`, \`room_not_detected\`, \`room_ambiguous\`, \`piece_not_found\`, \`piece_ambiguous\`, \`clearance_out_of_range\`, \`clearance_unparseable\`, \`missing_field\`, \`other\`. Use \`other\` only when nothing else fits.
       Omit \`resolved_value\`.
   - Cancel / abort: handled in 6a — log with \`field: "cancel"\`, \`outcome: "accepted"\` (user-initiated) or \`outcome: "rejected"\` + \`failed_validation: "other"\` + \`reason: "session_timeout"\` (server-initiated stale drop in 6b).
   - Final "go"/"yes"/"run it"/"confirm": \`field: "confirm"\`, \`outcome: "accepted"\`, with the four IDs you are about to pass to \`check_spatial_fit\`. Fire this BEFORE \`check_spatial_fit\` in the same turn.
   - The 'result' audit row is written automatically by the server after each \`check_spatial_fit\` call — do NOT call \`log_spatial_fit_edit\` with \`field: "result"\` yourself.
   Do NOT call \`log_spatial_fit_edit\` outside the spatial-fit flow. Do not narrate the audit call to the user.


Required arguments:
- \`cad_document_id\` — UUID of an UPLOADED floor plan from the USER'S CAD PLANS list below. If the user has none, do NOT call the tool — tell them to upload a DXF (or DWG/FBX/SKP) at /trade/spatial-fit first.
- \`product_id\` — UUID of the trade product. Use the IDs from CURATED PIECES or the piece the user is currently viewing. Never invent.
- \`cad_asset_id\` — UUID of the selected attached product CAD/3D asset from USER'S PRODUCT-ATTACHED CAD ASSETS. Pass it whenever available; do not ask the user to upload the product model as a floor plan.
- \`room_label\` — optional; pass the room name the user picked (e.g. "LIVING", "DINING") so the checker uses the right space. Omit to default to the largest detected room.
- \`clearance_mm\` — optional override; default 600mm. Tighten only when the user explicitly asks (e.g. "ignore clearance").

After the tool returns, lead with the verdict (Fits / Tight / Doesn't fit), state the product footprint vs the room footprint in mm with a metres conversion, then list each reason in plain English. If the verdict is \`fail\`, suggest a smaller variant or a different room. If \`unknown\`, say the geometry is missing and point the user to /trade/spatial-fit. Then append the **Next:** footer described in 6c.

ACCESS / DELIVERY VERIFICATION (MANDATORY on \`pass\` or \`warn\`) — before the **Next:** footer, append ONE editorial line that flags the building-access constraint a fit-check cannot see. Phrase it as a concierge, not a checklist: name the largest crated dimension of the piece, then ask the user to confirm the ONE access path that matters for that dimension (service-elevator car depth/height, stairwell width with landing pivot, doorway height, or — for oversized pieces — courtyard hoist / window removal). Never list all options; pick the binding one. Examples:
> The piece fits your salon perfectly — but at 2,180 mm crated, may we verify the clearance of your service elevator before we commit the order?
> Sits the dining room with room to circulate — at 2.4 m in its crate, could you confirm the staircase width and any landing pivot, since the lift won't take it flat?
Skip this line entirely on \`fail\` or \`unknown\`.

### MULTI-PIECE BATCH (\`check_spatial_fit_batch\`)
When the user asks whether ANY of 2–8 specific pieces fits a single room ("do any of these work in the dining room", "which of these three sofas fits"), call \`check_spatial_fit_batch\` ONCE with all pieces instead of calling \`check_spatial_fit\` repeatedly. Same confirmation rules (steps 1–6) apply: confirm the plan + room + list of pieces before firing. Never mix this with \`check_spatial_fit\` in the same turn.

### RATE LIMIT
The server enforces 20 fit-checks per user per minute (each piece in a batch counts as one). If you get a rate-limit message, tell the user to wait the indicated number of seconds before retrying — do NOT immediately re-call the tool.






## USER'S CAD PLANS (uploaded floor plans)
${cadDocuments}

## USER'S PRODUCT-ATTACHED CAD ASSETS (DWG / FBX / OBJ / SKP)
${productCadAssets}


## ACTIVE PROJECT
${projectContext}

## USER'S OPEN QUOTES
${openQuotes}

## USER'S EXISTING TEARSHEETS
${userBoards}

## CURATION DATA — DESIGNERS & ATELIERS
These are the ONLY designers and ateliers in the Maison Affluency Curation:
${designersList}

## CURATION DATA — CURATED PIECES
Each line is formatted: \`- "title" by Designer (subcategory-or-category · materials) [id: <uuid>]\`. Use those IDs verbatim when calling the tearsheet tools.

PIECE-TYPE FILTERING — when the user asks for a specific TYPE of piece (e.g. "chandeliers", "sconces", "dining tables", "armchairs", "sideboards"):
1. Scan EVERY curated line for that term as a case-insensitive substring across BOTH the title AND the metadata in parentheses (subcategory/category).
2. A piece only qualifies if its title or its subcategory/category explicitly matches. Do NOT include items just because they share the broader category (e.g. "Lighting" alone is NOT a chandelier — only items whose title or subcategory contains "chandelier" qualify). A "Sconce" or a "Lamp" is NOT a "Chandelier".
3. TYPOLOGY IS NON-NEGOTIABLE. A lamp is NOT a table. A bookshelf is NOT a table. A sideboard is NOT a dining table. A cabinet is NOT a table. Shared material (oak, walnut, bronze) is NEVER a substitute for the requested typology — never propose a non-table when the user asked for a table, even if the wood/finish matches the brief.
4. Return ALL qualifying matches. The list IS complete — never truncate or sample.
5. If ZERO curated pieces match the requested typology, DO NOT call \`propose_tearsheet\` with adjacent-category substitutes. Instead reply in prose: state plainly that the Maison Affluency Curation has no [typology] matching the brief today, then ask whether to broaden the typology/material constraints or consider a clearly-framed alternative direction the curated selection DOES cover. Do not apologise, self-correct, mention external archives, or imply there is a hidden search source. Wait for the user to choose before drafting a tearsheet.

CRITICAL SEARCH PROCEDURE — when the user combines designer + material/finish (e.g. "Man of Parts in oak"):
1. First, locate EVERY line where the designer name appears (literal substring scan of the "by X" portion).
2. Then, within those lines, scan the materials portion for the requested term as a case-insensitive substring (e.g. "oak" matches "Solid oak frame").
3. Return ALL matches. Only after a true scan with zero matches may you say "I don't currently have…".

Worked example A: "show me chandeliers" → scan every line for 'chandelier' in title or subcategory → expected matches include Calliope Medium Chandelier, Cloud Chandelier, Carolina Chandelier, Curve XXL Chandelier, Firefly Chandelier, MicMac Chandelier, Bronze MicMac Chandelier. Returning a sconce or table lamp for this query would be a factual error.
Worked example B: "I'm looking for a 340cm oak dining table" → scan every line where title or subcategory contains 'table' (ideally 'dining table'). If none qualify, DO NOT pad the tearsheet with oak lamps, oak bookshelves, or oak sideboards. Reply in prose with a plain no-match notice and ask whether to broaden typology/material constraints OR consider a more modern alternative typology — explicitly framed as an alternative, not a substitute. Never use the word "catalog".

${piecesList}

## SHOWROOM BRANDS
These are the ONLY brands with products currently browsable in the Showroom:
${showroomBrands}

If a brand is in DESIGNERS but NOT in SHOWROOM BRANDS, tell the user: "We represent [name] but their pieces are currently available by inquiry only — I can connect you with the team."

## What you can help with
- **Product discovery**: Suggest designers or pieces FROM THE MAISON AFFLUENCY CURATION ABOVE that match a client brief.
- **Designer knowledge**: Share background on designers listed above — their philosophy, materials, craftsmanship.
- **Specification guidance**: Advise on materials, dimensions, lead times, and care for curated pieces.
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
  if (/\b(show|find|pull|suggest|recommend|propose|curate|compose|draft|quote|tearsheet|add to|put together|list (?:all|every|the)|which .*(?:do you|are)|everything (?:by|from)|in (oak|brass|bronze|marble|leather|mohair|velvet|stone|wood))\b/.test(t)) return true;
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

async function loadCatalogContext(
  supabase: ReturnType<typeof createClient>,
  includePieces: boolean,
  designerFilter?: string[],
  hardConstraints?: HardConstraints,
) {
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

  // Resolve designer filter (if the user named specific designers) into
  // concrete designer_ids + brand-name variants so we only load THEIR rows.
  const filterLc = (designerFilter || [])
    .map((n) => String(n || "").trim().toLowerCase())
    .filter((n) => n.length >= 4);
  const filteredDesignerIds: string[] = [];
  const filteredBrandNames = new Set<string>();
  if (filterLc.length) {
    (designers || []).forEach((d: any) => {
      const nm = String(d.name || "").trim().toLowerCase();
      const dn = String(d.display_name || "").trim().toLowerCase();
      if (filterLc.some((f) => (nm && (nm === f || f.includes(nm))) || (dn && (dn === f || f.includes(dn))))) {
        filteredDesignerIds.push(d.id);
        if (d.name) filteredBrandNames.add(d.name);
        if (d.display_name) filteredBrandNames.add(d.display_name);
      }
    });
  }
  const useDesignerFilter = filterLc.length > 0 && (filteredDesignerIds.length > 0 || filteredBrandNames.size > 0);

  // Fetch curator picks. If a designer filter is active, restrict to that
  // designer's rows — no need to load the full catalog to answer a question
  // scoped to a single named designer.
  let picksQuery = supabase
    .from("designer_curator_picks")
    .select("id, title, materials, category, subcategory, designer_id, trade_price_cents, price_per_sqm_cents, currency, size_variants")
    .order("designer_id", { ascending: true })
    .order("title", { ascending: true })
    .limit(2000);
  if (useDesignerFilter && filteredDesignerIds.length) {
    picksQuery = picksQuery.in("designer_id", filteredDesignerIds);
  }
  if (hardConstraints) {
    picksQuery = applyHardConstraints(picksQuery as any, hardConstraints, {
      text: ["title", "materials", "category", "subcategory"],
      category: "category",
    }) as typeof picksQuery;
  }
  const { data: picks } = includePieces ? await picksQuery : { data: [] as any[] };

  // Trade products — same designer-scoping when a filter is active.
  let tradeQuery = supabase
    .from("trade_products")
    .select("id, product_name, brand_name, materials, category, subcategory, trade_price_cents, rrp_price_cents, currency, price_unit")
    .eq("is_active", true)
    .not("image_url", "is", null)
    .order("brand_name", { ascending: true })
    .order("product_name", { ascending: true })
    .limit(2000);
  if (useDesignerFilter && filteredBrandNames.size) {
    tradeQuery = tradeQuery.in("brand_name", Array.from(filteredBrandNames));
  }
  if (hardConstraints) {
    tradeQuery = applyHardConstraints(tradeQuery as any, hardConstraints, {
      text: ["product_name", "materials", "category", "subcategory"],
      brand: "brand_name",
      category: "category",
    }) as typeof tradeQuery;
  }
  const { data: tradeAll } = includePieces
    ? await tradeQuery
    : await supabase
        .from("trade_products")
        .select("brand_name")
        .eq("is_active", true)
        .not("image_url", "is", null)
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

/** Recent CAD floor plans the user (or any of their studios) has uploaded. */
async function loadCadDocuments(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<string> {
  if (!userId) return "(No user session — Spatial Fit unavailable.)";
  // Studio memberships
  const { data: mems } = await supabase
    .from("studio_members").select("studio_id").eq("user_id", userId);
  const studioIds = (mems || []).map((m: any) => m.studio_id).filter(Boolean);
  let query = supabase
    .from("cad_documents")
    .select("id, file_name, status, parsed_geometry, created_at")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(10);
  if (studioIds.length) {
    query = query.or(`uploaded_by.eq.${userId},studio_id.in.(${studioIds.join(",")})`);
  } else {
    query = query.eq("uploaded_by", userId);
  }
  const { data } = await query;
  if (!data || data.length === 0) {
    return "(No floor plans uploaded yet — direct the user to /trade/spatial-fit to upload a DXF before calling `check_spatial_fit`.)";
  }
  return data.map((d: any) => {
    const rooms = (d.parsed_geometry?.rooms || []) as any[];
    const ready = rooms.length > 0;
    const roomSummary = ready
      ? rooms.slice(0, 6).map((r) => `${r.label || "unlabelled"} (${r.bbox_mm?.w}×${r.bbox_mm?.d}mm)`).join(", ")
      : "NO ROOMS DETECTED — plan not ready for fit-check";
    const flag = ready ? "" : " ⚠️ NOT READY";
    return `- "${d.file_name}" [cad_document_id: ${d.id}]${flag} · rooms: ${roomSummary}`;
  }).join("\n");

}

/** Product-attached CAD/3D assets available to Spatial Fit. */
async function loadProductCadAssets(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const { data } = await supabase
    .from("trade_product_cad_assets")
    .select("id, product_id, variant_label, file_format, version, is_active")
    .eq("is_active", true)
    .in("file_format", ["dwg", "fbx", "obj", "skp"])
    .limit(120);
  if (!data || data.length === 0) {
    return "(No active product-attached DWG/FBX/OBJ/SKP CAD assets are available yet. Use product dimensions as fallback only after saying no product CAD is attached.)";
  }
  return data.map((a: any) => {
    const label = [a.variant_label, a.version].filter(Boolean).join(" · ");
    const parseNote = a.file_format === "obj" ? "parseable now" : "stored, converter pending";
    return `- product_id ${a.product_id} · .${a.file_format}${label ? ` · ${label}` : ""} [cad_asset_id: ${a.id}] · ${parseNote}`;
  }).join("\n");
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
  // The most-recently-updated NON-converted board is the implicit ACTIVE tearsheet.
  // The downstream model must default to `add_to_tearsheet` against this board_id
  // unless the user explicitly asks for a new tearsheet.
  const activeIdx = boards.findIndex((b: any) => b.status !== "converted");
  return boards
    .map((b: any, i: number) => {
      const flag = i === activeIdx ? " ⭐ ACTIVE (default target for add_to_tearsheet)" : "";
      return `- "${b.title}" [board_id: ${b.id}]${b.client_name ? ` · ${b.client_name}` : ""}${b.status ? ` · ${b.status}` : ""}${flag}`;
    })
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
    .select("id, name, client_name, location, status, studio_id, user_id, studios:studio_id(name), clients:client_id(name)")
    .eq("id", projectId)
    .maybeSingle();
  if (!proj) {
    return "(Active project id was provided but not found / not accessible. Treat as no project.)";
  }
  // Tenant isolation: this function uses the service-role client (RLS bypassed),
  // so we MUST verify the caller has access to this project before returning its
  // name, client, location, or studio. Owner OR studio member is allowed.
  // Implemented via shared helper so it stays unit-tested.
  const allowed = await canAccessProject(supabase as any, userId, {
    user_id: (proj as any).user_id ?? null,
    studio_id: (proj as any).studio_id ?? null,
  });
  if (!allowed) {
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
  // Keep only quotes that are either (a) bound to a project, or (b) recently
  // touched (<14d). One-off client pricing requests with no project binding
  // age out so they don't bleed into Discover as if they were active briefs.
  const RECENT_DAYS = 14;
  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: quotes } = await supabase
    .from("trade_quotes")
    .select("id, currency, notes, updated_at, project_id, projects:project_id(name)")
    .eq("user_id", userId)
    .eq("status", "draft")
    .or(`project_id.not.is.null,updated_at.gte.${cutoff}`)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (!quotes || quotes.length === 0) {
    return "(The user has no open draft quotes — only `draft_quote` is available.)";
  }
  return quotes
    .map((q: any) => {
      const project = q.projects?.name ? ` for "${q.projects.name}"` : " (standalone pricing request — not an active brief)";
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

/**
 * Load the user's persistent memory — recurring defaults the concierge has learned
 * (deadline, budget, currency, lead-time ceiling, studio style notes, preferred
 * materials/categories/designers). Returns "" when nothing is on file so the
 * caller can decide whether to render a section.
 */
async function loadUserMemory(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<string> {
  if (!userId) return "";
  const { data, error } = await supabase
    .from("trade_user_memory")
    .select("default_deadline, default_budget_cents, default_currency, preferred_lead_weeks_max, studio_style_notes, style_tags, preferred_materials, preferred_categories, preferred_designers, last_brief_summary, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "";
  const m: any = data;
  const fmtMoney = (cents: number, ccy: string | null) => {
    const amt = Math.round(cents / 100);
    const c = (ccy || "EUR").toUpperCase();
    return `${c} ${amt.toLocaleString("en-US")}`;
  };
  const out: string[] = [];
  if (m.default_deadline) out.push(`- Standing deadline: ${m.default_deadline}`);
  if (m.default_budget_cents) out.push(`- Standing budget: ${fmtMoney(m.default_budget_cents, m.default_currency)}`);
  if (m.preferred_lead_weeks_max) out.push(`- Lead-time ceiling: ${m.preferred_lead_weeks_max} weeks`);
  if (m.studio_style_notes) out.push(`- Studio style: ${String(m.studio_style_notes).slice(0, 400)}`);
  if (Array.isArray(m.style_tags) && m.style_tags.length) out.push(`- Style tags: ${m.style_tags.slice(0, 8).join(", ")}`);
  if (Array.isArray(m.preferred_materials) && m.preferred_materials.length) out.push(`- Preferred materials: ${m.preferred_materials.slice(0, 8).join(", ")}`);
  if (Array.isArray(m.preferred_categories) && m.preferred_categories.length) out.push(`- Preferred categories: ${m.preferred_categories.slice(0, 8).join(", ")}`);
  if (Array.isArray(m.preferred_designers) && m.preferred_designers.length) out.push(`- Preferred designers: ${m.preferred_designers.slice(0, 8).join(", ")}`);
  if (m.last_brief_summary) out.push(`- Last brief recalled: ${String(m.last_brief_summary).slice(0, 240)}`);
  if (!out.length) return "";
  return ["## STUDIO MEMORY (auto-recalled defaults — use unless this turn overrides them)", ...out].join("\n");
}

/**
 * Map a fuzzy budget_band ("under €5k", "€50k-€100k", "€250000") into a cents
 * upper bound. Conservative — only persists when we can extract a concrete
 * number, so we never overwrite real numbers with vague text.
 */
function budgetBandToCents(band: string | null | undefined): { cents: number | null; currency: string | null } {
  if (!band) return { cents: null, currency: null };
  const s = String(band).toLowerCase().replace(/[,\s]/g, "");
  const ccy = s.includes("$") ? "USD" : s.includes("£") ? "GBP" : s.includes("€") ? "EUR" : null;
  // Match patterns like 50k, 250000, 1.2m
  const nums = Array.from(s.matchAll(/(\d+(?:\.\d+)?)(k|m)?/g)).map((m) => {
    let n = parseFloat(m[1]);
    if (m[2] === "k") n *= 1_000;
    else if (m[2] === "m") n *= 1_000_000;
    return n;
  });
  if (!nums.length) return { cents: null, currency: ccy };
  // Use the largest number (upper bound of a range).
  const top = Math.max(...nums);
  if (!Number.isFinite(top) || top <= 0) return { cents: null, currency: ccy };
  return { cents: Math.round(top * 100), currency: ccy };
}

/**
 * Fire-and-forget upsert of inferred defaults extracted from the user's turn.
 * We only persist concrete signals (no nulls) so casual mentions don't wipe
 * out previously-learned values. Arrays are unioned with existing values.
 */
async function persistInferredMemory(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  brief: any,
): Promise<void> {
  if (!userId || !brief) return;
  try {
    const { data: prev } = await supabase
      .from("trade_user_memory")
      .select("default_budget_cents, default_currency, preferred_lead_weeks_max, style_tags, preferred_materials, preferred_categories, preferred_designers")
      .eq("user_id", userId)
      .maybeSingle();
    const patch: Record<string, unknown> = { user_id: userId, source: "concierge" };
    const { cents, currency } = budgetBandToCents(brief.budget_band);
    if (cents) patch.default_budget_cents = cents;
    if (currency) patch.default_currency = currency;
    if (typeof brief.lead_weeks_max === "number" && brief.lead_weeks_max > 0) {
      patch.preferred_lead_weeks_max = brief.lead_weeks_max;
    }
    const unionArr = (a: any, b: any): string[] => {
      const prevArr = Array.isArray(a) ? a.map(String) : [];
      const nextArr = Array.isArray(b) ? b.map(String) : [];
      const merged = Array.from(new Set([...prevArr, ...nextArr].map((s) => s.trim()).filter(Boolean)));
      return merged.slice(0, 24);
    };
    if (Array.isArray(brief.materials) && brief.materials.length) {
      patch.preferred_materials = unionArr(prev?.preferred_materials, brief.materials);
    }
    if (Array.isArray(brief.categories) && brief.categories.length) {
      patch.preferred_categories = unionArr(prev?.preferred_categories, brief.categories);
    }
    if (Array.isArray(brief.designers) && brief.designers.length) {
      patch.preferred_designers = unionArr(prev?.preferred_designers, brief.designers);
    }
    if (brief.style && typeof brief.style === "string") {
      patch.style_tags = unionArr(prev?.style_tags, [brief.style]);
    }
    if (brief.summary && typeof brief.summary === "string") {
      patch.last_brief_summary = String(brief.summary).slice(0, 600);
    }
    // Only one meaningful key beyond user_id/source means nothing to learn.
    if (Object.keys(patch).length <= 2) return;
    await supabase.from("trade_user_memory").upsert(patch, { onConflict: "user_id" });
  } catch (e) {
    console.warn("persistInferredMemory failed:", e);
  }
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
        const resp = await chatFetch( {
          method: "POST",
          headers: { Authorization: `Bearer ${aiAuthKey(apiKey)}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: aiModel(SENTIMENT_MODEL),
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
type BriefPlanTool = "propose_tearsheet" | "add_to_tearsheet" | "draft_quote" | "add_to_quote" | "propose_ffe_rows" | "prepare_visualization_brief";
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
    /**
     * Anchor / centerpiece semantics preserved verbatim from the user's turn.
     * The user's exact anchor phrasing ("show-stopping centerpiece", "statement
     * chandelier", "hero piece", "anchor of the room") — never paraphrased and
     * never collapsed into `style`. Downstream uses this to (a) route to a
     * card tool instead of generic prose, (b) inject an unmistakable anchor
     * directive into the plan, so the concierge never softens the request.
     */
    anchor_role: string | null;
    /** Typology the anchor refers to (dining_table, chandelier, sofa, …), when nameable. */
    anchor_typology: string | null;
    /** Emphasis adjectives the user used (show-stopping, sculptural, dramatic, monumental). */
    emphasis: string[];
  };
  plan: BriefPlanTool[];
};

const EMPTY_BRIEF: ExtractedBrief = {
  intent: "chitchat",
  brief: { summary: "", room: null, style: null, materials: [], categories: [], designers: [], qty_hint: null, lead_weeks_max: null, budget_band: null, anchor_role: null, anchor_typology: null, emphasis: [] },
  plan: [],
};

// ---------------------------------------------------------------------------
// MATERIAL FIDELITY VALIDATOR
// ---------------------------------------------------------------------------
// The upstream planner LLM sometimes silently narrows the user's material
// intent — most commonly by collapsing "glass or crystal" into ["glass"],
// swapping crystal ↔ glass, or dropping a qualifier ("burl walnut" →
// "walnut", "Nero Marquina marble" → "marble"). Every one of those changes
// loses on-brand pieces from the downstream shortlist because the RAG /
// hard-constraint filter tokenizes materials verbatim.
//
// This validator diffs the extracted `materials` array against the raw user
// message and REPAIRS the extraction (never mutates the user's message):
//   1. Explicit crystal/glass parity — if the user said "crystal" we
//      guarantee "crystal" is in the array (and vice versa); if the user
//      said both, both must survive.
//   2. Named material tokens — any material from a curated lexicon that
//      appears in the raw message must also appear (verbatim, lowercase)
//      in the extracted list.
//   3. Qualifier preservation — for compound tokens like "burl walnut",
//      "patinated bronze", "Nero Marquina marble", the FULL span is
//      re-inserted if the extraction only kept the base noun.
//
// Repairs are deterministic (regex-based) and logged so we can spot
// planner regressions in `ai_usage_events`. Fail-open: on any error the
// original extraction is returned unchanged.

const MATERIAL_BASE_TOKENS: readonly string[] = [
  // Stones
  "marble", "onyx", "travertine", "limestone", "bluestone", "granite",
  "quartzite", "slate", "alabaster", "rock crystal", "lapis",
  // Named marbles / stones (qualifiers)
  "nero marquina", "calacatta", "calacatta viola", "statuario", "carrara",
  "verde alpi", "rosso levanto", "portoro", "arabescato", "breccia",
  // Woods
  "oak", "walnut", "mahogany", "rosewood", "ebony", "teak", "cherry",
  "ash", "beech", "maple", "sycamore", "burl walnut", "burl", "olivewood",
  "wenge", "zebrano", "palisander",
  // Metals
  "brass", "bronze", "patinated bronze", "blackened steel", "steel",
  "iron", "copper", "nickel", "silver", "gold", "gilt", "gilded",
  "polished chrome", "chrome", "aluminum", "aluminium",
  // Glass / crystal — parity handled separately too
  "glass", "crystal", "murano", "murano glass", "smoked glass",
  "fluted glass", "reeded glass",
  // Fabrics / finishes
  "leather", "suede", "shagreen", "parchment", "lacquer", "gesso",
  "raffia", "rattan", "wicker", "cane", "linen", "silk", "wool",
  "mohair", "boucle", "bouclé", "velvet", "cashmere", "cotton",
  "hemp", "jute", "sisal",
  // Other
  "porcelain", "ceramic", "terracotta", "concrete", "resin",
];

// Compound → base map so we can detect when only the base survived.
// e.g. if extraction contains "walnut" but raw message contains "burl walnut",
// we replace "walnut" with the full compound so the downstream matcher
// scores burl-walnut pieces higher.
const MATERIAL_COMPOUND_TO_BASE: Record<string, string> = {
  "burl walnut": "walnut",
  "patinated bronze": "bronze",
  "blackened steel": "steel",
  "polished chrome": "chrome",
  "smoked glass": "glass",
  "fluted glass": "glass",
  "reeded glass": "glass",
  "murano glass": "glass",
  "rock crystal": "crystal",
  "nero marquina": "marble",
  "calacatta viola": "marble",
  "calacatta": "marble",
  "statuario": "marble",
  "carrara": "marble",
  "verde alpi": "marble",
  "rosso levanto": "marble",
  "portoro": "marble",
  "arabescato": "marble",
  "breccia": "marble",
};

// Word-boundary regex tuned to avoid matching inside larger words
// (e.g. "cashmere" must not match "mere"). Uses \b at both ends of the
// token pattern (spaces inside the token are literal).
function containsToken(hay: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(hay);
}

export interface MaterialFidelityRepair {
  added: string[];              // tokens the planner missed
  replaced: [string, string][]; // [droppedBase, restoredCompound]
}

export function reconcileMaterialsWithSource(
  extractedMaterials: string[],
  rawUserMessage: string,
): { materials: string[]; repair: MaterialFidelityRepair } {
  const repair: MaterialFidelityRepair = { added: [], replaced: [] };
  if (!rawUserMessage || typeof rawUserMessage !== "string") {
    return { materials: extractedMaterials, repair };
  }
  const raw = rawUserMessage.toLowerCase();
  // Normalize working set to lowercase, dedup, preserve original order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of extractedMaterials) {
    if (typeof m !== "string") continue;
    const t = m.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }

  // Pass 1 — compound restoration. If a compound appears in raw text and
  // extraction contains only its base noun (but NOT the compound), swap
  // the base for the compound so the downstream matcher gets the full
  // qualifier.
  for (const [compound, base] of Object.entries(MATERIAL_COMPOUND_TO_BASE)) {
    if (!containsToken(raw, compound)) continue;
    if (seen.has(compound)) continue;
    const baseIdx = out.indexOf(base);
    if (baseIdx >= 0) {
      out[baseIdx] = compound;
      seen.delete(base);
      seen.add(compound);
      repair.replaced.push([base, compound]);
    } else {
      // Compound was dropped entirely — add it.
      out.push(compound);
      seen.add(compound);
      repair.added.push(compound);
    }
  }

  // Pass 2 — bare token parity. Any base token the user actually named
  // must survive in the array.
  for (const token of MATERIAL_BASE_TOKENS) {
    if (!containsToken(raw, token)) continue;
    if (seen.has(token)) continue;
    // Skip base if a compound-of-this-base is already present (covered).
    const compoundCoversBase = Object.entries(MATERIAL_COMPOUND_TO_BASE)
      .some(([c, b]) => b === token && seen.has(c));
    if (compoundCoversBase) continue;
    out.push(token);
    seen.add(token);
    repair.added.push(token);
  }

  // Pass 3 — explicit crystal/glass parity. If the user named BOTH
  // ("glass or crystal", "crystal and glass"), both MUST survive; the
  // planner has a documented history of dropping crystal.
  const userSaidGlass = containsToken(raw, "glass");
  const userSaidCrystal = containsToken(raw, "crystal");
  const glassCovered = seen.has("glass") || Object.entries(MATERIAL_COMPOUND_TO_BASE).some(([c, b]) => b === "glass" && seen.has(c));
  const crystalCovered = seen.has("crystal") || Object.entries(MATERIAL_COMPOUND_TO_BASE).some(([c, b]) => b === "crystal" && seen.has(c));
  if (userSaidGlass && !glassCovered) {
    out.push("glass");
    seen.add("glass");
    repair.added.push("glass");
  }
  if (userSaidCrystal && !crystalCovered) {
    out.push("crystal");
    seen.add("crystal");
    repair.added.push("crystal");
  }
  // Deduplicate any accidental repair collisions.
  const dedupAdded = Array.from(new Set(repair.added));
  repair.added = dedupAdded;

  return { materials: out.slice(0, 12), repair };
}

async function extractBrief(apiKey: string, latestUserMessage: string): Promise<ExtractedBrief> {
  if (!latestUserMessage || latestUserMessage.length < 4) return EMPTY_BRIEF;
  try {
    const result = await withSemanticCache(
      {
        feature: "trade-concierge-planner-v2",
        model: SENTIMENT_MODEL,
        apiKey,
        prompt: latestUserMessage.slice(0, 1800),
        threshold: 0.93,
        ttlSec: 60 * 60 * 24 * 7,
      },
      async () => {
        const resp = await chatFetch( {
          method: "POST",
          headers: { Authorization: `Bearer ${aiAuthKey(apiKey)}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: aiModel(SENTIMENT_MODEL),
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
                  "- propose_ffe_rows — draft a ROOM-BY-ROOM FF&E schedule bound to the active project (every row has a `room` label)\n" +
                  "- prepare_visualization_brief — hand off to the Axonometric Studio to render/visualise a room or selection (emits a 'Render Scene' card)\n\n" +
                  "Plan rules:\n" +
                  "- chitchat / navigation / FAQ: empty plan.\n" +
                  "- OPENING BRIEFS that merely state what the user is looking for (e.g. 'I'm looking for a statement dining table for my Belgravia townhouse', 'we need lighting for a Mayfair drawing room', 'searching for a sofa for a London penthouse'): EMPTY PLAN. The concierge MUST qualify (style, capacity/scale, materials, era, lead-time) before proposing. Do NOT emit propose_tearsheet on a discovery-style opener no matter how specific the typology.\n" +
                  "- EXPLANATORY follow-ups about pieces already discussed ('why the X?', 'tell me more about X', 'what is X?', 'how does it compare', 'what materials', 'lead time?', 'who designed it'): EMPTY PLAN — the downstream model must answer conversationally in prose. Do NOT re-propose tearsheets or quotes.\n" +
                  "- EXPLICIT selection verbs in THIS message ('propose', 'suggest', 'recommend', 'show me' [WITHOUT 'in the room/space'], 'pull together', 'curate', 'reinterpret', 'alternatives', 'options', 'first edit', 'draft a selection', 'what do you have in…'): default to [add_to_tearsheet] (target the user's ⭐ ACTIVE board). Emit [propose_tearsheet] ONLY if the user has no existing tearsheets OR explicitly says 'new tearsheet' / 'start a new board' / 'fresh selection' / 'separate edit'. Without one of these selection verbs, do NOT emit either tool.\n" +
                  "- ANCHOR / CENTERPIECE cues — recognize ANY of these (case-insensitive, allow trailing 's', hyphen or space variants): 'show-stopping' / 'showstopper' / 'show stopper', 'statement' / 'statement piece' / 'statement feature' / 'statement moment', 'centerpiece' / 'centrepiece', 'centre piece', 'hero' / 'hero piece' / 'hero moment', 'anchor' / 'anchor piece' / 'anchoring piece', 'focal point' / 'focal piece', 'wow factor' / 'wow moment' / 'the wow', 'jaw-dropping', 'stunner', 'showpiece', 'signature piece', 'headline piece' / 'headliner', 'talking point' / 'conversation piece' / 'conversation starter', 'scene-stealer' / 'scene stealer', 'star of the room' / 'star piece', 'crown jewel', 'pièce de résistance', 'tour de force', 'the moment' / 'a moment', 'sculptural moment' / 'sculptural gesture', 'grand gesture', 'the piece that carries the room' / 'that carries the space', 'dramatic', 'monumental', 'imposing', 'grand', 'theatrical', 'unmissable', 'showstopping'. Treat any of these as a STRONG selection cue as soon as ANY typology is nameable in this turn OR present in the sticky context. In that case, emit [add_to_tearsheet] (or [propose_tearsheet] under the same rules as above) instead of falling back to empty plan — the concierge must NEVER answer an anchor request with generic prose. If no typology is nameable and no sticky typology exists, keep empty plan but ALWAYS populate `anchor_role` + `emphasis` so downstream asks a single crisp qualifier ('which typology should carry the room — dining table, chandelier, sofa?').\n" +
                  "- ALWAYS populate `anchor_role` (verbatim user phrasing, e.g. 'show-stopping centerpiece', 'wow-factor chandelier', 'pièce de résistance for the dining room'), `anchor_typology` (snake_case typology if nameable), and `emphasis` (adjectives / cue phrases the user used, lowercased — 'show-stopping', 'statement', 'hero', 'wow factor', 'sculptural', 'dramatic', 'monumental', 'signature', 'crown jewel', etc.) whenever ANY of the cues above appear. Never paraphrase — copy the user's language.\n" +
                  "- MATERIAL FIDELITY — when the user names ANY material, finish, stone, wood, metal, or fabric (e.g. 'crystal', 'onyx', 'travertine', 'burl walnut', 'patinated bronze', 'shagreen', 'parchment', 'lacquer', 'Nero Marquina', 'Calacatta Viola', 'mohair', 'boucle', 'raffia'), copy EVERY named material into `materials` verbatim — including alternatives ('glass or crystal' → ['glass', 'crystal'], 'oak or walnut' → ['oak', 'walnut'], 'onyx, alabaster or rock crystal' → ['onyx', 'alabaster', 'rock crystal']). Never collapse alternatives into a single token, never substitute a generic ('stone' for 'onyx'), never drop the qualifier ('walnut' for 'burl walnut'). The downstream matcher relies on these tokens verbatim to preserve the user's material intent — dropping one silently narrows the shortlist and loses on-brand pieces.\n" +
                  "- 'quote / estimate / pricing breakdown' on already-decided pieces: [draft_quote] (or add_to_quote).\n" +
                  "- 'FF&E schedule / multi-room brief / spec the whole apartment / drawing-room + dining + bedroom' bound to a project: [propose_ffe_rows].\n" +
                  "- VISUALIZATION VERBS in THIS message ('render', 'visualise', 'visualize', 'show me how this would look', 'show me in the room/space', 'generate a view/scene/axonometric/render', 'mock up', 'picture it', 'see it in situ', 'image of the room with…'): emit [prepare_visualization_brief]. If the user has NOT yet seen any tearsheet picks in this conversation AND the visualization request implies overlaying catalog pieces ('with these pieces', 'overlay these picks', 'in bronze and mohair', or any palette/material/style description), CHAIN as [propose_tearsheet, prepare_visualization_brief] so the same picks are drafted and then handed to the studio. The word 'render' ALWAYS triggers prepare_visualization_brief, never tearsheet-only — even if the message also says 'overlay these picks'.\n" +
                  "- BRIEF + QUOTE in the SAME turn (e.g. 'pull together a Mayfair drawing-room and quote me'): emit BOTH in order [propose_tearsheet, draft_quote] so the downstream loop chains them on the same picks.\n" +
                  "Be conservative — only emit a tool if the user CLEARLY intends that action in THIS message. Prior-turn context is NOT a license to act. When in doubt, prefer empty plan and let the downstream model ask one qualifying question.",
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
                      materials: { type: "array", items: { type: "string" }, description: "Every material, finish, stone, wood, metal or fabric the user names — verbatim, including alternatives. 'glass or crystal' → ['glass', 'crystal']. 'oak or walnut' → ['oak', 'walnut']. 'onyx, alabaster or rock crystal' → ['onyx', 'alabaster', 'rock crystal']. Keep qualifiers ('burl walnut', 'patinated bronze', 'Nero Marquina marble'). Never collapse alternatives; never substitute a generic ('stone' for 'onyx')." },
                      categories: { type: "array", items: { type: "string" } },
                      designers: { type: "array", items: { type: "string" } },
                      qty_hint: { type: "integer", minimum: 1, maximum: 99 },
                      lead_weeks_max: { type: "integer", minimum: 1, maximum: 104 },
                      budget_band: { type: "string" },
                      anchor_role: { type: "string", description: "Verbatim user phrasing for the anchor / centerpiece / statement / hero piece (e.g. 'show-stopping centerpiece', 'statement chandelier', 'hero piece of the dining room'). NEVER paraphrase — copy the user's exact wording. Empty string if the user did NOT use anchor/centerpiece/statement/hero cues." },
                      anchor_typology: { type: "string", description: "Normalized snake_case typology the anchor refers to (dining_table, chandelier, sofa, coffee_table, sideboard, bed, rug, mirror, artwork, chair, floor_lamp, table_lamp, credenza, cabinet, console). Empty string if not nameable in this turn." },
                      emphasis: { type: "array", items: { type: "string" }, description: "Cue phrases / adjectives the user used (show-stopping, statement, centerpiece, hero, anchor, focal, wow factor, jaw-dropping, signature, headline, showpiece, scene-stealer, crown jewel, pièce de résistance, tour de force, sculptural, dramatic, monumental, imposing, grand, theatrical, unmissable). Copy verbatim, lowercase. Max 6." },
                      plan: {
                        type: "array",
                        items: { type: "string", enum: ["propose_tearsheet", "add_to_tearsheet", "draft_quote", "add_to_quote", "propose_ffe_rows", "prepare_visualization_brief"] },
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
            anchor_role: (typeof p.anchor_role === "string" && p.anchor_role.trim()) ? p.anchor_role.trim().slice(0, 160) : null,
            anchor_typology: (typeof p.anchor_typology === "string" && p.anchor_typology.trim()) ? p.anchor_typology.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 40) : null,
            emphasis: Array.isArray(p.emphasis) ? p.emphasis.filter((s: unknown): s is string => typeof s === "string" && !!s.trim()).map((s: string) => s.trim().toLowerCase().slice(0, 32)).slice(0, 6) : [],
          },
          plan: Array.isArray(p.plan) ? p.plan.filter((t: string) => ["propose_tearsheet", "add_to_tearsheet", "draft_quote", "add_to_quote", "propose_ffe_rows", "prepare_visualization_brief"].includes(t)) as BriefPlanTool[] : [],
        };
        return { value, usage: data?.usage };
      },
    );
    logAiUsage({
      feature: "trade-concierge-planner-v2",
      model: SENTIMENT_MODEL,
      usage: result.usage,
      cached: result.cached,
      promptHash: result.promptHash,
      tier: "cheap",
    }).catch(() => {});
    // Material-fidelity repair — runs even on cache hits so freshly-added
    // lexicon entries take effect immediately.
    const brief = result.value;
    try {
      const { materials, repair } = reconcileMaterialsWithSource(brief.brief.materials, latestUserMessage);
      if (repair.added.length || repair.replaced.length) {
        console.log(
          `[concierge] material_fidelity_repair added=${JSON.stringify(repair.added)} replaced=${JSON.stringify(repair.replaced)} original=${JSON.stringify(brief.brief.materials)} final=${JSON.stringify(materials)}`,
        );
        brief.brief = { ...brief.brief, materials };
      }
    } catch (e) {
      console.error("material_fidelity_repair failed:", e);
    }
    return brief;
  } catch (e) {
    console.error("brief planner failed:", e);
    return EMPTY_BRIEF;
  }
}

function buildPlanDirective(extracted: ExtractedBrief): string {
  const b = extracted.brief;
  const anchorLine = b.anchor_role
    ? `⚑ ANCHOR REQUEST — the user framed this as: "${b.anchor_role}"${b.anchor_typology ? ` (typology: ${b.anchor_typology})` : ""}${b.emphasis.length ? ` [emphasis: ${b.emphasis.join(", ")}]` : ""}. Treat this as a non-negotiable brief slot — reserve the marquee position in any card for this piece, keep the user's exact framing in the closing sentence, and do NOT dilute the request into generic prose about "a beautiful room". If no card is being proposed this turn, ask exactly ONE crisp qualifier that unblocks the anchor (typology, material, or scale) — never a laundry list.`
    : null;

  if (!extracted.plan.length) {
    if (anchorLine) {
      return [
        anchorLine,
        "(No tool calls planned this turn — reply with ONE crisp qualifier for the anchor, then stop. Do not restate the brief back at the user; do not describe imaginary pieces.)",
      ].join("\n");
    }
    return "(No tool calls planned this turn — reply conversationally. Default tone applies.)";
  }
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
    anchorLine || "",
    "Structured brief:",
    parts.length ? parts.join("\n") : "  (no extracted fields)",
    "",
    `Execution plan: ${planStr}`,
    tail,
  ].filter(Boolean).join("\n");
}

/** Retrieve top-K relevant catalog pieces via pgvector instead of loading 2000 rows. */
async function loadRelevantPieces(

  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  query: string,
  userId: string | null,
  k = 40,
  hardConstraints?: HardConstraints,
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
    // Over-fetch when hard constraints will filter the shortlist, so we still
    // have enough survivors for the AI to reason over.
    const wantsConstraintFilter = !!hardConstraints && (
      (hardConstraints.materials?.length || 0) +
      (hardConstraints.colors?.length || 0) +
      (hardConstraints.categories?.length || 0) > 0
    );
    const matchCount = wantsConstraintFilter ? Math.min(k * 4, 200) : k;
    const { data: rawData, error } = await supabase.rpc("match_catalog", {
      query_embedding: vec as any,
      match_count: matchCount,
    });
    if (error || !Array.isArray(rawData) || rawData.length < 5) {
      if (error) console.error("match_catalog rpc failed:", error.message);
      return null;
    }
    // Post-filter the pgvector shortlist with the same token dictionary the
    // SQL path uses, so hard constraints (color, material, category, brand
    // exclusion) apply identically whether we use vector or bulk SQL.
    const data = wantsConstraintFilter
      ? filterRowsByHardConstraints(rawData, hardConstraints!).slice(0, k)
      : rawData.slice(0, k);
    if (data.length < 5) {
      // Filter too strict — fall back to unfiltered top-K rather than blank.
      console.warn("[concierge RAG] hard constraints filtered <5 rows; falling back", {
        constraints: hardConstraints,
        preFilter: rawData.length,
      });
      return { contextText: "", rows: [] };
    }
    const fmtLead = (r: any) => (r.lead_time ? String(r.lead_time).trim() : "");
    const fmtStock = (r: any) => (r.stock_status ? String(r.stock_status).trim() : "");
    const fmtShip = (r: any) =>
      r.default_ship_mode
        ? ({ sea_lcl: "sea (LCL)", sea_fcl: "sea (FCL)", air: "air", road: "road", courier: "courier" } as Record<string, string>)[
            String(r.default_ship_mode)
          ] || String(r.default_ship_mode)
        : "";
    const fmtPrice = (r: any) => {
      if (!r.trade_price_cents || r.trade_price_cents <= 0) return "Price on Request";
      const amt = Math.round(r.trade_price_cents / 100).toLocaleString("en-US");
      const cur = r.currency || "EUR";
      const px = r.price_prefix ? `${r.price_prefix} ` : "";
      return `${px}${cur} ${amt}`;
    };

    const lines = data.map((r: any) => {
      const meta = [r.subcategory || r.category, r.materials].filter(Boolean).join(" · ");
      const facts = [
        fmtLead(r) && `lead ${fmtLead(r)}`,
        fmtStock(r) && `stock ${fmtStock(r)}`,
        r.origin && `origin ${r.origin}`,
        fmtShip(r) && `ships ${fmtShip(r)}`,
        `price ${fmtPrice(r)}`,
      ]
        .filter(Boolean)
        .join(" · ");
      return `- "${r.title}" by ${r.designer}${meta ? ` (${meta})` : ""} — ${facts} [id: ${r.id}]`;
    });

    // ---- Aggregate "collective" context so the model can reason across the set ----
    const parseLeadWeeks = (s: string): [number, number] | null => {
      if (!s) return null;
      const m = String(s).toLowerCase().match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(week|wk|month|mo)/);
      if (!m) return null;
      const mult = m[3].startsWith("mo") ? 4 : 1;
      const lo = parseInt(m[1], 10) * mult;
      const hi = m[2] ? parseInt(m[2], 10) * mult : lo;
      return [lo, hi];
    };
    const leadRanges = data.map((r: any) => parseLeadWeeks(r.lead_time || "")).filter(Boolean) as [number, number][];
    const withLead = leadRanges.length;
    const leadMin = withLead ? Math.min(...leadRanges.map((r) => r[0])) : null;
    const leadMax = withLead ? Math.max(...leadRanges.map((r) => r[1])) : null;
    const inStockCount = data.filter((r: any) => /in[\s_-]?stock|available|ready/i.test(String(r.stock_status || ""))).length;
    const originCounts: Record<string, number> = {};
    for (const r of data as any[]) if (r.origin) originCounts[r.origin] = (originCounts[r.origin] || 0) + 1;
    const topOrigins = Object.entries(originCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([o, n]) => `${o} (${n})`)
      .join(", ");
    const materialCounts: Record<string, number> = {};
    for (const r of data as any[]) {
      const mats = String(r.materials || "")
        .split(/[,;/·]+/)
        .map((m: string) => m.trim().toLowerCase())
        .filter(Boolean);
      for (const m of mats) materialCounts[m] = (materialCounts[m] || 0) + 1;
    }
    const topMaterials = Object.entries(materialCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([m, n]) => `${m} (${n})`)
      .join(", ");

    const summaryBits = [
      `${data.length} pieces retrieved`,
      withLead ? `lead-time range ${leadMin}–${leadMax} weeks (parsed from ${withLead}/${data.length} items)` : null,
      inStockCount ? `${inStockCount} flagged in stock / ready` : null,
      topOrigins ? `origins: ${topOrigins}` : null,
      topMaterials ? `common materials: ${topMaterials}` : null,
    ].filter(Boolean);

    const contextText = [
      "Note: the lines below are the curated pieces most semantically relevant to the user's latest query (top-K retrieval, not the full Curation). If the user asks for a broad scan and nothing here matches, say so plainly and ask whether to broaden typology/material constraints inside the Maison Affluency Curation.",
      "",
      `Collective context (reason across the whole set, not just individual items): ${summaryBits.join(" · ")}. Use this to make holistic statements when relevant (e.g. "all of these ship within 4 weeks", "the whole edit is European-made", "most pieces share an oak / brass palette"). Only assert a collective fact when it truly holds for every item you propose.`,
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

type RequestedTypology = "dining_table" | "table";

function inferBudgetCeilingCents(requestText: string): { cents: number; label: string } | null {
  const text = String(requestText || "");
  if (!text.trim()) return null;
  const budgetCue = /\b(?:under|below|less\s+than|up\s+to|max(?:imum)?|budget(?:\s+of)?|not\s+over|no\s+more\s+than)\b/i;
  if (!budgetCue.test(text)) return null;
  const match = text.match(/\b(?:under|below|less\s+than|up\s+to|max(?:imum)?|budget(?:\s+of)?|not\s+over|no\s+more\s+than)\b[^$€£\d]{0,24}(?:[$€£]\s*)?(\d+(?:[.,]\d+)?)(\s*(?:k|m|000))?\s*(?:usd|eur|gbp|dollars?|euros?|pounds?)?/i)
    || text.match(/(?:[$€£]\s*)(\d+(?:[.,]\d+)?)(\s*(?:k|m|000))?\s*(?:usd|eur|gbp|dollars?|euros?|pounds?)?/i);
  if (!match) return null;
  const raw = Number(match[1].replace(",", "."));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const suffix = String(match[2] || "").trim().toLowerCase();
  const units = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : suffix === "000" ? 1_000 : 1;
  return { cents: Math.round(raw * units * 100), label: match[0].trim() };
}

function inferRequestedTypology(brief: ExtractedBrief["brief"], requestText: string): RequestedTypology | null {
  const hay = normalizeLoose([
    requestText,
    brief.summary,
    brief.room,
    brief.style,
    ...(brief.categories || []),
  ].filter(Boolean).join(" "));
  if (/\bdining\b/.test(hay) && /\btables?\b/.test(hay)) return "dining_table";
  if (/\btables?\b/.test(hay)) return "table";
  return null;
}

function rowMatchesRequestedTypology(row: any, typology: RequestedTypology | null): boolean {
  if (!typology) return true;
  const title = normalizeLoose(row?.title || row?.product_name);
  const category = normalizeLoose(row?.category);
  const subcategory = normalizeLoose(row?.subcategory);
  const hay = `${title} ${category} ${subcategory}`;
  const isLightingOrLamp = /\b(table\s+lights?|table\s+lamps?|lamp|lamps|lighting|sconce|sconces|chandelier|chandeliers)\b/.test(hay);
  if (isLightingOrLamp) return false;
  if (typology === "dining_table") {
    return /\bdining\b/.test(hay) && /\btables?\b/.test(hay);
  }
  return /\btables?\b/.test(hay) && !/\b(sideboard|cabinet|bookshelf|bookcase|shelf|shelving)\b/.test(hay);
}

function dedupePreviewRows(previewRaw: any[], pickIds: string[]): { previewRaw: any[]; pickIds: string[] } {
  const seenTitleKey = new Set<string>();
  const seenImageKey = new Set<string>();
  const kept: any[] = [];
  // Helper — collapse scraper-injected variant noise like "Scala Dining Table",
  // "Scala 3Dining Table", "Scala 300 Dining Table" into one canonical key.
  const stripVariantNoise = (s: string) =>
    s.replace(/\b\d+\b/g, " ")        // drop standalone numbers (size codes)
     .replace(/(\d)([a-z])/gi, "$1 $2") // split "3Dining" → "3 Dining"
     .replace(/([a-z])(\d)/gi, "$1 $2")
     .replace(/\s+/g, " ")
     .trim();
  for (const p of previewRaw || []) {
    const designerKey = normalizeLoose(p?.designer_name);
    const rawTitleKey = normalizeLoose(p?.title);
    const cleanTitleKey = normalizeLoose(stripVariantNoise(String(p?.title || "")));
    const titleKey = `${designerKey}::${cleanTitleKey || rawTitleKey}`;
    // Second guard: same brand + identical image_url ⇒ same product family
    // even if the titles diverge ("Scala 30Dining Table" vs "Scala 300 Dining Table").
    const imageKey = p?.image_url ? `${designerKey}::${String(p.image_url).split("?")[0]}` : "";
    if (!titleKey) continue;
    if (seenTitleKey.has(titleKey)) continue;
    if (imageKey && seenImageKey.has(imageKey)) continue;
    seenTitleKey.add(titleKey);
    if (imageKey) seenImageKey.add(imageKey);
    kept.push(p);
  }
  const keptIds = new Set(kept.map((p: any) => p?.id).filter(Boolean));
  return { previewRaw: kept, pickIds: pickIds.filter((id) => keptIds.has(id)) };
}

// typologyLabel + buildNoStrictTypologyReply live in a dedicated module so
// they can be unit-tested without importing this whole file (see
// no_strict_typology_reply_test.ts). Re-exported for backwards compat.
export { buildNoStrictTypologyReply, typologyLabel };

function buildOpeningBriefDiscoveryReply(latestUserMessage: string, langCode = "en"): string {
  const lower = (latestUserMessage || "").toLowerCase();
  const wantsDiningTable = /\bdining\s+table\b/.test(lower);
  const location = /\bbelgravia\b/.test(lower) ? "Belgravia" : (lower.match(/\b(mayfair|chelsea|knightsbridge|kensington|notting hill|marylebone)\b/)?.[1] || null);
  const property = /\bgcb\b|\bgood class bungalow\b/.test(lower) ? "Good Class Bungalow"
    : /\btownhouse\b/.test(lower) ? "townhouse"
    : (lower.match(/\b(penthouse|villa|apartment|house|mews|shophouse|bungalow|condominium|condo|palazzo|brownstone|loft|yal[ıi]|riad|hacienda|hutong|machiya|altbau|greystone)\b/)?.[1] || null);
  const piece = wantsDiningTable ? "a statement dining table" : "a statement piece";
  const place = [location, property].filter(Boolean).join(" ").trim();
  const mirror = place ? `${piece} for your ${place}` : piece;
  if (langCode === "id") return `${mirror.charAt(0).toUpperCase() + mirror.slice(1)} — sebuah proyek yang menyenangkan. Sebelum saya menyusun seleksi, bolehkah saya bertanya tentang skala dan suasana yang Anda bayangkan — meja yang lebih formal dan sculptural untuk menjamu, atau sesuatu yang lebih hangat dan residential untuk penggunaan sehari-hari? Dan kira-kira berapa tamu yang ingin Anda akomodasi?`;
  if (langCode === "th") return `${mirror.charAt(0).toUpperCase() + mirror.slice(1)} — ฟังดูเป็นโปรเจกต์ที่น่าตื่นเต้น ก่อนที่ฉันจะคัดสรรชิ้นงาน ขออนุญาตถามถึงบรรยากาศที่คุณต้องการ — เน้นความเป็นทางการและประติมากรรมสำหรับการรับรอง หรืออบอุ่นแบบ residential สำหรับใช้ในชีวิตประจำวัน? และต้องการรองรับผู้รับประทานกี่ท่านโดยประมาณ?`;
  if (langCode === "zh") return `${mirror}——听起来是一个非常迷人的项目。在我为您甄选之前,可否请教您所设想的氛围:是更正式、富雕塑感、适合宴客的方向,还是更温暖、贴近日常的住宅气质?另外,理想中希望容纳多少位用餐者?`;
  return `${mirror.charAt(0).toUpperCase() + mirror.slice(1)} — that sounds like a wonderful project. Before I curate a selection, may I ask about the atmosphere you have in mind — something more formal and sculptural for entertaining, or warmer and more residential for everyday use? And roughly how many diners would you like to seat?`;
}

async function fetchStrictTypologyCandidates(
  supabase: ReturnType<typeof createClient>,
  typology: RequestedTypology,
): Promise<any[]> {
  const term = typology === "dining_table" ? "dining" : "table";
  const [pickRes, tradeRes] = await Promise.all([
    supabase
      .from("designer_curator_picks")
      .select("id, title, materials, category, subcategory, trade_price_cents, currency")
      .or(`title.ilike.%${term}%,subcategory.ilike.%${term}%,category.ilike.%${term}%`)
      .limit(160),
    supabase
      .from("trade_products")
      .select("id, product_name, materials, category, subcategory, trade_price_cents, rrp_price_cents, currency")
      .eq("is_active", true)
      .or(`product_name.ilike.%${term}%,subcategory.ilike.%${term}%,category.ilike.%${term}%`)
      .limit(160),
  ]);
  return [
    ...(pickRes.data || []),
    ...(tradeRes.data || []).map((r: any) => ({ ...r, title: r.product_name, trade_price_cents: r.trade_price_cents ?? r.rrp_price_cents ?? null })),
  ].filter((r: any) => rowMatchesRequestedTypology(r, typology));
}

// Common city / country abbreviations mapped to canonical full names.
// Keep keys lowercased and free of punctuation — matched via normalizeLoose.
const LOCATION_ALIASES: Record<string, string> = {
  sg: "Singapore", sgp: "Singapore",
  hk: "Hong Kong", hkg: "Hong Kong",
  bkk: "Bangkok",
  jkt: "Jakarta", cgk: "Jakarta",
  hcm: "Ho Chi Minh City", hcmc: "Ho Chi Minh City", saigon: "Ho Chi Minh City",
  han: "Hanoi",
  kl: "Kuala Lumpur", kul: "Kuala Lumpur",
  mnl: "Manila",
  tpe: "Taipei",
  pvg: "Shanghai", sha: "Shanghai",
  pek: "Beijing", bjs: "Beijing",
  hnd: "Tokyo", nrt: "Tokyo", tyo: "Tokyo",
  icn: "Seoul", sel: "Seoul",
  del: "Delhi", bom: "Mumbai", blr: "Bengaluru", maa: "Chennai",
  nyc: "New York", ny: "New York", jfk: "New York", manhattan: "New York",
  la: "Los Angeles", lax: "Los Angeles",
  sf: "San Francisco", sfo: "San Francisco",
  dc: "Washington DC", "washington dc": "Washington DC",
  mia: "Miami",
  chi: "Chicago", ord: "Chicago",
  yyz: "Toronto", yvr: "Vancouver",
  dxb: "Dubai", auh: "Abu Dhabi", doh: "Doha", ruh: "Riyadh", jed: "Jeddah",
  ldn: "London", lon: "London", lhr: "London",
  cdg: "Paris", par: "Paris",
  mxp: "Milan", lin: "Milan", mil: "Milan",
  fco: "Rome",
  bcn: "Barcelona", mad: "Madrid",
  ber: "Berlin", muc: "Munich", fra: "Frankfurt", ham: "Hamburg",
  ams: "Amsterdam", bru: "Brussels", vie: "Vienna", zrh: "Zurich", gva: "Geneva",
  mc: "Monaco", mco: "Monaco",
  syd: "Sydney", mel: "Melbourne",
  gru: "São Paulo", gig: "Rio de Janeiro", mex: "Mexico City",
  jnb: "Johannesburg", cpt: "Cape Town",
  ist: "Istanbul", ath: "Athens",
  uae: "United Arab Emirates", uk: "United Kingdom", gb: "United Kingdom",
  usa: "United States", us: "United States",
};

function expandLocationAlias(raw: string): string {
  const key = normalizeLoose(raw);
  return LOCATION_ALIASES[key] || raw;
}

const LOCATION_ONLY_FOLLOWUPS = new Set([
  "london", "new york", "los angeles", "miami", "paris", "milan", "rome", "geneva", "zurich",
  "monaco", "dubai", "abu dhabi", "doha", "riyadh", "jeddah", "hong kong", "singapore",
  "sydney", "melbourne", "tokyo", "seoul", "toronto", "vancouver", "gb", "uk", "united kingdom",
  "usa", "united states", "france", "italy", "switzerland", "uae",
  "bangkok", "jakarta", "ho chi minh city", "hanoi", "kuala lumpur", "manila", "taipei",
  "shanghai", "beijing", "delhi", "mumbai", "bengaluru", "chennai", "washington dc",
  "chicago", "san francisco", "sao paulo", "são paulo", "rio de janeiro", "mexico city",
  "johannesburg", "cape town", "istanbul", "athens",
  ...Object.keys(LOCATION_ALIASES),
]);

function propertyExamplesForLocation(loc: string): string {
  const l = expandLocationAlias(loc).toLowerCase();
  if (/singapore/.test(l)) return "a Good Class Bungalow, a Sentosa Cove waterfront villa, a shophouse conservation home or a sky-terrace condominium";
  if (/hong kong/.test(l)) return "a Peak villa, a Mid-Levels apartment, a harbour-front penthouse or a Repulse Bay house";
  if (/dubai/.test(l)) return "a Palm Jumeirah villa, an Emirates Hills mansion, a Downtown penthouse or a Dubai Hills estate";
  if (/abu dhabi/.test(l)) return "a Saadiyat Island villa, an Al Raha Beach residence or a Corniche penthouse";
  if (/doha/.test(l)) return "a Pearl-Qatar villa, a West Bay penthouse or a Lusail waterfront residence";
  if (/riyadh/.test(l)) return "a Diplomatic Quarter villa, a Hittin compound residence or a KAFD penthouse";
  if (/jeddah/.test(l)) return "an Obhur waterfront villa, a Corniche penthouse or a private compound residence";
  if (/new york|nyc|manhattan|brooklyn|hamptons/.test(l)) return "a Fifth Avenue prewar co-op, a Tribeca loft, an Upper East Side townhouse, a Central Park penthouse or a Hamptons oceanfront estate";
  if (/los angeles|beverly hills|bel.?air|malibu/.test(l)) return "a Beverly Hills estate, a Bel-Air villa, a Hollywood Hills modernist or a Malibu oceanfront home";
  if (/miami/.test(l)) return "a Star Island waterfront estate, an Indian Creek villa, a Miami Beach penthouse or a Coconut Grove residence";
  if (/san francisco|bay area/.test(l)) return "a Pacific Heights mansion, a Nob Hill penthouse or a Marin waterfront home";
  if (/chicago/.test(l)) return "a Gold Coast greystone, a Lincoln Park townhouse or a Lake Shore Drive penthouse";
  if (/boston/.test(l)) return "a Back Bay brownstone, a Beacon Hill townhouse or a Seaport penthouse";
  if (/washington|d\.?c\.?\b/.test(l)) return "a Georgetown townhouse, a Kalorama residence or an Embassy Row mansion";
  if (/aspen|jackson|vail/.test(l)) return "a slopeside chalet, a mountain contemporary lodge or a ranch estate";
  if (/toronto/.test(l)) return "a Rosedale mansion, a Yorkville penthouse or a Forest Hill residence";
  if (/vancouver/.test(l)) return "a Point Grey residence, a Coal Harbour penthouse or a West Vancouver waterfront home";
  if (/paris/.test(l)) return "a Haussmannian apartment, a hôtel particulier, a Left Bank pied-à-terre or an Avenue Montaigne penthouse";
  if (/london|belgravia|mayfair|chelsea|knightsbridge|kensington|notting hill|marylebone|gb|uk|united kingdom/.test(l)) return "a Georgian townhouse, a Belgravia stucco-fronted house, a Mayfair penthouse or a mews house";
  if (/milan/.test(l)) return "a Brera palazzo apartment, a Quadrilatero penthouse or a Lake Como villa";
  if (/rome|italy/.test(l)) return "a Parioli apartment, a Centro Storico palazzo or a Tuscan country villa";
  if (/madrid/.test(l)) return "a Salamanca apartment, a La Moraleja villa or a Barrio de Salamanca penthouse";
  if (/barcelona/.test(l)) return "an Eixample modernist apartment, a Pedralbes villa or a beachfront penthouse";
  if (/lisbon|portugal/.test(l)) return "a Príncipe Real palacete, a Chiado apartment or a Cascais oceanfront villa";
  if (/berlin/.test(l)) return "a Charlottenburg altbau, a Mitte penthouse or a Grunewald villa";
  if (/munich|frankfurt|hamburg|germany/.test(l)) return "a Bogenhausen villa, an Altbau apartment or a lakeside residence";
  if (/vienna/.test(l)) return "a Ringstrasse Altbau, an Innere Stadt apartment or a Hietzing villa";
  if (/amsterdam|netherlands/.test(l)) return "a canal-house on the grachtengordel, an Oud-Zuid townhouse or a penthouse on the IJ";
  if (/brussels|antwerp|belgium/.test(l)) return "an Art Nouveau townhouse, a Zavel apartment or a Uccle villa";
  if (/copenhagen|stockholm|oslo|helsinki|nordic|scandinavia/.test(l)) return "a waterfront apartment, a heritage townhouse or an archipelago summer villa";
  if (/monaco|monte.?carlo/.test(l)) return "a Carré d'Or penthouse, a Monte-Carlo apartment or a Cap-d'Ail villa";
  if (/geneva|zurich|switzerland/.test(l)) return "a lakefront villa, an alpine chalet, a city penthouse or a Cologny estate";
  if (/moscow|russia/.test(l)) return "a Patriarshiye Ponds apartment, a Rublyovka mansion or a city penthouse";
  if (/istanbul|turkey/.test(l)) return "a Bosphorus yalı, a Nişantaşı apartment or a Bebek waterfront residence";
  if (/athens|greece/.test(l)) return "a Kolonaki apartment, a Kifisia villa or an island residence";
  if (/tokyo/.test(l)) return "a low-rise machiya-style residence, an Aoyama or Azabu tower penthouse or a Kamakura hillside villa";
  if (/seoul/.test(l)) return "a Hannam-dong residence, a Gangnam penthouse or a hillside villa in Seongbuk-dong";
  if (/shanghai/.test(l)) return "a French Concession lane house, a Bund-facing penthouse or a Xintiandi apartment";
  if (/beijing/.test(l)) return "a Hutong courtyard residence, a CBD penthouse or a Shunyi villa";
  if (/bangkok|thailand/.test(l)) return "a Sukhumvit penthouse, a Sathorn condominium or a private compound residence";
  if (/jakarta|bali|indonesia/.test(l)) return "a Menteng residence, an SCBD penthouse or a Bali cliff-front villa";
  if (/kuala lumpur|malaysia/.test(l)) return "a KLCC penthouse, a Bukit Tunku bungalow or a Damansara Heights villa";
  if (/manila|philippines/.test(l)) return "a Forbes Park mansion, a Bonifacio penthouse or a Dasmariñas villa";
  if (/mumbai|delhi|bengaluru|india/.test(l)) return "a South Mumbai sea-facing apartment, a Lutyens bungalow or a Lonavala weekend villa";
  if (/sydney/.test(l)) return "a harbour-front residence in Point Piper or Vaucluse, a Paddington terrace or a Palm Beach villa";
  if (/melbourne/.test(l)) return "a Toorak mansion, a South Yarra terrace or a Mornington Peninsula coastal home";
  if (/sao paulo|são paulo|brazil/.test(l)) return "a Jardins apartment, a Morumbi mansion or a Trancoso beach house";
  if (/rio/.test(l)) return "a Leblon penthouse, a Jardim Botânico residence or a Búzios villa";
  if (/mexico city|cdmx|mexico/.test(l)) return "a Polanco penthouse, a Lomas de Chapultepec mansion or a San Miguel de Allende hacienda";
  if (/buenos aires|argentina/.test(l)) return "a Recoleta apartment, a Palermo townhouse or a Punta del Este beachfront villa";
  if (/cape town|johannesburg|south africa/.test(l)) return "a Clifton bungalow, a Bishopscourt estate or a Camps Bay villa";
  return "a townhouse, a penthouse, a villa or a signature apartment";
}


function buildLocationOnlyReply(latestUserMessage: string, history: any[], langCode = "en"): string | null {
  const normalized = normalizeLoose(latestUserMessage);
  if (!LOCATION_ONLY_FOLLOWUPS.has(normalized)) return null;
  const display = expandLocationAlias(latestUserMessage.trim().replace(/\s+/g, " "));
  const recent = history
    .slice(-6)
    .map((m: any) => (typeof m?.content === "string" ? m.content : ""))
    .join("\n")
    .toLowerCase();

  const examples = propertyExamplesForLocation(display);
  if (/\b(ship|shipping|freight|delivery|deliver|landed|customs|vat|destination|route|white[- ]glove)\b/.test(recent)) {
    if (langCode === "id") return `${display} — saya catat. Untuk saat ini, boleh ceritakan sedikit tentang proyeknya: apakah ini ${examples}; brief utamanya; dan suasana yang ingin Anda bangun?`;
    if (langCode === "th") return `${display} — รับทราบค่ะ ตอนนี้ขอรายละเอียดโครงการอีกเล็กน้อยได้ไหม: เป็น ${examples}; brief โดยรวม; และบรรยากาศที่ต้องการ?`;
    if (langCode === "zh") return `${display} — 已记录。先请您简单补充项目本身：是 ${examples}；整体 brief；以及您想营造的氛围？`;
    return `${display} — noted. For now, can you tell me a little about the project itself — is it ${examples}, your brief in general, and the atmosphere you have in mind?`;
  }

  if (/\b(project|site|location|install|installation|client|address|city|where)\b/.test(recent)) {
    if (langCode === "id") return `${display} — saya catat sebagai alamat proyek. Ceritakan tentang proyeknya: ruangnya, brief, dan atmosfer yang sedang Anda susun; setelah itu saya bisa mulai mengkurasi. Pengiriman kita bahas nanti, setelah pilihannya lebih jelas.`;
    if (langCode === "th") return `${display} — รับทราบเป็นที่อยู่โครงการค่ะ เล่าเพิ่มเติมเกี่ยวกับโครงการได้เลย: ห้อง, brief และบรรยากาศที่คุณกำลังวางไว้ แล้วฉันจะเริ่มคัดสรรให้ ส่วนการจัดส่งค่อยดูเมื่อเลือกชิ้นงานแล้ว.`;
    if (langCode === "zh") return `${display} — 已记录为项目地址。请告诉我项目本身：空间、brief，以及您正在塑造的氛围；我会据此开始策展。运输我们可以等作品确定后再处理。`;
    return `${display} — noted as the project address. Tell me about the project itself: the room, the brief, the atmosphere you're composing, and I'll begin curating accordingly. Shipping we'll address in good time, once the pieces are chosen.`;
  }
  if (langCode === "id") return `${display} — saya catat. Boleh saya konfirmasi, ini alamat proyek atau hanya kota yang Anda maksud? Bagaimanapun, ceritakan sedikit tentang proyeknya — ruang, brief, dan mood — lalu kita lanjut dari sana.`;
  if (langCode === "th") return `${display} — รับทราบค่ะ ขอถามยืนยันว่าเป็นที่อยู่โครงการ หรือเป็นเมืองที่คุณมีอยู่ในใจ? ไม่ว่าจะอย่างไร เล่าเพิ่มอีกนิดเกี่ยวกับโครงการ — ห้อง, brief และ mood — แล้วเราจะเดินต่อจากตรงนั้น.`;
  if (langCode === "zh") return `${display} — 已记录。请问这是项目地址，还是您心中的城市？无论哪种，请简单说明项目——空间、brief 和 mood——我们就从那里开始。`;
  return `${display} — noted. May I ask whether that is the project address, or simply a city you have in mind? Either way, tell me a little about the project — the room, the brief, the mood — and we'll take it from there.`;
}

function sseTextResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
}

function sseProposalThenTextResponse(proposal: unknown, text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
}

function sseProposalsThenTextResponse(proposals: unknown[], text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const proposal of proposals) {
        controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
}

function buildRequirementsBlockedMessage(violations: any[]): string {
  const kinds = new Set((violations || []).map((v: any) => v?.kind).filter(Boolean));
  if (kinds.has("budget_over")) {
    return "I’m going to hold the tearsheet rather than show a draft that exceeds the budget. I need to reduce scope or broaden the pricing band before proposing real pieces.";
  }
  if (kinds.has("budget_unpriced")) {
    return "I’m going to hold the tearsheet rather than imply the edit fits budget while one or more pieces are Price on Request. I need priced alternatives or approval to include POR pieces.";
  }
  if (kinds.has("capacity_unverified") || kinds.has("shape_unverified")) {
    return "I’m going to hold the tearsheet rather than show pieces that don’t verify the stated shape or seating requirement. I need a confirmed matching table before proposing the edit.";
  }
  if (kinds.has("palette_mismatch")) {
    return "I’m going to hold the tearsheet rather than show pieces that don’t match the stated material or finish constraints. I need to widen the palette or find closer matches.";
  }
  if (kinds.has("slot_undelivered")) {
    return "I’m going to hold the tearsheet rather than show a draft that under-delivers the requested pieces. I need to broaden the typology or adjust the brief first.";
  }
  return "I’m going to hold the tearsheet rather than show a draft that does not satisfy the brief. I need to refine the constraints first.";
}

function validateProposalAgainstBrief(
  proposal: any,
  requestText: string,
  explicitRequirements?: RequirementsPayload | null,
) {
  const requirements = mergeRequirementsWithText(explicitRequirements as any, requestText);
  const previews = Array.isArray(proposal?.preview) ? proposal.preview : [];
  const gt = buildInspectorGroundTruth([{ tool: String(proposal?.tool || "unknown"), pickIds: [], previews }]);
  return { requirements, validation: validateRequirementsCoverage(requirements as any, gt) };
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
      .select("id, title, image_url, materials, category, dimensions, designer_id, trade_price_cents, currency")
      .in("id", pickIds),
    supabase
      .from("trade_products")
      .select("id, product_name, brand_name, image_url, materials, category, dimensions, trade_price_cents, rrp_price_cents, currency")
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

  // ── Sibling-image fallback ──────────────────────────────────────────────
  // Some product variants (e.g. "Lyric Desk" in a specific finish) live as
  // their own row with no image_url, while sibling variants under the same
  // brand ("Lyric Desk Walnut", "Lyric Desk x Pierre Frey") do carry photos.
  // Borrow a sibling's image so the tearsheet card always renders a thumb.
  const missingPicks = (picks || []).filter((p: any) => !p.image_url && p.title);
  const missingTrades = (trades || []).filter((t: any) => !t.image_url && t.product_name);
  const siblings: Array<{ name: string; brand: string; image_url: string }> = [];
  const escapeOr = (s: string) => s.replace(/[,()%]/g, "").trim().slice(0, 40);
  if (missingPicks.length || missingTrades.length) {
    const titles = Array.from(new Set(
      [...missingPicks.map((p: any) => p.title), ...missingTrades.map((t: any) => t.product_name)]
        .map(escapeOr).filter(Boolean)
    ));
    if (titles.length) {
      const tradeOr = titles.map((t) => `product_name.ilike.%${t}%`).join(",");
      const pickOr = titles.map((t) => `title.ilike.%${t}%`).join(",");
      const [{ data: tradeSibs }, { data: pickSibs }] = await Promise.all([
        supabase.from("trade_products").select("product_name, brand_name, image_url").not("image_url", "is", null).or(tradeOr),
        supabase.from("designer_curator_picks").select("title, image_url, designer_id").not("image_url", "is", null).or(pickOr),
      ]);
      (tradeSibs || []).forEach((s: any) => {
        if (s.image_url) siblings.push({ name: s.product_name, brand: String(s.brand_name || ""), image_url: s.image_url });
      });
      const sibDesignerIds = Array.from(new Set((pickSibs || []).map((s: any) => s.designer_id).filter(Boolean)));
      const { data: sibDesigners } = sibDesignerIds.length
        ? await supabase.from("designers").select("id, name, display_name").in("id", sibDesignerIds)
        : { data: [] as any[] };
      const sibDmap = new Map<string, string>();
      (sibDesigners || []).forEach((d: any) => sibDmap.set(d.id, d.display_name || d.name));
      (pickSibs || []).forEach((s: any) => {
        if (s.image_url) siblings.push({ name: s.title, brand: sibDmap.get(s.designer_id) || "", image_url: s.image_url });
      });
    }
  }

  const resolveSiblingImage = (productName: string, brand?: string | null): string | null => {
    const nName = normName(productName);
    if (!nName) return null;
    const nBrand = normBrand(brand || "");
    for (const s of siblings) {
      const sName = normName(s.name);
      if (!sName) continue;
      const nameMatch = sName === nName || sName.startsWith(nName) || nName.startsWith(sName);
      if (!nameMatch) continue;
      if (!nBrand) return s.image_url;
      const sBrand = normBrand(s.brand);
      if (!sBrand) continue;
      if (sBrand.includes(nBrand) || nBrand.includes(sBrand)) return s.image_url;
    }
    return null;
  };

  return pickIds
    .map((id) => {
      const p = pickById.get(id);
      if (p) {
        const designer = dmap.get(p.designer_id) || null;
        const fallback = !p.image_url
          ? (resolveHotspotImage(p.title, designer) || resolveSiblingImage(p.title, designer))
          : null;
        return {
          id: p.id,
          title: p.title,
          image_url: p.image_url || fallback,
          image_from_hotspot: !p.image_url && !!fallback,
          materials: p.materials,
          category: p.category,
          dimensions: p.dimensions || null,
          designer_name: designer,
          price_cents: typeof p.trade_price_cents === "number" ? p.trade_price_cents : null,
          currency: p.currency || null,
        };
      }
      const t = tradeById.get(id);
      if (t) {
        const rawBrand = String(t.brand_name || "");
        const baseBrand = rawBrand.includes(" - ") ? rawBrand.split(" - ")[0].trim() : rawBrand.trim();
        const fallback = !t.image_url
          ? (resolveHotspotImage(t.product_name, baseBrand) || resolveSiblingImage(t.product_name, baseBrand))
          : null;
        return {
          id: t.id,
          title: t.product_name,
          image_url: t.image_url || fallback,
          image_from_hotspot: !t.image_url && !!fallback,
          materials: t.materials,
          category: t.category,
          dimensions: t.dimensions || null,
          designer_name: baseBrand || null,
          price_cents:
            typeof t.trade_price_cents === "number"
              ? t.trade_price_cents
              : typeof t.rrp_price_cents === "number"
                ? t.rrp_price_cents
                : null,
          currency: t.currency || null,
        };
      }
      return null;
    })
    .filter(Boolean);
}


async function buildDeterministicTearsheetProposal(
  supabase: ReturnType<typeof createClient>,
  ragRows: any[],
  brief: ExtractedBrief["brief"],
  requestText: string,
): Promise<any | null> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const requestedTypology = inferRequestedTypology(brief, requestText);
  const scoreRow = (r: any) => {
    const hay = `${r?.title || ""} ${r?.category || ""} ${r?.subcategory || ""} ${r?.materials || ""}`.toLowerCase();
    let score = Number(r?.similarity || 0);
    if (/\bdining\b/.test(hay)) score += 3;
    if (/\btable\b/.test(hay)) score += 2;
    if (/\b(oak|walnut|wood|timber)\b/.test(hay)) score += 1;
    return score;
  };
  let candidateRows = (ragRows || [])
    .filter((r: any) => r && typeof r.id === "string" && UUID_RE.test(r.id))
    .filter((r: any) => rowMatchesRequestedTypology(r, requestedTypology))
    .sort((a: any, b: any) => scoreRow(b) - scoreRow(a));
  if (candidateRows.length < 2 && requestedTypology) {
    candidateRows = (await fetchStrictTypologyCandidates(supabase, requestedTypology))
      .filter((r: any) => r && typeof r.id === "string" && UUID_RE.test(r.id))
      .sort((a: any, b: any) => scoreRow(b) - scoreRow(a));
  }
  const pickIds = Array.from(new Set(candidateRows
    .sort((a: any, b: any) => scoreRow(b) - scoreRow(a))
    .map((r: any) => r.id)
  )).slice(0, 8);
  if (pickIds.length < 2) return null;
  const hydratedRaw = await hydratePickPreview(supabase, pickIds);
  const validIds = new Set(hydratedRaw.map((p: any) => p?.id).filter(Boolean));
  const previewById = new Map(hydratedRaw.map((p: any) => [p?.id, p]).filter(([id]) => !!id));
  const validPickIds = pickIds.filter((id) => validIds.has(id) && rowMatchesRequestedTypology(previewById.get(id), requestedTypology));
  const { previewRaw, pickIds: finalIds } = dedupePreviewRows(
    hydratedRaw.filter((p: any) => validPickIds.includes(p?.id)),
    validPickIds,
  );
  if (finalIds.length < 2) return null;
  const rationaleMap: Record<string, { reason: string }> = {};
  for (const p of previewRaw) {
    if (!p?.id || !finalIds.includes(p.id)) continue;
    const meta = [p.category, p.materials].filter(Boolean).join(" · ");
    rationaleMap[p.id] = { reason: meta ? `Validated from the Curation for its ${meta}.` : "Validated from the Maison Affluency Curation for this brief." };
  }
  const preview = previewRaw
    .filter((p: any) => finalIds.includes(p?.id))
    .map((p: any) => ({ ...p, rationale: rationaleMap[p.id]?.reason || null }));
  return {
    tool: "propose_tearsheet",
    tool_call_id: crypto.randomUUID(),
    args: {
      title: brief.room ? `${brief.room} first edit` : "Curated first edit",
      pick_ids: finalIds,
      note: "Validated directly against the Maison Affluency Curation.",
      pick_rationales: rationaleMap,
    },
    preview,
  };
}

function buildVisualizationBriefProposal(args: {
  title?: string | null;
  room?: string | null;
  style?: string | null;
  materials?: string[];
  summary?: string | null;
  requestText: string;
  pickIds?: string[];
  preview?: any[];
}) {
  const room = args.room || (/belgravia/i.test(args.requestText) ? "Belgravia drawing-room" : "Scene render");
  const style = /editorial luxury/i.test(args.requestText) ? "Editorial Luxury" : (args.style || "Editorial Luxury");
  const materials = args.materials?.length ? args.materials.join(", ") : "the material palette explicitly requested by the user";
  const pieceInstruction = args.preview?.length
    ? "Use only the attached Maison Affluency pieces as overlay candidates"
    : "Do not invent product names; wait for source imagery or selected pieces if needed";
  return {
    tool: "prepare_visualization_brief",
    tool_call_id: `synthetic-viz-${crypto.randomUUID()}`,
    args: {
      mode: "composite",
      style_preset: "Editorial Luxury",
      title: (args.title || `${room} render brief`).slice(0, 80),
      room_label: room,
      brief_notes: `${room}: ${args.summary || args.requestText} Render in ${style} with ${materials}. ${pieceInstruction}; keep the brief grounded in the user's request with careful scale, sightlines and material fidelity.`.slice(0, 1200),
      pick_ids: (args.pickIds || []).slice(0, 12),
      source_image_url: null,
    },
    preview: (args.preview || []).slice(0, 12),
  };
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
    logCorsInspection(req, "preflight");
    return new Response(null, { headers: corsHeaders });
  }
  // Single end-to-end trace id for this HTTP invocation. Honored from the
  // client (x-request-id) when supplied, otherwise minted here. Propagated
  // to the initial SSE `event: request_id` frame AND every Inspector log
  // entry so a run can be traced client → edge → inspector.
  const requestId = req.headers.get("x-request-id") || (crypto?.randomUUID?.() ?? `req-${Date.now()}`);
  logCorsInspection(req, "request", requestId);

  // ── Per-request pre-LLM stage tracer ──────────────────────────────────
  // Each `mark(stage, meta?)` records elapsed time since request start and
  // delta since the previous mark. Flushed as a single JSON log line:
  //  • right before the first LLM call (`phase: "pre_llm"`)
  //  • on client abort (`phase: "aborted"`) — reveals which stage was live
  //    when the frontend stall watchdog killed the stream
  //  • on any thrown error (`phase: "error"`)
  const traceT0 = performance.now();
  let traceTPrev = traceT0;
  const traceStages: Array<{ stage: string; at_ms: number; dt_ms: number; meta?: unknown }> = [];
  const mark = (stage: string, meta?: unknown) => {
    const now = performance.now();
    traceStages.push({
      stage,
      at_ms: Math.round(now - traceT0),
      dt_ms: Math.round(now - traceTPrev),
      ...(meta !== undefined ? { meta } : {}),
    });
    traceTPrev = now;
  };
  let traceFlushed = false;
  const flushTrace = (phase: "pre_llm" | "aborted" | "error", extra?: unknown) => {
    if (traceFlushed) return;
    traceFlushed = true;
    try {
      console.log(
        `[concierge trace] ${JSON.stringify({
          phase,
          requestId,
          total_ms: Math.round(performance.now() - traceT0),
          stages: traceStages,
          ...(extra !== undefined ? { extra } : {}),
        })}`,
      );
    } catch { /* logging must never throw */ }
  };
  try {
    req.signal?.addEventListener?.("abort", () => {
      const last = traceStages[traceStages.length - 1]?.stage ?? "start";
      flushTrace("aborted", { last_completed_stage: last });
    });
  } catch { /* signal may be unavailable in some runtimes */ }
  mark("start");

  if (req.method !== "POST") {
    console.warn(`[concierge cors_block] ${JSON.stringify({ phase: "request", requestId, method: req.method, reason: "method_not_allowed_at_handler" })}`);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST, OPTIONS" },
    });
  }

  try {
    const auth = await requireUser(req);
    mark("auth", { ok: auth.ok });
    if (!auth.ok) {
      return new Response(JSON.stringify(auth.body), {
        status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rl = rateLimit(`concierge:${auth.userId}`, 20, 60_000);
    mark("rate_limit", { ok: rl.ok });
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", retry_in: rl.retryInSec }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, project_id: bodyProjectId, lang: bodyLang, resume: resumeBody } = await req.json();
    mark("parse_body", { messages: Array.isArray(messages) ? messages.length : 0 });

    // ----- Resume-token short-circuit ------------------------------------
    // A reconnecting client sends `{ resume: { stream_id, last_seq } }`.
    // We stream persisted SSE frames with seq > last_seq from the DB and
    // return before entering the normal (expensive) RAG/model pipeline.
    // If the token is unknown/expired/not-owned we return 410 so the
    // client can fall back to its partial-text continuation path.
    if (resumeBody && typeof resumeBody === "object") {
      const streamId = typeof (resumeBody as any).stream_id === "string" ? (resumeBody as any).stream_id : null;
      const lastSeq = Number((resumeBody as any).last_seq ?? 0);
      if (!streamId) {
        return new Response(JSON.stringify({ error: "resume.stream_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supaResume = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const resp = await serveResume({
        supabase: supaResume,
        userId: auth.userId,
        streamId,
        lastSeq,
        corsHeaders,
      });
      if (resp) return resp;
      return new Response(JSON.stringify({ error: "resume token unknown or expired" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const activeProjectId: string | null = typeof bodyProjectId === "string" ? bodyProjectId : null;
    // Reply-language directive — the UI exposes a language picker (en/id/th/zh).
    // Without this the long English system prompt drowns out the user-message
    // language note and the model defaults to English even when the greeting
    // is in Bahasa/Thai/Chinese. Inject as a hard prefix on the system prompt.
    const LANG_NAME_MAP: Record<string, string> = {
      en: "English",
      id: "Bahasa Indonesia",
      th: "Thai",
      zh: "Simplified Chinese",
    };
    const langCode = typeof bodyLang === "string" && LANG_NAME_MAP[bodyLang] ? bodyLang : "en";
    const langName = LANG_NAME_MAP[langCode];
    const languageDirective = `## ABSOLUTE RULE — REPLY LANGUAGE\nReply ENTIRELY in ${langName}, regardless of the language of these instructions or the language the user writes in. The user has selected ${langName} in the concierge language picker. Every sentence — greetings, questions, mirroring, tearsheet captions, "Next:" footers — MUST be in ${langName}. The only exceptions are proper nouns (designer names, brand names, product titles, city names) and UUIDs. Do not switch to English even if the system prompt or catalogue context below is written in English.\n\n`;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Messages may be multimodal: content can be a string or an array of
    // typed parts (text / image_url / file). For all heuristics below we
    // need plain text — extract the concatenated text from the last user
    // message, but leave the original message intact when we forward to the
    // gateway so image/PDF parts reach the vision model.
    const extractText = (content: any): string => {
      if (typeof content === "string") return content;
      if (!Array.isArray(content)) return "";
      return content
        .filter((p) => p && p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join(" ");
    };
    let lastUserMsg = extractText(
      [...messages].reverse().find((m: any) => m.role === "user")?.content,
    );

    // ── Skip/exclude confirmation gate ────────────────────────────────────
    // When the user asks us to skip items, we don't build the tearsheet
    // right away — we first echo the skip/keep breakdown and wait for
    // an explicit confirmation on the next turn. The prior assistant reply
    // carries an invisible marker so we can detect the confirmation turn
    // and rehydrate the original request.
    const SKIP_CONFIRM_MARKER = "\u2063SKIP-CONFIRM\u2063"; // invisible sentinel
    // Accept a broad set of affirmations, in short standalone replies OR
    // as the leading intent of a slightly longer message ("yes please",
    // "go ahead and build it", "approve — thanks"). Reject anything that
    // opens with a negation ("no", "not yet", "hold on", "wait").
    const CONFIRM_PHRASE_RE =
      /^\s*(?:please\s+)?(yes|yep|yeah|yup|ya|sure|of\s*course|absolutely|definitely|certainly|correct|confirm(?:ed|s|ing)?(?:\s+all(?:\s+remaining)?)?|approve[ds]?(?:\s+all(?:\s+remaining)?)?|keep\s+(?:all|the\s+rest|everything|remaining)|commit\s+(?:all|everything|remaining)|ship\s+(?:it|all|everything)|accept\s+all|all\s+(?:remaining|good|set)|proceed(?:\s+with\s+all)?|go\s*(?:ahead|for\s*it)?|do\s*it|build(?:\s*(?:it|all))?|create(?:\s*(?:it|all))?|make(?:\s*it)?|ok(?:ay)?|okey|accept(?:ed)?|agreed?|sounds\s*good|looks\s*good|lgtm|let['’]?s\s*(?:go|do\s*(?:it|this))|👍|✅|🚀)\b/i;
    const NEGATION_LEAD_RE =
      /^\s*(?:no+|nope|nah|not\s+yet|hold\s+on|wait|stop|cancel|abort|actually|instead|but|change|revise|amend|edit|remove|add)\b/i;
    const isConfirmationReply = (m: string) => {
      const t = (m || "").trim();
      if (!t) return false;
      if (NEGATION_LEAD_RE.test(t)) return false;
      return CONFIRM_PHRASE_RE.test(t);
    };
    let isConfirmingSkip = false;
    {
      const reversed = [...messages].reverse();
      const priorAssistantIdx = reversed.findIndex((m: any) => m.role === "assistant");
      const priorAssistant = priorAssistantIdx >= 0 ? reversed[priorAssistantIdx] : null;
      const priorAssistantText = extractText(priorAssistant?.content);
      if (
        priorAssistantText.includes(SKIP_CONFIRM_MARKER) &&
        isConfirmationReply(lastUserMsg)
      ) {
        // Find the user message that came BEFORE the prior assistant reply.
        const before = reversed.slice(priorAssistantIdx + 1);
        const originalUser = before.find((m: any) => m.role === "user");
        const originalText = extractText(originalUser?.content);
        if (originalText) {
          isConfirmingSkip = true;
          lastUserMsg = originalText;
        }
      }
    }
    const hasAttachments = [...messages].some(
      (m: any) =>
        m?.role === "user" &&
        Array.isArray(m.content) &&
        m.content.some((p: any) => p?.type === "image_url" || p?.type === "file"),
    );
    const userConversationText = messages
      .filter((m: any) => m?.role === "user")
      .map((m: any) => extractText(m.content))
      .join("\n")
      .toLowerCase();
    const stickyFactPatterns = [
      /\b(dining(?: room)?|dining table|table)\b/,
      /\b(12\s*(?:pax|people|persons?|seater|seats?)|twelve\s*(?:pax|people|persons?|seater|seats?)|seat(?:ing)?\s*(?:capacity\s*)?(?:for\s*)?(?:12|twelve))\b/,
      /\b(elegant|refined|not too formal|relaxed|formal|casual|warm|cozy|cosy|earthy|sophisticated|entertain(?:ing)?)\b/,
      /\b(wood|oak|walnut|timber|finish(?:es)?|marble|brass|bronze|stone)\b/,
      /\b(london|belgravia|townhouse|house|apartment|villa|penthouse)\b/,
      /\b(handmade|one[- ]of[- ]a[- ]kind|designer|brand|edition|open(?:ed)? to both|both)\b/,
    ];
    const stickyFactCount = stickyFactPatterns.filter((re) => re.test(userConversationText)).length;
    const shouldActOnAccumulatedBrief = /\b(dining(?: room)?|dining table|table)\b/.test(userConversationText) && stickyFactCount >= 3;
    const lacksUploadedRoomContext = !hasAttachments && !/\b(room plan|floor plan|layout|pdf|photo|image|drawing|elevation|attached|uploaded|paperclip|\d+(?:\.\d+)?\s*(?:m|metres?|meters?|ft|feet|sqm|sq\.?\s*m|square))\b/.test(userConversationText);

    // Ultra-fast deterministic path for one-word location follow-ups like
    // "London". These were going through the full RAG/planner/main-model
    // pipeline even though no catalog reasoning is needed.
    const locationOnlyReply = buildLocationOnlyReply(lastUserMsg, messages, langCode);
    if (locationOnlyReply) return sseTextResponse(locationOnlyReply);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userId: string = auth.userId;

    // Daily token cap (skip for admins). Soft block with friendly message.
    if (await isOverDailyCap(supabase, userId)) {
      mark("daily_cap", { over: true });
      return new Response(
        JSON.stringify({ error: "You've reached today's concierge usage limit. Please come back tomorrow — or reach the team directly for urgent requests." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    mark("daily_cap", { over: false });

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
    mark("designers_query", { count: designerNames.length, needsPieces: heuristicNeedsPieces });

    // Short follow-ups (≤4 words, no catalog keywords) skip the classifier +
    // planner round-trips entirely — they were dominating latency on replies
    // like "London", "yes", "go on". Defaults match each helper's own fallback.
    const wordCount = lastUserMsg.trim().split(/\s+/).filter(Boolean).length;
    const isShortFollowUp = wordCount <= 4 && !heuristicNeedsPieces;

    const mentionedProjectIdPromise = activeProjectId ? Promise.resolve(null) : resolveMentionedProjectId(supabase, userId, lastUserMsg);
    // Hard-constraint pre-filter derived from the user's latest message:
    // color + material tokens the caller has stated (e.g. "forest green oak
    // dining table"). Applied to BOTH the pgvector RAG shortlist and the
    // bulk SQL catalog load so the AI never sees candidates that violate
    // a stated constraint. Empty on discovery turns → no filtering.
    const preRequestConstraints = deriveHardConstraints(
      [{ title: lastUserMsg }],
    );
    const hasAnyPreConstraint =
      (preRequestConstraints.materials?.length || 0) +
      (preRequestConstraints.colors?.length || 0) > 0;
    if (hasAnyPreConstraint) {
      console.log("[concierge hard-constraints]", JSON.stringify(preRequestConstraints));
    }
    // Run sentiment + RAG retrieval in parallel with the rest. RAG is best-effort.
    const timed = async <T,>(name: string, p: Promise<T>): Promise<T> => {
      const s = performance.now();
      try {
        const v = await p;
        mark(`bundle:${name}`, { ms: Math.round(performance.now() - s), ok: true });
        return v;
      } catch (e) {
        mark(`bundle:${name}`, { ms: Math.round(performance.now() - s), ok: false, err: (e as Error)?.message });
        throw e;
      }
    };
    const ragPromise = (heuristicNeedsPieces || lastUserMsg.length > 40)
      ? loadRelevantPieces(supabase, LOVABLE_API_KEY, lastUserMsg, userId, 40, hasAnyPreConstraint ? preRequestConstraints : undefined)
      : Promise.resolve(null);
    const bundleT0 = performance.now();
    const [sentiment, extractedBrief, ragResult, userBoards, userSignals, userMemory, mentionedProjectId, openQuotes, discountRow, cadDocuments, productCadAssets] = await Promise.all([
      isShortFollowUp
        ? Promise.resolve({ sentiment: "neutral", intent: "question", escalate: false, needs_catalog: false })
        : timed("classifySentiment", classifySentiment(LOVABLE_API_KEY, lastUserMsg)),
      isShortFollowUp ? Promise.resolve(EMPTY_BRIEF) : timed("extractBrief", extractBrief(LOVABLE_API_KEY, lastUserMsg)),
      timed("rag", ragPromise),
      timed("userBoards", loadUserBoards(supabase, userId)),
      timed("userSignals", loadUserSignals(supabase, userId)),
      timed("userMemory", loadUserMemory(supabase, userId)),
      timed("mentionedProject", mentionedProjectIdPromise),
      timed("openQuotes", loadOpenQuotes(supabase, userId)),
      timed("tradeTier", supabase.from("profiles").select("trade_tier").eq("id", userId).maybeSingle()),
      timed("cadDocuments", loadCadDocuments(supabase, userId)),
      timed("productCadAssets", loadProductCadAssets(supabase)),
    ]);
    mark("rag_bundle_all", { total_ms: Math.round(performance.now() - bundleT0) });

    // Selection verbs must appear in the LATEST user message to authorize a
    // tearsheet proposal. Otherwise the turn is treated as discovery — the
    // model must ask clarifying questions instead of jumping straight to a
    // curated edit. This prevents both (a) one-line opening briefs like
    // "I'm looking for a statement dining table for my Belgravia townhouse"
    // from auto-proposing, and (b) sticky-fact context from PRIOR turns or
    // semantic-cache hits from leaking a stale "selection" plan into a new
    // exploratory turn.
    const lastUserMsgLower = lastUserMsg.toLowerCase();
    const hasVisualizationVerb = /\b(render|visualise|visualize|mock up|picture it|see it in situ|generate (?:a )?(?:view|scene|axonometric|render)|show me (?:how this would look|in (?:the )?(?:room|space))|image of the room|let me see the space)\b/.test(lastUserMsgLower);
    const visualizationNeedsCatalogPicks = hasVisualizationVerb && /\b(overlay|picks?|pieces?|selection|tearsheet|catalog|bronze|mohair|velvet|leather|walnut|oak|brass|marble|stone|glass|silk|wool|linen|bouclé|drawing-room|drawing room|dining room|bedroom|salon|library)\b/.test(lastUserMsgLower);
    const hasExplicitSelectionVerb = /\b(propose|suggest|recommend|show me|pull (?:together|me)|curate|reinterpret|alternatives?|options?|first edit|draft (?:a )?(?:tearsheet|edit|selection)|put together|assemble|i'?d like to see|let'?s see|what do you have|list (?:all|every|the)|which .*(?:do you|are)|everything (?:by|from))\b/.test(lastUserMsgLower);
    const opensWithLookingFor = /^\s*(?:i(?:'m| am)?\s+(?:looking|searching|after|hunting|sourcing|in the market)|we(?:'re| are)?\s+(?:looking|searching|after))\b/.test(lastUserMsgLower);

    let effectiveBrief: ExtractedBrief = shouldActOnAccumulatedBrief && !extractedBrief.plan.length && hasExplicitSelectionVerb
      ? {
          intent: "selection",
          brief: {
            ...extractedBrief.brief,
            summary: extractedBrief.brief.summary || "Curate a dining table edit from the accumulated brief.",
            room: extractedBrief.brief.room || "dining room",
            style: extractedBrief.brief.style || (/(elegant|refined|not too formal|relaxed|warm|earthy|sophisticated)/.exec(userConversationText)?.[0] ?? null),
            materials: extractedBrief.brief.materials.length ? extractedBrief.brief.materials : ["wood"].filter(() => /\b(wood|oak|walnut|timber)\b/.test(userConversationText)),
            categories: extractedBrief.brief.categories.length ? extractedBrief.brief.categories : ["dining table"],
            qty_hint: extractedBrief.brief.qty_hint || (/\b(12|twelve)\b/.test(userConversationText) ? 12 : null),
          },
          plan: ["propose_tearsheet"],
        }
      : extractedBrief;

    // DISCOVERY GATE — strip any auto-proposed tearsheet/quote plan when the
    // latest user message is an opening brief without an explicit selection
    // verb. Forces the concierge to ask clarifying questions on turn 1
    // instead of inferring intent from an earlier conversation.
    if (hasVisualizationVerb) {
      const plan = effectiveBrief.plan.filter((t) => t !== "prepare_visualization_brief");
      const wantsTearsheet = plan.includes("propose_tearsheet") || plan.includes("add_to_tearsheet");
      effectiveBrief = {
        ...effectiveBrief,
        intent: wantsTearsheet || visualizationNeedsCatalogPicks ? "selection" : effectiveBrief.intent,
        plan: visualizationNeedsCatalogPicks && !wantsTearsheet
          ? ["propose_tearsheet", "prepare_visualization_brief"]
          : [...plan, "prepare_visualization_brief"],
      };
    }

    if (
      !hasExplicitSelectionVerb &&
      !hasVisualizationVerb &&
      opensWithLookingFor &&
      effectiveBrief.plan.some((t) => t === "propose_tearsheet" || t === "add_to_tearsheet" || t === "draft_quote")
    ) {
      console.log("[concierge discovery-gate] stripping plan — opening brief without selection verb", { lastUserMsg, originalPlan: effectiveBrief.plan });
      effectiveBrief = { ...effectiveBrief, intent: "discovery", plan: [] };
    }
    // Deterministic opening-brief reply removed — it hardcoded "dining table"
    // and ignored actual user content (room type, seat count, shape, etc.).
    // The LLM handles discovery turns directly now.
    const requestedTypology = inferRequestedTypology(effectiveBrief.brief, userConversationText);

    if (shouldActOnAccumulatedBrief && breaker.state() === "open" && CLOUDFLARE_ENABLED) {
      return sseTextResponse(
        "You’ve already given me the essentials: a 12-seat dining table for a refined, elegant-but-not-too-formal Belgravia townhouse, with warm wood tones in oak or walnut. I’ll draft the first edit as soon as the Maison Affluency Curation tool is available; meanwhile, if you have a room plan, reference photo, or PDF, attach it with the paperclip and send it here so I can refine scale and placement.",
      );
    }

    // Fire-and-forget: learn from this turn's extracted brief so the next turn recalls it.
    persistInferredMemory(supabase, userId, effectiveBrief?.brief).catch(() => {});
    // Compose the signals block: live engagement signals first, then the persistent
    // studio memory layer so the model sees recurring defaults right next to current activity.
    const userSignalsBlock = userMemory ? `${userSignals}\n\n${userMemory}` : userSignals;

    // Decide final catalog mode: classifier wins, heuristic is the fallback. RAG replaces full load when it returned anything.
    const includePieces = sentiment.needs_catalog || heuristicNeedsPieces || effectiveBrief.plan.includes("propose_tearsheet") || visualizationNeedsCatalogPicks;
    // If the user names a specific designer, load ONLY that designer's rows
    // (full for them, nothing else) — top-K RAG can miss items, and shipping
    // the whole catalog is wasteful when the question is scoped to one name.
    const lastUserMsgLc = (lastUserMsg || "").toLowerCase();
    // Generic stopwords that appear in many brand names — never treat these as
    // designer mentions on their own ("design", "studio", "atelier", "objects", …).
    const NAME_STOPWORDS = new Set([
      "design", "designs", "designer", "designers", "studio", "studios",
      "atelier", "ateliers", "editions", "edition", "objects", "collection",
      "collections", "paris", "milano", "london", "and", "the", "by", "of",
      "co", "company", "group", "maison", "house", "works",
    ]);
    const normalizedUserMsg = normalizeLoose(lastUserMsg || "");
    const userMsgTokens = new Set(normalizedUserMsg.split(/\s+/).filter(Boolean));
    const designerTokenFrequency = new Map<string, number>();
    for (const n of designerNames) {
      const nameTokens = Array.from(new Set(
        normalizeLoose(String(n || "")).split(/\s+/).filter((t) => t.length >= 5 && !NAME_STOPWORDS.has(t)),
      ));
      for (const t of nameTokens) designerTokenFrequency.set(t, (designerTokenFrequency.get(t) || 0) + 1);
    }
    const phraseInUserMessage = (phrase: string) => {
      const needle = normalizeLoose(phrase);
      if (!needle) return false;
      return (` ${normalizedUserMsg} `).includes(` ${needle} `);
    };
    const mentionedDesigners: string[] = [];
    for (const n of designerNames) {
      const name = String(n || "").toLowerCase().trim();
      if (!name) continue;
      // 1. Full-name phrase match, normalized for punctuation/diacritics
      //    so "Saint Louis" matches "Saint-Louis" without making the single
      //    token "Louis" also match "Jean-Louis Deniot".
      if (name.length >= 4 && phraseInUserMessage(name)) {
        mentionedDesigners.push(n);
        continue;
      }
      // 2. Distinctive-token match — "alinea" should match "Alinea Design Objects",
      //    "pouénat" should match "Pouénat", etc. Match whole normalized
      //    tokens only (not substrings: "interest" must not match "interested")
      //    and ignore tokens shared by multiple designer names (e.g. "louis").
      const tokens = normalizeLoose(name).split(/\s+/).filter(Boolean);
      const distinctive = tokens.find(
        (t) =>
          t.length >= 5 &&
          !NAME_STOPWORDS.has(t) &&
          (designerTokenFrequency.get(t) || 0) === 1 &&
          userMsgTokens.has(t),
      );
      if (distinctive) mentionedDesigners.push(n);
    }
    const mentionsKnownDesigner = mentionedDesigners.length > 0;
    // If the user names a specific designer, skip RAG (top-K may miss items)
    // AND scope the catalog load to just those designers — no reason to ship
    // the full 2000-row catalog when the question is about one designer.
    const useRag = includePieces && !!ragResult && !mentionsKnownDesigner;
    // Merge extractedBrief material/category signal into the SQL-load
    // constraints so the bulk catalog path narrows even when the raw user
    // message did not contain a keyword (the classifier already normalised it).
    const sqlLoadConstraints: HardConstraints = {
      materials: [
        ...(preRequestConstraints.materials || []),
        ...((effectiveBrief.brief.materials || []).map((m) => String(m).toLowerCase())),
      ].filter(Boolean),
      colors: preRequestConstraints.colors || [],
      categories: (effectiveBrief.brief.categories || []).map((c) => String(c).toLowerCase()).filter(Boolean),
    };
    const hasSqlConstraint =
      (sqlLoadConstraints.materials?.length || 0) +
      (sqlLoadConstraints.colors?.length || 0) +
      (sqlLoadConstraints.categories?.length || 0) > 0;
    const catalogT0 = performance.now();
    const { designersList, piecesList: fullPiecesList, showroomBrands } = await loadCatalogContext(
      supabase,
      includePieces && !useRag,
      mentionsKnownDesigner ? mentionedDesigners : undefined,
      hasSqlConstraint && !mentionsKnownDesigner ? sqlLoadConstraints : undefined,
    );
    mark("loadCatalogContext", { ms: Math.round(performance.now() - catalogT0), includePieces, useRag });
    // Detect "hard constraints matched zero pieces" so the UI can render a
    // friendly empty-state and the model can acknowledge it warmly instead of
    // hallucinating alternatives.
    const ragEmpty = useRag && hasAnyPreConstraint && (!ragResult || !Array.isArray((ragResult as any).rows) || (ragResult as any).rows.length === 0 || !(ragResult as { contextText: string }).contextText);
    const sqlEmpty = !useRag && hasSqlConstraint && !mentionsKnownDesigner && (fullPiecesList === "No pieces currently loaded." || !fullPiecesList);
    const constraintsMatchedZero = ragEmpty || sqlEmpty;
    const constraintsEmptySource: "rag" | "sql" | null = ragEmpty ? "rag" : sqlEmpty ? "sql" : null;
    const emptyConstraintNote = constraintsMatchedZero
      ? [
          "",
          "⚠️ HARD-CONSTRAINT EMPTY RESULT ⚠️",
          `The active hard-constraint pre-filter matched ZERO pieces from the Maison Affluency Curation. Filter tokens applied — colors: ${JSON.stringify(sqlLoadConstraints.colors || preRequestConstraints.colors || [])}, materials: ${JSON.stringify(sqlLoadConstraints.materials || preRequestConstraints.materials || [])}, categories: ${JSON.stringify(sqlLoadConstraints.categories || [])}.`,
          "DO NOT invent or propose any piece. DO NOT call propose_tearsheet / add_to_tearsheet / draft_quote this turn.",
          "Reply in ONE short warm paragraph: acknowledge that nothing in the curated selection currently matches that exact combination, name the specific constraint(s) that eliminated the results, and invite the architect to relax ONE constraint (e.g. widen the palette from 'forest green' to 'muted greens', drop the material filter, or broaden the typology). Do not apologise, self-correct, mention external archives, or imply there is a hidden search source.",
          "",
        ].join("\n")
      : "";
    const piecesList = (useRag ? (ragResult as { contextText: string })?.contextText || "" : fullPiecesList) + emptyConstraintNote;

    // Deterministic designer-enumeration shortcut: when the user asks to list
    // / show / see everything by a specific named designer, bypass the LLM
    // and emit a tearsheet proposal containing ALL of that designer's curator
    // picks (up to the tool cap). This guarantees completeness — e.g. "list
    // all Alexander Lamont items" returns all 15, not whatever subset the
    // model happens to pick.
    const enumerationVerbRe = /\b(list (?:all|every|the)|show (?:all|me all|every|me)|(?:all|every) (?:item|piece|product|work)s? (?:by|from)|everything (?:by|from)|which .*(?:do you|are)|what .*(?:do you have|are available))\b/i;
    // Softer intent: "i'm interested in <designer> (items|pieces|work|...)",
    // "any <designer> items?", "got any <designer>?", "tell me about
    // <designer>'s pieces", "what do you have by <designer>". If a known
    // designer is mentioned AND the message signals catalog interest, treat
    // it as an enumeration request so we ship the full curator-pick set.
    const softInterestRe = /\b(interested\s+in|interest(?:ed)?|curious\s+about|keen\s+on|into|tell\s+me\s+about|show\s+me|show\s+us|give\s+me|send\s+me|share|surface|pull\s+up|bring\s+up|open\s+up|got\s+any|have\s+any|any\s+of|what['’]s\s+available|what\s+(?:do\s+you\s+have|about|have\s+you\s+got|is\s+available|are\s+available)|do\s+you\s+(?:have|carry|stock|offer)|available\s+from|browse|explore|see|view|look(?:ing)?\s+(?:at|for|into)|shopping\s+for|sourcing|source|considering|consider|would\s+like\s+(?:to\s+see|to\s+view)?|can\s+(?:i|we|you)\s+(?:see|view|get)|let\s+me\s+see|need|want(?:ed)?|recommend|propose|spec|specify|curate|pick)\b/i;
    const catalogNounRe = /\b(items?|pieces?|products?|works?|objects?|designs?|collections?|catalog(?:ue)?s?|ranges?|editions?|selections?|offerings?|inventor(?:y|ies)|stuff|things?|options?|picks?|tear\s?sheets?|lines?|portfolios?|rosters?|lists?|round-?ups?|overviews?|assortments?|line-?ups?)\b/i;

    const isEnumerationRequest =
      enumerationVerbRe.test(lastUserMsg || "") ||
      (mentionsKnownDesigner &&
        (softInterestRe.test(lastUserMsg || "") || catalogNounRe.test(lastUserMsg || "")));

    // Suggest nearest designer names by token overlap against the full known list.
    const suggestNearestDesigners = (query: string, max = 5): string[] => {
      const qTokens = String(query || "")
        .toLowerCase()
        .split(/[^a-zà-ÿ0-9]+/i)
        .filter((t) => t && t.length >= 3 && !NAME_STOPWORDS.has(t));
      if (qTokens.length === 0) return [];
      const scored = designerNames.map((n) => {
        const name = String(n).toLowerCase();
        let score = 0;
        for (const qt of qTokens) {
          if (name.includes(qt)) score += 2;
          else if (qt.length >= 4 && name.split(/[^a-zà-ÿ0-9]+/i).some((nt) => nt.startsWith(qt.slice(0, 4)))) score += 1;
        }
        return { n, score };
      });
      return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, max)
        .map((s) => s.n);
    };

    const buildSkipConfirmationMessage = (
      skipped: Array<{ title?: string | null }>,
      kept: Array<{ title?: string | null }>,
      label: string,
    ): string => {
      const skipList = skipped.map((p, i) => `${i + 1}. ${p.title || "Untitled"}`).join("\n");
      const keepList = kept.map((p, i) => `${i + 1}. ${p.title || "Untitled"}`).join("\n");
      return `${SKIP_CONFIRM_MARKER}Before I build the ${label} tear sheet, please confirm.\n\n**Skipping (${skipped.length}):**\n${skipList || "_(none)_"}\n\n**Keeping (${kept.length}):**\n${keepList || "_(none)_"}\n\nReply **"confirm all remaining"** (or "yes" / "approve" / "go ahead") to create the tear sheet, or send an amended skip list.`;
    };

    // Parse in-chat "skip / exclude / omit / without / except / remove / drop /
    // leave out / don't include" instructions from the user's latest message
    // and return the set of pick IDs the user wants filtered out of the next
    // proposal. Supports two reference styles:
    //   (a) Ordinal indices — "skip 1, 3, 5 and 7" (1-based against the given
    //       preview order, which mirrors what was just enumerated on-screen).
    //   (b) Title fragments — "skip the Angelo dining table and the Scala
    //       console" — matched against pick titles (>=4 char tokens, minus
    //       stopwords). A single distinctive token is enough.
    const EXCLUSION_STOPWORDS = new Set([
      "the","and","from","with","that","this","them","those","these","item","items",
      "piece","pieces","first","last","next","above","below","before","after","also",
      "please","just","only","need","want","would","should","could","really","them",
      "keep","include","exclude","except","skip","omit","without","remove","drop",
      "leave","don","dont","doesnt","cant","cannot","dining","table","chair","chairs",
      "lamp","lamps","sconce","sconces","console","mirror","cabinet","sofa","stool",
      "stools","light","lights","lighting","seating","piece","pieces","object","objects",
    ]);
    const parseUserExclusions = (
      userMsg: string,
      previewRows: Array<{ id: string; title?: string | null }>,
    ): Set<string> => {
      const excluded = new Set<string>();
      if (!userMsg || previewRows.length === 0) return excluded;
      const lc = userMsg.toLowerCase();
      const SKIP_RE = /(?:\bskip\b|\bexclud\w*|\bomit\b|\bwithout\b|\bexcept\b|\bremove\b|\bdrop\b|\bleave\s+out\b|\bdo\s?n['’]?t\s+include\b|\bno\s+need\s+for\b)([^.?!;\n]*)/gi;
      const matches = Array.from(lc.matchAll(SKIP_RE));
      if (matches.length === 0) return excluded;
      const zone = matches.map((m) => m[1] || "").join(" ");
      // Ordinal indices (1-based) referencing the just-enumerated list order.
      const nums = Array.from(zone.matchAll(/#?\b(\d{1,2})(?:st|nd|rd|th)?\b/g))
        .map((m) => parseInt(m[1], 10))
        .filter((n) => Number.isFinite(n));
      for (const n of nums) {
        if (n >= 1 && n <= previewRows.length) {
          const row = previewRows[n - 1];
          if (row?.id) excluded.add(row.id);
        }
      }
      // Title-token matching.
      const tokens = Array.from(new Set(
        zone.split(/[^a-zà-ÿ0-9]+/i).filter((t) => t.length >= 4 && !EXCLUSION_STOPWORDS.has(t)),
      ));
      if (tokens.length > 0) {
        for (const row of previewRows) {
          const title = String(row.title || "").toLowerCase();
          if (!title) continue;
          if (tokens.some((t) => title.includes(t))) excluded.add(row.id);
        }
      }
      return excluded;
    };



    if (hasExplicitSelectionVerb && requestedTypology && !mentionsKnownDesigner) {
      const budgetCeiling = inferBudgetCeilingCents(lastUserMsg || "");
      const allTypeCandidates = await fetchStrictTypologyCandidates(supabase, requestedTypology);
      const budgetedCandidates = budgetCeiling
        ? allTypeCandidates.filter((r: any) => Number(r?.trade_price_cents || 0) > 0 && Number(r.trade_price_cents) <= budgetCeiling.cents)
        : allTypeCandidates;
      const candidateRows = budgetedCandidates
        .sort((a: any, b: any) => {
          const ap = Number(a?.trade_price_cents || Number.MAX_SAFE_INTEGER);
          const bp = Number(b?.trade_price_cents || Number.MAX_SAFE_INTEGER);
          return ap - bp || String(a?.title || "").localeCompare(String(b?.title || ""));
        })
        .slice(0, Math.min(8, Math.max(2, effectiveBrief.brief.qty_hint || 6)));

      if (allTypeCandidates.length > 0 && candidateRows.length === 0 && budgetCeiling) {
        return sseTextResponse(
          `The Maison Affluency Curation has ${typologyLabel(requestedTypology)} pieces, but none with published trade pricing ${budgetCeiling.label}. Would you like me to relax the budget or show Price on Request options in that typology?`,
        );
      }

      if (candidateRows.length >= 1) {
        const candidateIds = Array.from(new Set(candidateRows.map((r: any) => r.id).filter(Boolean)));
        const previewRawAll = await hydratePickPreview(supabase, candidateIds);
        let previewRaw = previewRawAll.filter((p: any) => rowMatchesRequestedTypology(p, requestedTypology));
        if (budgetCeiling) {
          previewRaw = previewRaw.filter((p: any) => Number(p?.price_cents || 0) > 0 && Number(p.price_cents) <= budgetCeiling.cents);
        }
        const { previewRaw: dedupedPreview, pickIds: dedupedIds } = dedupePreviewRows(
          previewRaw,
          candidateIds.filter((id: string) => previewRaw.some((p: any) => p?.id === id)),
        );
        if (dedupedIds.length === 0) {
          return sseTextResponse(buildNoStrictTypologyReply(requestedTypology));
        }
        const rationaleMap: Record<string, { reason: string }> = {};
        for (const p of dedupedPreview) {
          if (!p?.id) continue;
          const price = typeof p.price_cents === "number" && p.currency
            ? `${p.currency} ${Math.round(p.price_cents / 100).toLocaleString("en-US")}`
            : "published trade details";
          rationaleMap[p.id] = { reason: budgetCeiling ? `Matches the requested typology and stays within ${budgetCeiling.label} (${price}).` : "Matches the requested typology from the Maison Affluency Curation." };
        }
        const proposal = {
          tool: "propose_tearsheet",
          tool_call_id: crypto.randomUUID(),
          args: {
            title: budgetCeiling ? `${typologyLabel(requestedTypology)} under ${budgetCeiling.label}` : `${typologyLabel(requestedTypology)} edit`,
            pick_ids: dedupedIds,
            note: budgetCeiling
              ? `${dedupedIds.length} ${typologyLabel(requestedTypology)} match${dedupedIds.length === 1 ? "" : "es"} with published pricing ${budgetCeiling.label}.`
              : `${dedupedIds.length} ${typologyLabel(requestedTypology)} match${dedupedIds.length === 1 ? "" : "es"} from the Maison Affluency Curation.`,
            pick_rationales: rationaleMap,
          },
          preview: dedupedPreview.map((p: any) => ({ ...p, rationale: rationaleMap[p.id]?.reason || null })),
        };
        const requestedQty = effectiveBrief.brief.qty_hint || (lastUserMsg.match(/\b(\d{1,2})\b/) ? Number(lastUserMsg.match(/\b(\d{1,2})\b/)?.[1]) : null);
        const quantityNote = requestedQty && requestedQty > dedupedIds.length
          ? ` I found ${dedupedIds.length}, not ${requestedQty}, that truly match the typology${budgetCeiling ? ` and ${budgetCeiling.label}` : ""}; I did not pad with adjacent categories.`
          : "";
        return sseProposalThenTextResponse(
          proposal,
          `Here's the matching edit.${quantityNote} Review the list above and click **Approve & Create** to save it into a project folder — or **Discard** to cancel.`,
        );
      }
    }

    if (mentionsKnownDesigner && isEnumerationRequest) {
      const { data: designerRows } = await supabase
        .from("designers")
        .select("id, name, display_name")
        .eq("is_published", true);
      const targetLc = mentionedDesigners.map((n) => String(n).toLowerCase().trim());
      const targetIds = (designerRows || [])
        .filter((d: any) => {
          const nm = String(d.name || "").toLowerCase().trim();
          const dn = String(d.display_name || "").toLowerCase().trim();
          return targetLc.some((f) => (nm && (nm === f || f.includes(nm))) || (dn && (dn === f || f.includes(dn))));
        })
        .map((d: any) => d.id);
      const designerLabel =
        (designerRows || []).find((d: any) => targetIds.includes(d.id))?.display_name
        || (designerRows || []).find((d: any) => targetIds.includes(d.id))?.name
        || mentionedDesigners[0];

      const { data: allPicks } = await supabase
        .from("designer_curator_picks")
        .select("id, title, category, subcategory, materials, designer_id")
        .in("designer_id", targetIds)
        .order("title", { ascending: true })
        .limit(48);
      // Typology filter — when the user names a piece type (e.g. "chandelier",
      // "sconce", "dining table"), restrict the enumeration to picks whose
      // title / subcategory / category actually contain that term. Without
      // this, "Saint-Louis chandelier" returned all 20 Saint-Louis pieces
      // (vases, lamps, etc.) instead of just chandeliers.
      const TYPOLOGY_TERMS = [
        "chandelier","sconce","pendant","lantern","lighting","light",
        "dining table","coffee table","side table","console","desk","table",
        "armchair","chair","stool","bench","sofa","banquette","daybed","bed",
        "cabinet","sideboard","credenza","commode","armoire","bookshelf","shelf",
        "mirror","rug","carpet","tapestry","screen","vase","objet","tray","bowl",
        "floor lamp","table lamp","wall light","ceiling light","lamp",
      ];
      const msgLcTypology = String(lastUserMsg || "").toLowerCase();
      const detectTypologiesIn = (text: string): string[] =>
        TYPOLOGY_TERMS.filter((t) =>
          new RegExp(`\\b${t.replace(/ /g, "\\s+")}s?\\b`, "i").test(text),
        );
      const requestedTypologies = detectTypologiesIn(msgLcTypology);
      // Synonym expansion — some pieces are catalogued under an adjacent
      // subcategory (e.g. an "Excess Chandelier" filed under "Ceiling Lights").
      // When the user asks for a common typology, also accept its siblings.
      const TYPOLOGY_SYNONYMS: Record<string, string[]> = {
        chandelier: ["ceiling light", "ceiling lights", "pendant", "pendants", "lantern"],
        pendant: ["ceiling light", "ceiling lights", "chandelier", "lantern"],
        "ceiling light": ["chandelier", "pendant", "lantern"],
        sconce: ["wall light", "wall lights", "wall lamp", "wall lamps", "applique"],
        "wall light": ["sconce", "applique"],
        "floor lamp": ["floor light"],
        "table lamp": ["table light"],
      };

      // Per-designer typology binding. Split the message into fragments on
      // connectives ("and", "with", "plus", commas, semicolons) so that
      // typologies bind only to the designer named in the same fragment.
      // Without this, "Saint-Louis chandelier with Alinea table and chairs"
      // spilled the "table"/"chair" typology onto Saint-Louis picks and
      // dragged in every Saint-Louis side table / table lamp.
      const fragments = msgLcTypology
        .split(/\s*(?:,|;|\band\b|\bwith\b|\bplus\b|\balong\s+with\b|\bas\s+well\s+as\b|&|\+)\s*/i)
        .map((f) => f.trim())
        .filter(Boolean);
      const designerTokensById = new Map<string, string[]>();
      for (const d of (designerRows || [])) {
        if (!targetIds.includes(d.id)) continue;
        const raw = `${d.name || ""} ${d.display_name || ""}`.toLowerCase();
        const tokens = Array.from(new Set(
          raw.split(/[^a-zà-ÿ0-9]+/i).filter((t) => t.length >= 4 && !NAME_STOPWORDS.has(t)),
        ));
        designerTokensById.set(d.id, tokens);
      }
      const typologiesByDesigner = new Map<string, Set<string>>();
      for (const id of targetIds) typologiesByDesigner.set(id, new Set<string>());
      let lastDesignerIdWithTypology: string | null = null;
      for (const frag of fragments) {
        const fragTypologies = detectTypologiesIn(frag);
        if (fragTypologies.length === 0) continue;
        const matchedDesignerIds: string[] = [];
        for (const [id, tokens] of designerTokensById) {
          if (tokens.some((t) => frag.includes(t))) {
            matchedDesignerIds.push(id);
          }
        }
        const idsToBind = matchedDesignerIds.length > 0
          ? matchedDesignerIds
          : lastDesignerIdWithTypology
            ? [lastDesignerIdWithTypology]
            : [];
        for (const id of idsToBind) {
          typologiesByDesigner.get(id)!.add("__bound__");
          for (const t of fragTypologies) typologiesByDesigner.get(id)!.add(t);
        }
        if (matchedDesignerIds.length > 0) lastDesignerIdWithTypology = matchedDesignerIds[matchedDesignerIds.length - 1];
      }
      const matchesTypology = (pick: any, typologies: string[]): boolean => {
        if (typologies.length === 0) return true;
        const hay = `${pick.title || ""} ${pick.subcategory || ""} ${pick.category || ""}`.toLowerCase();
        return typologies.some((t) => {
          if (hay.includes(t)) return true;
          const syns = TYPOLOGY_SYNONYMS[t] || [];
          return syns.some((s) => hay.includes(s));
        });
      };
      const filteredPicksByTypology = (allPicks || []).filter((p: any) => {
        const bound = typologiesByDesigner.get(p.designer_id);
        const boundList = bound && bound.has("__bound__")
          ? [...bound].filter((t) => t !== "__bound__")
          : requestedTypologies;
        return matchesTypology(p, boundList);
      });
      const pickIds = filteredPicksByTypology.map((p: any) => p.id);
      console.log("[concierge typology-filter]", JSON.stringify({
        designerLabel,
        targetDesignerIds: targetIds,
        userMsg: String(lastUserMsg || "").slice(0, 200),
        fragments,
        requestedTypologies,
        typologiesByDesigner: Object.fromEntries(
          [...typologiesByDesigner.entries()].map(([k, v]) => [k, [...v].filter((t) => t !== "__bound__")]),
        ),
        allPicksCount: (allPicks || []).length,
        matchedPickIds: pickIds,
        matchedPickTitles: filteredPicksByTypology.map((p: any) => p.title),
      }));
      if (requestedTypologies.length && pickIds.length === 0) {
        console.log("[concierge typology-filter] no matches — returning fallback prompt");
        return sseTextResponse(
          `The Maison Affluency Curation has no ${requestedTypologies[0]} from **${designerLabel}** today. Want me to (a) surface adjacent ${designerLabel} pieces regardless of typology, or (b) look at ${requestedTypologies[0]}s from other ateliers we represent?`,
        );
      }
      if (pickIds.length >= 1) {
        const previewRawAll = await hydratePickPreview(supabase, pickIds);
        const validIds = new Set(previewRawAll.map((p: any) => p?.id).filter(Boolean));
        // Honour in-chat "skip / exclude / omit …" instructions so the
        // proposal card is pre-filtered instead of shipping all 10 when the
        // user asked us to leave some out.
        const excludedIds = parseUserExclusions(lastUserMsg || "", previewRawAll);
        const previewRaw = previewRawAll.filter((p: any) => p?.id && !excludedIds.has(p.id));
        const finalIds = pickIds.filter((id: string) => validIds.has(id) && !excludedIds.has(id));
        if (finalIds.length === 0) {
          return sseTextResponse(
            `Your skip list would remove every ${designerLabel} piece — nothing left to propose. Send the message again with a shorter exclusion (or say "list all ${designerLabel}" for the full set).`,
          );
        }
        // Confirmation gate: don't ship the tear sheet on the same turn the
        // user asked us to skip items — show them the skip/keep breakdown
        // and wait for a "confirm" reply.
        if (excludedIds.size > 0 && !isConfirmingSkip) {
          const skipped = previewRawAll.filter((p: any) => p?.id && excludedIds.has(p.id));
          return sseTextResponse(
            buildSkipConfirmationMessage(skipped, previewRaw, designerLabel),
          );
        }
        const designerNameById = new Map<string, string>();
        for (const d of (designerRows || [])) {
          if (targetIds.includes(d.id)) {
            designerNameById.set(d.id, d.display_name || d.name || designerLabel);
          }
        }
        const pickDesignerById = new Map<string, string>();
        for (const p of (allPicks || [])) {
          if (p?.id && p?.designer_id) pickDesignerById.set(p.id, p.designer_id);
        }
        const rationaleMap: Record<string, { reason: string }> = {};
        const brandCounts = new Map<string, number>();
        for (const p of previewRaw) {
          if (!p?.id) continue;
          const dName = designerNameById.get(pickDesignerById.get(p.id) || "") || designerLabel;
          brandCounts.set(dName, (brandCounts.get(dName) || 0) + 1);
          rationaleMap[p.id] = { reason: `Complete ${dName} listing from the Maison Affluency Curation.` };
        }
        const preview = previewRaw.map((p: any) => ({ ...p, rationale: rationaleMap[p.id]?.reason || null }));
        // Note designers whose requested typology returned nothing so the
        // closing prose acknowledges what's missing (e.g. "Alinea chairs").
        const unmetNotes: string[] = [];
        for (const [dId, tSet] of typologiesByDesigner) {
          if (!tSet.has("__bound__")) continue;
          const boundList = [...tSet].filter((t) => t !== "__bound__");
          const dName = designerNameById.get(dId) || "";
          for (const t of boundList) {
            const anyMatch = (allPicks || []).some((p: any) =>
              p.designer_id === dId && matchesTypology(p, [t]),
            );
            if (!anyMatch) unmetNotes.push(`${dName} has no ${t}s in the current Curation`);
          }
        }
        const unmetSuffix = unmetNotes.length
          ? ` Note: ${unmetNotes.join("; ")}.`
          : "";
        const multiLabel = mentionedDesigners.length > 1
          ? mentionedDesigners.slice(0, 3).join(" + ")
          : designerLabel;
        const brandCountSummary = [...brandCounts.entries()]
          .sort(([a], [b]) => {
            const ai = mentionedDesigners.findIndex((n) => normalizeLoose(n) === normalizeLoose(a));
            const bi = mentionedDesigners.findIndex((n) => normalizeLoose(n) === normalizeLoose(b));
            if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            return a.localeCompare(b);
          })
          .map(([name, count]) => `${count} ${name}`)
          .join(", ");
        const countPhrase = brandCounts.size > 1
          ? `${finalIds.length} pieces (${brandCountSummary})`
          : `${finalIds.length} ${multiLabel} pieces`;
        const proposal = {
          tool: "propose_tearsheet",
          tool_call_id: crypto.randomUUID(),
          args: {
            title: `${multiLabel} — curated edit`,
            pick_ids: finalIds,
            note: excludedIds.size > 0
              ? `${countPhrase} of ${pickIds.length} matched pieces (skipped ${excludedIds.size} per your request), with trade pricing.`
              : `${countPhrase} from the Maison Affluency Curation, with trade pricing.`,
            pick_rationales: rationaleMap,
          },
          preview,
        };
        const closing = (excludedIds.size > 0
          ? `Draft tear sheet with ${countPhrase} (skipped ${excludedIds.size} per your request). Review the list above and click **Approve & Create** to save it into a project folder — or **Discard** to cancel.`
          : `Draft tear sheet with ${countPhrase} in the Maison Affluency Curation, with trade pricing. Review the list above and click **Approve & Create** to save it into a project folder — or **Discard** to cancel.`)
          + unmetSuffix;
        const { validation } = validateProposalAgainstBrief(proposal, userConversationText, null);
        if (!validation.ok) {
          console.warn("[concierge deterministic-enumeration] blocked proposal", JSON.stringify({ requestId, violations: validation.violations }));
          return sseTextResponse(buildRequirementsBlockedMessage(validation.violations));
        }
        return sseProposalThenTextResponse(proposal, closing);


      }

      // Designer recognised but zero curator picks published for them.
      const nearest = suggestNearestDesigners(designerLabel, 5).filter((n) => n !== designerLabel);
      const suggestion = nearest.length
        ? ` Closest names currently in the Curation: ${nearest.map((n) => `**${n}**`).join(", ")}.`
        : "";
      return sseTextResponse(
        `I found **${designerLabel}** in the directory, but no curator picks are published for them yet — so I can't list any pieces. Two ways forward: (1) ask me about a specific typology (e.g. "seating", "lighting", "tables") and I'll surface the closest pieces from other ateliers; (2) try one of these adjacent names I do have priced picks for.${suggestion}`,
      );
    }

    // Enumeration verb but no known designer matched — the model would otherwise
    // return an empty answer. Explain why and offer the nearest names.
    if (isEnumerationRequest && !mentionsKnownDesigner) {
      const nearest = suggestNearestDesigners(lastUserMsg || "", 6);
      if (nearest.length > 0) {
        return sseTextResponse(
          `I couldn't match a designer in your request to the Maison Affluency Curation, so I have nothing to list. Did you mean one of these? ${nearest.map((n) => `**${n}**`).join(", ")}. Reply with the exact name (e.g. "list all ${nearest[0]} pieces") and I'll pull the full set with trade pricing.`,
        );
      }
      return sseTextResponse(
        `I couldn't identify a designer in your request, so I have nothing to enumerate. Try the exact atelier name — e.g. "list all Alinea Design Objects pieces", "show every Pouénat item", or "what do you have by Alexander Lamont?". You can also ask by typology ("all consoles", "all sconces") and I'll propose a tear sheet across the Curation.`,
      );
    }


    if (hasVisualizationVerb) {
      const tearsheetProposal = visualizationNeedsCatalogPicks
        ? await buildDeterministicTearsheetProposal(
            supabase,
            Array.isArray((ragResult as any)?.rows) ? (ragResult as any).rows : [],
            effectiveBrief.brief,
            userConversationText,
          )
        : null;
      const vizProposal = buildVisualizationBriefProposal({
        title: tearsheetProposal?.args?.title || effectiveBrief.brief.summary || null,
        room: effectiveBrief.brief.room,
        style: effectiveBrief.brief.style,
        materials: effectiveBrief.brief.materials,
        summary: effectiveBrief.brief.summary,
        requestText: lastUserMsg,
        pickIds: Array.isArray(tearsheetProposal?.args?.pick_ids) ? tearsheetProposal.args.pick_ids : [],
        preview: Array.isArray(tearsheetProposal?.preview) ? tearsheetProposal.preview : [],
      });
      const proposals = tearsheetProposal ? [tearsheetProposal, vizProposal] : [vizProposal];
      if (tearsheetProposal) {
        const { validation } = validateProposalAgainstBrief(tearsheetProposal, userConversationText, null);
        if (!validation.ok) {
          console.warn("[concierge deterministic-visualization] blocked tearsheet proposal", JSON.stringify({ requestId, violations: validation.violations }));
          return sseTextResponse(buildRequirementsBlockedMessage(validation.violations));
        }
      }
      return sseProposalsThenTextResponse(
        proposals,
        tearsheetProposal
          ? "Here's a first edit and the render brief — tap Render Scene when you're ready to open the studio."
          : "I've prepared the render brief — tap Render Scene when you're ready to open the studio.",
      );
    }

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
    const projectT0 = performance.now();
    const projectContext = await loadProjectContext(supabase, userId, resolvedProjectId);
    mark("loadProjectContext", { ms: Math.round(performance.now() - projectT0), hasProject: !!resolvedProjectId });
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
    const planDirective = buildPlanDirective(effectiveBrief) + (lacksUploadedRoomContext && shouldActOnAccumulatedBrief
      ? "\n\nAfter the tearsheet card, add one short sentence inviting the user to attach a room plan, reference photo, or PDF with the paperclip and send it here so Felix can refine dimensions and placement."
      : "");
    const systemPrompt = buildSystemPrompt(
      designersList, piecesList, showroomBrands, userBoards, userSignalsBlock, sentimentDirective, projectContext, openQuotes, planDirective, cadDocuments, productCadAssets,
    );
    // The planner's intent + plan supersede the legacy regex when present. If the planner
    // flagged a quote-only turn, restrict the toolset to quote tools. If it flagged a
    // chained selection_and_quote, expose all tools so the model can emit both calls.
    const plannerQuoteOnly = effectiveBrief.intent === "quote" && effectiveBrief.plan.every((t) => t === "draft_quote" || t === "add_to_quote");
    const isExplicitQuoteIntent = plannerQuoteOnly
      || (effectiveBrief.plan.length === 0
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
    // `estimate_shipping` and `check_spatial_fit` are always allowed regardless
    // of stage — shipping and spatial-fit questions can come up on any surface
    // and must always hit the live rate matrix / CAD parser.
    const allowedWithShipping = allowedNames
      ? Array.from(new Set([...allowedNames, "estimate_shipping", "check_spatial_fit", "check_spatial_fit_batch", "prepare_visualization_brief"]))
      : null;
    const availableTools = allowedWithShipping
      ? TOOLS.filter((tool: any) => allowedWithShipping.includes(tool.function?.name))
      : TOOLS;
    // If the gate emptied the toolset (shouldn't happen in practice), fall back to all
    // tools rather than sending an empty `tools: []` array to the upstream gateway.
    const finalTools = availableTools.length > 0 ? availableTools : TOOLS;
    // Only force-pin tool_choice to propose_tearsheet when the planner emitted a SOLO tearsheet plan.
    // Chained plans (e.g. [propose_tearsheet, prepare_visualization_brief] or [propose_tearsheet, draft_quote])
    // must stay on `auto` so the model can emit both tool calls in the same turn.
    const planHasVizBrief = effectiveBrief.plan.includes("prepare_visualization_brief");
    const planHasQuote = effectiveBrief.plan.includes("draft_quote") || effectiveBrief.plan.includes("add_to_quote");
    const forcePlannedTearsheet =
      effectiveBrief.plan.includes("propose_tearsheet") &&
      !planHasVizBrief &&
      !planHasQuote &&
      !stageForcesQuote &&
      !isExplicitQuoteIntent;
    const toolChoice: any = forcePlannedTearsheet
      ? { type: "function", function: { name: "propose_tearsheet" } }
      : ((isExplicitQuoteIntent || stageForcesQuote) ? "required" : "auto");

    if (forcePlannedTearsheet) {
      const deterministicProposal = await buildDeterministicTearsheetProposal(
        supabase,
        Array.isArray((ragResult as any)?.rows) ? (ragResult as any).rows : [],
        effectiveBrief.brief,
        userConversationText,
      );
      if (deterministicProposal) {
        const { validation } = validateProposalAgainstBrief(deterministicProposal, userConversationText, null);
        if (!validation.ok) {
          console.warn("[concierge deterministic-plan] blocked proposal", JSON.stringify({ requestId, violations: validation.violations }));
          return sseTextResponse(buildRequirementsBlockedMessage(validation.violations));
        }
        return sseProposalThenTextResponse(
          deterministicProposal,
          "Here's a first edit — would you like me to refine this selection against your client's intentions?",
        );
      }
    }

    // Model router: Flash by default, Pro for complex multi-constraint briefs.
    const chosenModel = pickModel(lastUserMsg, includePieces);

    mark("pre_llm", { model: chosenModel, tools: finalTools.length, toolChoice: typeof toolChoice === "string" ? toolChoice : (toolChoice?.function?.name ?? "forced") });
    flushTrace("pre_llm");
    const llmT0 = performance.now();
    const upstream = await chatFetch({
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiAuthKey(LOVABLE_API_KEY)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel(chosenModel),
        messages: [{ role: "system", content: languageDirective + systemPrompt }, ...trimmedMessages],
        tools: finalTools,
        tool_choice: toolChoice,
        max_completion_tokens: chosenModel === modelFor("strong") ? CHAT_MAX_TOKENS_STRONG : CHAT_MAX_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    console.log(`[concierge trace] ${JSON.stringify({ phase: "llm_first_response", requestId, llm_ms: Math.round(performance.now() - llmT0), status: upstream.status })}`);

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
    // Card-producing tools that should trigger an early `event: tool_start` frame
    // so the client can render a skeleton card immediately, before the completed
    // `event: proposal` frame arrives at end-of-turn.
    const CARD_TOOL_NAMES = new Set([
      "propose_tearsheet",
      "add_to_tearsheet",
      "draft_quote",
      "add_to_quote",
      "propose_ffe_rows",
      "prepare_visualization_brief",
    ]);
    const toolStartEmittedIdx = new Set<number>();
    // Captured payload of `extract_requirements` for this turn. Populated when
    // the model emits that tool call; consumed by the Inspector Agent to diff
    // the assembled card against the user's declared slots/typologies/counts.
    let capturedRequirements: RequirementsPayload | null = null;
    let buffer = "";
    let capturedUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;
    const usageModel = chosenModel;

    const stream = new ReadableStream({
      async start(controller) {
        let streamClosed = false;
        const rawEnqueue = controller.enqueue.bind(controller);
        const rawClose = controller.close.bind(controller);
        (controller as any).enqueue = (chunk: Uint8Array) => {
          if (streamClosed) return;
          try {
            rawEnqueue(chunk);
          } catch (e) {
            streamClosed = true;
            console.warn("[concierge] client stream closed before enqueue:", e instanceof Error ? e.message : e);
          }
        };
        (controller as any).close = () => {
          if (streamClosed) return;
          try {
            rawClose();
          } catch (e) {
            console.warn("[concierge] client stream already closed:", e instanceof Error ? e.message : e);
          } finally {
            streamClosed = true;
          }
        };

        // Install resume-token persistence: wraps enqueue to (1) prefix
        // each SSE frame with a `:seq=N` comment on the wire so the client
        // can track its cursor, and (2) mirror every chunk into
        // `concierge_stream_frames`. Emits `event: stream_start` as seq=1
        // so the client receives the resume token before any other event.
        const { streamId: resumeStreamId, finalize: finalizeResume } = installFramePersistence({
          controller,
          supabase,
          userId,
          requestId,
          surface: "trade",
        });
        

        // Emit the trace id so the client can correlate this stream
        // with server-side Inspector logs (same request_id).
        controller.enqueue(encoder.encode(`event: request_id\ndata: ${JSON.stringify({ request_id: requestId })}\n\n`));

        // Surface hard-constraint pre-filters to the client so the UI can
        // show chips like "Filtered by: forest green · oak" alongside the
        // reply. Combines the RAG-side constraints (derived from the user
        // message) and the SQL-side constraints (extendedBrief categories +
        // materials). Emitted even when empty so the UI can clear stale chips.
        const appliedConstraintsPayload = {
          colors: [...new Set([
            ...((preRequestConstraints.colors) || []),
            ...((sqlLoadConstraints.colors) || []),
          ])],
          materials: [...new Set([
            ...((preRequestConstraints.materials) || []),
            ...((sqlLoadConstraints.materials) || []),
          ])],
          categories: [...new Set(((sqlLoadConstraints.categories) || []))],
          applied_to: [
            hasAnyPreConstraint ? "rag" : null,
            (hasSqlConstraint && !mentionsKnownDesigner) ? "sql" : null,
          ].filter(Boolean) as string[],
          empty: constraintsMatchedZero,
          empty_source: constraintsEmptySource,
        };
        controller.enqueue(encoder.encode(`event: applied_constraints\ndata: ${JSON.stringify(appliedConstraintsPayload)}\n\n`));

        // Emit escalation event up-front when the classifier flagged it.
        if (sentiment.escalate) {
          const payload = {
            sentiment: sentiment.sentiment,
            intent: sentiment.intent,
            user_id: userId,
            excerpt: messages.slice(-4),
            request_id: requestId,
          };
          controller.enqueue(encoder.encode(`event: escalation\ndata: ${JSON.stringify(payload)}\n\n`));
        }
        const flushProposal = async () => {
          // Deterministic ordering: requirements FIRST (so the client can show
          // the parsed brief immediately), then tearsheets, then quotes, etc.
          // The Inspector Agent later diffs card contents against the emitted
          // requirements payload from this same turn.
          const allBuffers = Array.from(toolCallBuffers.values());
          const requirementsBuffers = allBuffers.filter((b) => b.name === "extract_requirements");
          const tearsheetBuffers = allBuffers.filter((b) => b.name === "propose_tearsheet" || b.name === "add_to_tearsheet");
          const quoteBuffers = allBuffers.filter((b) => b.name === "draft_quote" || b.name === "add_to_quote");
          const ffeBuffers = allBuffers.filter((b) => b.name === "propose_ffe_rows");
          const shippingBuffers = allBuffers.filter((b) => b.name === "estimate_shipping");
          const vizBriefBuffers = allBuffers.filter((b) => b.name === "prepare_visualization_brief");
          const orderedBuffers = [...requirementsBuffers, ...tearsheetBuffers, ...quoteBuffers, ...ffeBuffers, ...shippingBuffers, ...vizBriefBuffers];
          const firstTearsheetPicks = (() => {
            for (const b of tearsheetBuffers) {
              try {
                const parsed = JSON.parse(b.argsText || "{}");
                if (Array.isArray(parsed.pick_ids) && parsed.pick_ids.length > 0) {
                  return parsed.pick_ids.filter((id: unknown) => typeof id === "string").slice(0, 12);
                }
              } catch { /* ignore malformed tool args */ }
            }
            return [] as string[];
          })();
          if (tearsheetBuffers.length && quoteBuffers.length) {
            console.log(`[concierge flush] chained turn: ${tearsheetBuffers.length} tearsheet + ${quoteBuffers.length} quote proposal(s), flushing tearsheet→quote`);
          }

          // Per-card Requirements diff — run BEFORE each `event: proposal`
          // frame is enqueued so the client card carries the validation
          // verdict and, on failure, a preceding `event: requirements_validation`
          // frame lets the UI badge the card as "does not satisfy brief" and
          // the Inspector prose pass can react to the same shortfall.
          const emitProposalWithRequirementsDiff = (
            proposal: Record<string, any>,
            previewRows: any[],
          ) => {
            let validationFailed = false;
            try {
              const cardTool = String(proposal?.tool || "unknown");
              const gtOne = buildInspectorGroundTruth([
                { tool: cardTool, pickIds: [], previews: Array.isArray(previewRows) ? previewRows : [] },
              ]);
              const effectiveRequirements = mergeRequirementsWithText(capturedRequirements as any, userConversationText);
              const v = validateRequirementsCoverage(effectiveRequirements as any, gtOne);
              proposal.requirements_validation = {
                ok: v.ok,
                brand_ok: v.brand_ok,
                budget_ok: v.budget_ok,
                palette_ok: v.palette_ok,
                coverage: v.coverage,
                violations: v.violations,
                budget: v.budget,
                palette: v.palette,
                total_items: v.total_items,
                unmatched_ids: v.unmatched_ids,
                enforcement: REQUIREMENTS_ENFORCEMENT,
              };
              if (!v.ok && effectiveRequirements) {
                validationFailed = true;
                controller.enqueue(encoder.encode(
                  `event: requirements_validation\ndata: ${JSON.stringify({
                    request_id: requestId,
                    tool: cardTool,
                    tool_call_id: proposal?.tool_call_id || null,
                    ok: false,
                    enforcement: REQUIREMENTS_ENFORCEMENT,
                    coverage: v.coverage,
                    violations: v.violations,
                    budget: v.budget,
                    palette: v.palette,
                    total_items: v.total_items,
                  })}\n\n`,
                ));
                try {
                  console.log(JSON.stringify({
                    tag: "concierge_requirements_validation",
                    request_id: requestId,
                    ts: new Date().toISOString(),
                    tool: cardTool,
                    tool_call_id: proposal?.tool_call_id || null,
                    ok: false,
                    enforcement: REQUIREMENTS_ENFORCEMENT,
                    violations: v.violations,
                    coverage: v.coverage,
                    budget: v.budget,
                    palette: v.palette,
                    total_items: v.total_items,
                    unmatched_ids: v.unmatched_ids,
                    requirements: effectiveRequirements,
                  }));
                } catch { /* best-effort */ }

                if (REQUIREMENTS_ENFORCEMENT === "closed") {
                  // FAIL-CLOSED: swallow the card. Emit a `proposal_blocked`
                  // frame so the UI can render a refusal + retry affordance.
                  controller.enqueue(encoder.encode(
                    `event: proposal_blocked\ndata: ${JSON.stringify({
                      request_id: requestId,
                      tool: cardTool,
                      tool_call_id: proposal?.tool_call_id || null,
                      reason: "requirements_violation",
                      coverage: v.coverage,
                      violations: v.violations,
                      message: buildRequirementsBlockedMessage(v.violations),
                    })}\n\n`,
                  ));
                  const frame = { choices: [{ delta: { content: buildRequirementsBlockedMessage(v.violations) } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
                  return;
                }
              }
            } catch (e) {
              // Validator itself blew up — always fail-open regardless of
              // enforcement mode. A broken validator must never take down
              // real card emission.
              console.warn("[concierge requirements-diff] validator threw, emitting card without validation:", e);
            }
            void validationFailed;
            controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
          };

          for (const tc of orderedBuffers) {
            // ====== REQUIREMENTS (must precede card tools) ======
            if (tc.name === "extract_requirements") {
              let parsed: any = null;
              try { parsed = JSON.parse(tc.argsText || "{}"); } catch (e) {
                console.error("Could not parse extract_requirements args:", tc.argsText, e);
                continue;
              }
              // Normalize + clamp to schema shape. Everything the Inspector
              // Agent will diff against goes through this validator so a
              // model that skimps on fields still produces a usable payload.
              const slots: RequirementsSlot[] = Array.isArray(parsed.slots)
                ? parsed.slots
                    .filter((s: any) => s && typeof s.typology === "string")
                    .slice(0, 12)
                    .map((s: any) => ({
                      typology: String(s.typology).trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60),
                      qty_min: Math.max(1, Math.min(999, Number.isFinite(Number(s.qty_min)) ? Number(s.qty_min) : 1)),
                      qty_max: Math.max(1, Math.min(999, Number.isFinite(Number(s.qty_max)) ? Number(s.qty_max) : Number(s.qty_min) || 1)),
                      ...(typeof s.notes === "string" && s.notes.trim() ? { notes: String(s.notes).slice(0, 240) } : {}),
                    }))
                : [];
              const strArr = (v: any, cap = 8, len = 60): string[] =>
                Array.isArray(v)
                  ? v.filter((x: unknown) => typeof x === "string" && x.trim()).slice(0, cap).map((x: string) => x.slice(0, len))
                  : [];
              const payload: RequirementsPayload = {
                slots,
                style: strArr(parsed.style, 8, 80),
                materials: strArr(parsed.materials, 8, 80),
                brands: strArr(parsed.brands, 8, 80),
                room: typeof parsed.room === "string" ? parsed.room.slice(0, 80) : "",
                scale: typeof parsed.scale === "string" ? parsed.scale.slice(0, 80) : "",
                era: typeof parsed.era === "string" ? parsed.era.slice(0, 80) : "",
                notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 480) : "",
              };
              if (Number.isFinite(Number(parsed.budget_cents)) && Number(parsed.budget_cents) > 0) {
                payload.budget_cents = Math.floor(Number(parsed.budget_cents));
              }
              if (typeof parsed.budget_currency === "string" && /^[A-Z]{3}$/.test(parsed.budget_currency)) {
                payload.budget_currency = parsed.budget_currency;
              }
              capturedRequirements = payload;
              // Structured log so a run's requirements can be joined to the
              // Inspector log by request_id.
              try {
                console.log(JSON.stringify({
                  tag: "concierge_requirements",
                  request_id: requestId,
                  ts: new Date().toISOString(),
                  slot_count: payload.slots.length,
                  typologies: payload.slots.map((s) => s.typology),
                  total_qty_max: payload.slots.reduce((n, s) => n + s.qty_max, 0),
                  room: payload.room || null,
                  era: payload.era || null,
                  brands: payload.brands,
                  requirements: payload,
                }));
              } catch { /* ignore serialization */ }
              // Emit to the client so the UI can render the parsed brief chip
              // before the card streams in. Includes request_id for tracing.
              controller.enqueue(encoder.encode(
                `event: requirements\ndata: ${JSON.stringify({ request_id: requestId, requirements: payload })}\n\n`,
              ));
              continue;
            }

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
                emitProposalWithRequirementsDiff(proposal, preview);
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
                emitProposalWithRequirementsDiff(proposal, preview);
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
              emitProposalWithRequirementsDiff(proposal, preview);
              console.log(`[concierge] emitted propose_ffe_rows proposal: ${rows.length} rows across ${new Set(rows.map((r) => r.room)).size} room(s) for project ${projectId}`);
              continue;
            }

            // ====== VISUALIZATION BRIEF (Axonometric Studio hand-off) ======
            if (tc.name === "prepare_visualization_brief") {
              let parsed: any = {};
              try { parsed = JSON.parse(tc.argsText || "{}"); } catch (e) {
                console.error("Could not parse prepare_visualization_brief args:", tc.argsText, e);
                continue;
              }
              const ALLOWED_MODES = new Set([
                "elevation_to_axo","section_to_axo","stylize","composite","3d_to_cad","cad_overlay",
              ]);
              const ALLOWED_STYLES = new Set([
                "Photorealistic","Watercolor","Minimal Line","Editorial Luxury","Scandinavian",
              ]);
              const mode = typeof parsed.mode === "string" && ALLOWED_MODES.has(parsed.mode) ? parsed.mode : "composite";
              const stylePreset = typeof parsed.style_preset === "string" && ALLOWED_STYLES.has(parsed.style_preset)
                ? parsed.style_preset : "Editorial Luxury";
              const title = typeof parsed.title === "string" ? parsed.title.slice(0, 80) : null;
              const roomLabel = typeof parsed.room_label === "string" ? parsed.room_label.slice(0, 80) : null;
              const briefNotes = typeof parsed.brief_notes === "string" ? parsed.brief_notes.slice(0, 1200) : "";
              const sourceImageUrl = typeof parsed.source_image_url === "string" && /^https?:\/\//.test(parsed.source_image_url)
                ? parsed.source_image_url : null;
              const rawPickIds: string[] = Array.isArray(parsed.pick_ids) && parsed.pick_ids.length > 0
                ? parsed.pick_ids
                : firstTearsheetPicks;
              const pickIds = rawPickIds
                .filter((id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
                .slice(0, 12);

              // Hydrate a compact preview so the card can show thumbnails.
              let preview: any[] = [];
              if (pickIds.length) {
                try {
                  preview = await hydratePickPreview(supabase, pickIds);
                } catch (e) {
                  console.warn("[viz brief] preview hydration failed", e);
                }
              }

              const proposal = {
                tool: "prepare_visualization_brief",
                tool_call_id: tc.id || crypto.randomUUID(),
                args: {
                  mode,
                  style_preset: stylePreset,
                  title,
                  room_label: roomLabel,
                  brief_notes: briefNotes,
                  pick_ids: pickIds,
                  source_image_url: sourceImageUrl,
                },
                preview,
              };
              emitProposalWithRequirementsDiff(proposal, preview);
              console.log(`[concierge] emitted prepare_visualization_brief proposal: mode=${mode} preset=${stylePreset} picks=${pickIds.length}`);
              continue;
            }

            // ====== SPATIAL FIT ======
            // Invokes the `cad-check-fit` edge function with the user's bearer
            // token so RLS sees the right identity, then narrates the verdict.
            // ====== AUDIT: SPATIAL-FIT EDIT LOG ======
            if (tc.name === "log_spatial_fit_edit") {
              let parsed: any = {};
              try { parsed = JSON.parse(tc.argsText || "{}"); } catch { /* keep empty */ }
              try {
                const toUuid = (v: unknown) => {
                  const s = typeof v === "string" ? v.trim() : "";
                  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
                };
                const ALLOWED_FIELDS = new Set([
                  "cad_document_id","room_label","product_id","clearance_mm",
                  "initial","confirm","cancel","result",
                ]);
                const ALLOWED_VALIDATIONS = new Set([
                  "plan_not_found","plan_ambiguous","room_not_detected","room_ambiguous",
                  "piece_not_found","piece_ambiguous","clearance_out_of_range",
                  "clearance_unparseable","missing_field","other",
                ]);
                let field = String(parsed.field || "initial").slice(0, 32);
                if (!ALLOWED_FIELDS.has(field)) field = "other" as any;
                // 'result' is server-written only — strip if the model tries.
                if (field === "result") {
                  console.log("[concierge spatial-fit audit] dropping model-written 'result' row");
                  continue;
                }
                const outcome = parsed.outcome === "rejected" ? "rejected" : "accepted";
                let reason = parsed.reason ? String(parsed.reason).slice(0, 500).trim() : null;
                let failedValidation = parsed.failed_validation
                  ? String(parsed.failed_validation).trim().toLowerCase()
                  : null;
                if (failedValidation && !ALLOWED_VALIDATIONS.has(failedValidation)) {
                  failedValidation = "other";
                }
                if (outcome === "rejected") {
                  if (!reason) reason = "(model omitted rejection reason)";
                  if (!failedValidation) failedValidation = "other";
                }
                const turnsSinceConfirm = Number.isFinite(Number(parsed.turns_since_confirm))
                  ? Math.max(0, Math.round(Number(parsed.turns_since_confirm)))
                  : null;
                await supabase.from("cad_fit_edit_audit").insert({
                  user_id: userId,
                  field,
                  requested_value: parsed.requested_value ? String(parsed.requested_value).slice(0, 500) : null,
                  resolved_value: parsed.resolved_value ? String(parsed.resolved_value).slice(0, 500) : null,
                  outcome,
                  reason,
                  failed_validation: failedValidation,
                  cad_document_id: toUuid(parsed.cad_document_id),
                  room_label: parsed.room_label ? String(parsed.room_label).slice(0, 120) : null,
                  product_id: toUuid(parsed.product_id),
                  clearance_mm: Number.isFinite(Number(parsed.clearance_mm)) ? Math.round(Number(parsed.clearance_mm)) : null,
                  turns_since_confirm: turnsSinceConfirm,
                });
                console.log(`[concierge spatial-fit audit] ${field}/${outcome}${failedValidation ? "/" + failedValidation : ""} user=${userId}`);
              } catch (e) {
                console.error("[concierge spatial-fit audit] insert failed:", e);
              }
              continue;
            }


            // ---- Shared spatial-fit runner: clearance coercion + preflight + invoke + audit row ----
            // Used by both check_spatial_fit (single piece) and check_spatial_fit_batch (multi).
            const runSingleFitCheck = async (
              rawArgs: any,
              batchId: string | null,
            ): Promise<{ result: any; parsed: any; preflightError: string | null }> => {
              const parsed: any = { ...rawArgs };
              if (parsed.clearance_mm !== undefined) {
                const c = coerceClearance(parsed.clearance_mm);
                if (c == null || c < 0 || c > 3000) {
                  parsed.clearance_mm = 600;
                  console.warn("[concierge spatial-fit] clearance fallback to 600mm; raw:", rawArgs?.clearance_mm);
                } else {
                  parsed.clearance_mm = c;
                }
              }
              let preflightError: string | null = null;
              let preflightCode: string | null = null;
              try {
                if (parsed.cad_document_id) {
                  const { data: planRow } = await supabase
                    .from("cad_documents")
                    .select("file_name, status, parsed_geometry")
                    .eq("id", parsed.cad_document_id)
                    .maybeSingle();
                  const rooms = (planRow?.parsed_geometry as any)?.rooms || [];
                  if (!planRow) {
                    preflightCode = "plan_not_found";
                    preflightError = `Floor plan ${parsed.cad_document_id} not found. Re-upload at /trade/spatial-fit.`;
                  } else if (planRow.status !== "ready") {
                    preflightCode = "plan_not_ready";
                    preflightError = `Floor plan isn't ready (status: ${planRow.status || "missing"}). Re-upload at /trade/spatial-fit.`;
                  } else if (!rooms.length) {
                    preflightCode = "room_not_detected";
                    preflightError = `"${planRow.file_name}" has no detected rooms — can't run a fit-check against it.`;
                  }
                }
                let productHasCadAsset = false;
                if (!preflightError && parsed.cad_asset_id) {
                  const { data: assetRow } = await supabase
                    .from("trade_product_cad_assets")
                    .select("id, product_id, file_format, is_active")
                    .eq("id", parsed.cad_asset_id)
                    .maybeSingle();
                  if (!assetRow || assetRow.product_id !== parsed.product_id || assetRow.is_active !== true) {
                    preflightCode = "piece_not_found";
                    preflightError = `Attached CAD asset ${parsed.cad_asset_id} was not found for product ${parsed.product_id}.`;
                  } else {
                    productHasCadAsset = true;
                    try {
                      await fetch(`${supabaseUrl}/functions/v1/cad-parse-product-asset`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: auth.authHeader,
                          apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
                        },
                        body: JSON.stringify({ cad_asset_id: parsed.cad_asset_id }),
                      });
                    } catch (e) {
                      console.warn("[concierge spatial-fit] product CAD ingestion preflight failed:", e);
                    }
                  }
                }
                if (!preflightError && parsed.product_id) {
                  const { data: prodRow } = await supabase
                    .from("trade_products")
                    .select("title, dimensions")
                    .eq("id", parsed.product_id)
                    .maybeSingle();
                  const numCount = countDimensionNumbers(prodRow?.dimensions as any);
                  if (!prodRow) {
                    preflightCode = "piece_not_found";
                    preflightError = `Product ${parsed.product_id} not found in the catalog.`;
                  } else if (!productHasCadAsset && numCount < 2) {
                    preflightCode = "missing_dimensions";
                    preflightError = `"${prodRow.title}" has no published dimensions — fit-check would return 'unknown'.`;
                  }
                }
              } catch (e) {
                console.error("[concierge spatial-fit] preflight failed:", e);
              }

              let result: any;
              let transportError: string | null = null;
              if (preflightError) {
                result = { ok: false, verdict: "unknown", reasons: [preflightError], error: preflightError };
              } else {
                try {
                  const resp = await fetch(`${supabaseUrl}/functions/v1/cad-check-fit`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: auth.authHeader,
                      apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
                    },
                    body: JSON.stringify(parsed),
                  });
                  if (!resp.ok) transportError = `HTTP ${resp.status}`;
                  result = await resp.json().catch(() => {
                    transportError = transportError || `non-JSON response (HTTP ${resp.status})`;
                    return { ok: false, error: transportError };
                  });
                } catch (e) {
                  console.error("[concierge spatial-fit] invoke failed:", e);
                  transportError = "Spatial-fit service unreachable.";
                  result = { ok: false, error: transportError };
                }
              }

              try {
                const toUuid = (v: unknown) => {
                  const s = typeof v === "string" ? v.trim() : "";
                  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
                };
                const verdict = typeof result?.verdict === "string" ? result.verdict.slice(0, 32) : null;
                const isError = result?.ok === false || !verdict;
                const resultFailedValidation = classifyResultFailure({
                  preflightCode: preflightCode as any,
                  transportError,
                  verdict,
                  ok: result?.ok !== false,
                });
                await supabase.from("cad_fit_edit_audit").insert({
                  user_id: userId,
                  field: "result",
                  outcome: isError ? "rejected" : "accepted",
                  reason: isError ? String(preflightError || transportError || result?.error || "spatial-fit returned no verdict").slice(0, 500) : null,
                  failed_validation: resultFailedValidation,
                  cad_document_id: toUuid(parsed?.cad_document_id),
                  room_label: parsed?.room_label ? String(parsed.room_label).slice(0, 120) : null,
                  product_id: toUuid(parsed?.product_id),
                  clearance_mm: Number.isFinite(Number(parsed?.clearance_mm)) ? Math.round(Number(parsed.clearance_mm)) : null,
                  verdict,
                  batch_id: batchId,
                });
              } catch (e) {
                console.error("[concierge spatial-fit audit] result insert failed:", e);
              }

              return { result, parsed, preflightError };
            };

            // ---- Rate-limit gate shared by single + batch tools ----
            // 20 fit-checks per user per minute (best-effort, edge-instance scoped).
            const guardSpatialFitRate = async (toolName: string, cost = 1): Promise<boolean> => {
              for (let i = 0; i < cost; i++) {
                const rl = rateLimit(`spatial_fit:${userId}`, 20, 60_000);
                if (!rl.ok) {
                  try {
                    await supabase.from("cad_fit_edit_audit").insert({
                      user_id: userId,
                      field: "result",
                      outcome: "rejected",
                      reason: `rate_limited: retry in ~${rl.retryInSec}s`,
                      failed_validation: "rate_limited",
                    });
                  } catch (_) { /* swallow */ }
                  const msg = `You've hit the fit-check rate limit (20/min). Try again in about ${rl.retryInSec}s.`;
                  const synthetic = { choices: [{ delta: { content: msg } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(synthetic)}\n\n`));
                  console.warn(`[concierge ${toolName}] rate-limited user ${userId}, retry ${rl.retryInSec}s`);
                  return false;
                }
              }
              return true;
            };

            if (tc.name === "check_spatial_fit") {
              let parsed: any = null;
              try { parsed = JSON.parse(tc.argsText || "{}"); } catch (e) {
                console.error("Could not parse check_spatial_fit args:", tc.argsText, e);
                continue;
              }

              // #11: Rate-limit before any DB / network work.
              if (!(await guardSpatialFitRate("check_spatial_fit"))) {
                continue;
              }

              const { result, parsed: coerced, preflightError } = await runSingleFitCheck(parsed, null);
              const transportFlag = result?.ok === false && !preflightError ? " (transport error)" : "";
              console.log(`[concierge spatial-fit] verdict=${result?.verdict || "n/a"} reasons=${(result?.reasons || []).length}${preflightError ? " (preflight blocked)" : ""}${transportFlag}`);

              try {
                const followupSystem = [
                  "You are the Maison Affluency Trade Concierge — spatial-fit follow-up.",
                  "The user just asked whether a piece fits a room. The TOOL_RESULT below is the AUTHORITATIVE verdict from our deterministic CAD/clearance checker. DO NOT recompute the geometry — quote the verdict, room dims, product dims, and reasons verbatim.",
                  "Write ~80–120 words: lead with the verdict (Fits / Tight / Doesn't fit), state the product footprint vs the room footprint in millimetres (and a metres conversion in parentheses), then list each reason in plain English. If the verdict is `fail`, suggest the user try a smaller variant or a different room. If `unknown`, say the floor plan or product geometry is missing and point them to Spatial Fit (/trade/spatial-fit). Never invent dimensions.",
                ].join("\n");
                const followupMessages = [
                  { role: "system", content: followupSystem },
                  { role: "user", content: lastUserMsg.slice(0, 600) },
                  {
                    role: "assistant",
                    content: null,
                    tool_calls: [{
                      id: tc.id || "call_spatial_fit",
                      type: "function",
                      function: { name: "check_spatial_fit", arguments: JSON.stringify(coerced) },
                    }],
                  },
                  {
                    role: "tool",
                    tool_call_id: tc.id || "call_spatial_fit",
                    name: "check_spatial_fit",
                    content: JSON.stringify(result),
                  },
                ];
                const resp = await chatFetch( {
                  method: "POST",
                  headers: { Authorization: `Bearer ${aiAuthKey(LOVABLE_API_KEY)}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: aiModel(modelFor("balanced")),
                    max_completion_tokens: CHAT_MAX_TOKENS,
                    messages: followupMessages,
                  }),
                });
                if (resp.ok) {
                  const data = await resp.json();
                  if (data?.usage) {
                    logAiUsage({
                      feature: "trade-concierge-spatial-fit",
                      model: modelFor("balanced"),
                      usage: data.usage,
                      userId,
                    }).catch(() => {});
                  }
                  const text: string = data?.choices?.[0]?.message?.content || "";
                  if (text) {
                    const synthetic = { choices: [{ delta: { content: text } }] };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(synthetic)}\n\n`));
                  }
                } else {
                  console.error("[concierge spatial-fit] follow-up http", resp.status, await resp.text());
                }
              } catch (e) {
                console.error("[concierge spatial-fit] follow-up failed:", e);
              }
              continue;
            }

            // ====== MULTI-PIECE BATCH ======
            // Runs the deterministic fit-check against 2–8 pieces in one user turn,
            // all against the same plan + room. Each piece gets its own audit row
            // sharing a batch_id; the model then writes a single comparison summary.
            if (tc.name === "check_spatial_fit_batch") {
              let parsed: any = null;
              try { parsed = JSON.parse(tc.argsText || "{}"); } catch (e) {
                console.error("Could not parse check_spatial_fit_batch args:", tc.argsText, e);
                continue;
              }
              const pieces: any[] = Array.isArray(parsed?.pieces) ? parsed.pieces.slice(0, 8) : [];
              if (pieces.length === 0) {
                const msg = "Batch fit-check needs at least one piece.";
                const synthetic = { choices: [{ delta: { content: msg } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(synthetic)}\n\n`));
                continue;
              }
              // #11: Rate-limit accounts for every piece in the batch.
              if (!(await guardSpatialFitRate("check_spatial_fit_batch", pieces.length))) {
                continue;
              }

              const batchId = crypto.randomUUID();
              const perPiece: Array<{ input: any; result: any; preflightError: string | null }> = [];
              for (const piece of pieces) {
                const merged = {
                  cad_document_id: parsed.cad_document_id,
                  room_label: parsed.room_label,
                  product_id: piece?.product_id,
                  cad_asset_id: piece?.cad_asset_id,
                  variant_label: piece?.variant_label,
                  clearance_mm: piece?.clearance_mm,
                };
                const { result, parsed: coerced, preflightError } = await runSingleFitCheck(merged, batchId);
                perPiece.push({ input: coerced, result, preflightError });
              }
              console.log(`[concierge spatial-fit-batch] batch=${batchId} pieces=${perPiece.length} verdicts=${perPiece.map((p) => p.result?.verdict || "n/a").join(",")}`);

              const toolPayload = {
                batch_id: batchId,
                cad_document_id: parsed.cad_document_id,
                room_label: parsed.room_label || null,
                results: perPiece.map((p) => ({
                  product_id: p.input?.product_id,
                  cad_asset_id: p.input?.cad_asset_id || null,
                  variant_label: p.input?.variant_label || null,
                  clearance_mm: p.input?.clearance_mm ?? null,
                  verdict: p.result?.verdict || "unknown",
                  reasons: p.result?.reasons || [],
                  product_bbox_mm: p.result?.product_bbox_mm || null,
                  room_bbox_mm: p.result?.room_bbox_mm || null,
                  error: p.preflightError || p.result?.error || null,
                })),
              };

              try {
                const followupSystem = [
                  "You are the Maison Affluency Trade Concierge — spatial-fit batch follow-up.",
                  "The user asked whether several pieces fit the same room. TOOL_RESULT is the AUTHORITATIVE verdict per piece from the deterministic CAD/clearance checker. DO NOT recompute.",
                  "Write a tight comparison (≤200 words): a one-line summary of the room, then a bulleted list — one bullet per piece — leading with the verdict tag (Fits / Tight / Doesn't fit / Unknown), the footprint in mm (with m in parentheses), and the single most decisive reason. Close with one sentence recommending which piece(s) to pursue and which to drop. If every verdict is unknown, point the user to /trade/spatial-fit and ask them to verify the plan or dimensions. Never invent numbers.",
                ].join("\n");
                const followupMessages = [
                  { role: "system", content: followupSystem },
                  { role: "user", content: lastUserMsg.slice(0, 600) },
                  {
                    role: "assistant",
                    content: null,
                    tool_calls: [{
                      id: tc.id || "call_spatial_fit_batch",
                      type: "function",
                      function: { name: "check_spatial_fit_batch", arguments: tc.argsText || "{}" },
                    }],
                  },
                  {
                    role: "tool",
                    tool_call_id: tc.id || "call_spatial_fit_batch",
                    name: "check_spatial_fit_batch",
                    content: JSON.stringify(toolPayload),
                  },
                ];
                const resp = await chatFetch( {
                  method: "POST",
                  headers: { Authorization: `Bearer ${aiAuthKey(LOVABLE_API_KEY)}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: aiModel(modelFor("balanced")),
                    max_completion_tokens: CHAT_MAX_TOKENS,
                    messages: followupMessages,
                  }),
                });
                if (resp.ok) {
                  const data = await resp.json();
                  if (data?.usage) {
                    logAiUsage({
                      feature: "trade-concierge-spatial-fit-batch",
                      model: modelFor("balanced"),
                      usage: data.usage,
                      userId,
                    }).catch(() => {});
                  }
                  const text: string = data?.choices?.[0]?.message?.content || "";
                  if (text) {
                    const synthetic = { choices: [{ delta: { content: text } }] };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(synthetic)}\n\n`));
                  }
                } else {
                  console.error("[concierge spatial-fit-batch] follow-up http", resp.status, await resp.text());
                }
              } catch (e) {
                console.error("[concierge spatial-fit-batch] follow-up failed:", e);
              }
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
                const resp = await chatFetch( {
                  method: "POST",
                  headers: { Authorization: `Bearer ${aiAuthKey(LOVABLE_API_KEY)}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: aiModel(modelFor("balanced")),
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
            const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const rawPickIds: string[] = Array.isArray(parsed.pick_ids) ? parsed.pick_ids : [];
            let pickIds: string[] = rawPickIds.filter((x) => typeof x === "string" && UUID_RE.test(x));
            if (pickIds.length === 0) {
              console.warn(`[concierge] dropping ${tc.name} — no valid UUID pick_ids (got: ${JSON.stringify(rawPickIds).slice(0, 200)})`);
              const fallback = "Forgive me — I caught myself reaching for placeholders rather than actual pieces. Tell me a little more about the room or the mood you have in mind, and I'll pull from the Maison Affluency Curation properly.";
              const releaseFrame = { choices: [{ delta: { content: fallback } }] };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(releaseFrame)}\n\n`));
              continue;
            }
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
            let previewRaw = await hydratePickPreview(supabase, pickIds);
            if (requestedTypology) {
              previewRaw = previewRaw.filter((p: any) => rowMatchesRequestedTypology(p, requestedTypology));
            }
            // Always dedupe — collapses scraper-injected variant noise
            // (e.g. "Scala Dining Table" / "Scala 3Dining Table" /
            // "Scala 300 Dining Table" sharing the same brand + image)
            // regardless of whether a typology was inferred.
            ({ previewRaw, pickIds } = dedupePreviewRows(previewRaw, pickIds));
            // Honour in-chat "skip / exclude / omit …" instructions from the
            // latest user message so the proposal card ships pre-filtered.
            const streamExcludedIds = parseUserExclusions(lastUserMsg || "", previewRaw);
            let streamSkippedRows: any[] = [];
            if (streamExcludedIds.size > 0) {
              streamSkippedRows = previewRaw.filter((p: any) => p?.id && streamExcludedIds.has(p.id));
              previewRaw = previewRaw.filter((p: any) => p?.id && !streamExcludedIds.has(p.id));
              pickIds = pickIds.filter((id: string) => !streamExcludedIds.has(id));
              console.log(`[concierge] applied user skip list — dropped ${streamExcludedIds.size} pick(s) from ${tc.name}`);
            }
            // Confirmation gate — hold the proposal until the user approves
            // the skip list on the next turn.
            if (streamExcludedIds.size > 0 && !isConfirmingSkip && pickIds.length > 0) {
              const label = (parsed && typeof parsed.title === "string" && parsed.title.trim()) || "your";
              const confirmMsg = buildSkipConfirmationMessage(streamSkippedRows, previewRaw, label);
              const frame = { choices: [{ delta: { content: confirmMsg } }] };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
              continue;
            }
            if (requestedTypology && pickIds.length < 2) {
              console.warn(`[concierge] blocked ${tc.name} — insufficient true ${requestedTypology} picks after typology validation`);
              const releaseFrame = { choices: [{ delta: { content: buildNoStrictTypologyReply(requestedTypology) } }] };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(releaseFrame)}\n\n`));
              continue;
            }
            if (pickIds.length === 0) {
              const releaseFrame = { choices: [{ delta: { content: "Your skip list would remove every piece I was about to propose — nothing left to add. Send the request again with a shorter exclusion." } }] };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(releaseFrame)}\n\n`));
              continue;
            }

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
              emitProposalWithRequirementsDiff(proposal, preview);
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
              emitProposalWithRequirementsDiff(proposal, preview);
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
            effectiveBrief.plan.includes("propose_tearsheet") ||
            effectiveBrief.plan.includes("add_to_tearsheet");
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
          const room = effectiveBrief.brief.room;
          const style = effectiveBrief.brief.style;
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

        const emitDeterministicTearsheetFallback = async (): Promise<boolean> => {
          if (!forcePlannedTearsheet || stageForcesQuote) return false;
          const hasTearsheet = Array.from(toolCallBuffers.values()).some((b) =>
            b.name === "propose_tearsheet" || b.name === "add_to_tearsheet"
          );
          if (hasTearsheet) return false;
          const proposal = await buildDeterministicTearsheetProposal(
            supabase,
            Array.isArray((ragResult as any)?.rows) ? (ragResult as any).rows : [],
            effectiveBrief.brief,
            userConversationText,
          );
          if (!proposal) return false;
          const { validation } = validateProposalAgainstBrief(proposal, userConversationText, capturedRequirements);
          if (!validation.ok) {
            controller.enqueue(encoder.encode(
              `event: proposal_blocked\ndata: ${JSON.stringify({
                request_id: requestId,
                tool: "propose_tearsheet",
                tool_call_id: proposal.tool_call_id || null,
                reason: "requirements_violation",
                coverage: validation.coverage,
                violations: validation.violations,
                message: buildRequirementsBlockedMessage(validation.violations),
              })}\n\n`,
            ));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: buildRequirementsBlockedMessage(validation.violations) } }] })}\n\n`));
            console.warn(`[concierge deterministic-fallback] blocked proposal (${proposal.args?.pick_ids?.length || 0} picks) violations=${JSON.stringify(validation.violations)}`);
            return true;
          }
          const maxIdx = Array.from(toolCallBuffers.keys()).reduce((m, i) => (i > m ? i : m), -1);
          toolCallBuffers.set(maxIdx + 1, { id: proposal.tool_call_id, name: "propose_tearsheet", argsText: JSON.stringify(proposal.args) });
          controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
          const closing = "Here's a first edit — would you like me to refine this selection against your client's intentions?";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: closing } }] })}\n\n`));
          console.log(`[concierge deterministic-fallback] emitted propose_tearsheet (${proposal.args?.pick_ids?.length || 0} picks)`);
          return true;
        };

        const backfillVisualizationBriefIfNeeded = () => {
          if (!effectiveBrief.plan.includes("prepare_visualization_brief")) return;
          const buffers = Array.from(toolCallBuffers.entries());
          const hasVizBrief = buffers.some(([, b]) => b.name === "prepare_visualization_brief");
          if (hasVizBrief) return;
          const firstTearsheet = buffers.find(([, b]) => b.name === "propose_tearsheet" || b.name === "add_to_tearsheet");
          if (visualizationNeedsCatalogPicks && !firstTearsheet) return;
          let pickIds: string[] = [];
          let title = effectiveBrief.brief.summary || "Render brief";
          if (firstTearsheet) {
            try {
              const parsed = JSON.parse(firstTearsheet[1].argsText || "{}");
              if (Array.isArray(parsed.pick_ids)) pickIds = parsed.pick_ids.filter((id: unknown) => typeof id === "string").slice(0, 12);
              if (typeof parsed.title === "string" && parsed.title.trim()) title = parsed.title.trim();
            } catch { /* keep planner-derived fallback */ }
          }
          const room = effectiveBrief.brief.room || (/belgravia/.test(lastUserMsgLower) ? "Belgravia drawing-room" : null);
          const style = /editorial luxury/i.test(lastUserMsg) ? "Editorial Luxury" : (effectiveBrief.brief.style || "Editorial Luxury");
          const materials = effectiveBrief.brief.materials.length ? effectiveBrief.brief.materials.join(", ") : "the requested palette and materials";
          const briefNotes = [
            room ? `${room}:` : "Scene:",
            effectiveBrief.brief.summary || lastUserMsg,
            `Render in ${style} with ${materials}; compose the selected Maison Affluency pieces as overlay candidates with careful scale, sightlines and material fidelity.`,
          ].join(" ").slice(0, 1200);
          const maxIdx = buffers.reduce((m, [i]) => (i > m ? i : m), -1);
          toolCallBuffers.set(maxIdx + 1, {
            id: `synthetic-viz-${crypto.randomUUID()}`,
            name: "prepare_visualization_brief",
            argsText: JSON.stringify({
              mode: "composite",
              style_preset: style === "Editorial Luxury" ? "Editorial Luxury" : "Editorial Luxury",
              title: title.slice(0, 80),
              room_label: room || effectiveBrief.brief.room || null,
              brief_notes: briefNotes,
              pick_ids: pickIds,
            }),
          });
          console.log(`[concierge backfill] synthesized prepare_visualization_brief (${pickIds.length} picks)`);
        };

        // ----- Inner orchestration loop (Step 4) -----
        // After the main stream finishes, if the upstream planner asked for a
        // chained `propose_tearsheet → draft_quote` but the model only emitted
        // the tearsheet, run a follow-up non-streaming call that forces
        // `draft_quote` using the SAME pick_ids. Emits a second `event: proposal`
        // so the client renders one combined plan (tearsheet card + quote card).
        const runChainIfNeeded = async () => {
          if (!effectiveBrief.plan.includes("draft_quote")) return;
          if (!effectiveBrief.plan.includes("propose_tearsheet") && !effectiveBrief.plan.includes("add_to_tearsheet")) return;
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

          const qtyHint = effectiveBrief.brief.qty_hint || 1;
          const leadCeiling = effectiveBrief.brief.lead_weeks_max || null;
          const followupSystem = [
            "You are the Maison Affluency Trade Concierge follow-up step.",
            `The user's tearsheet pick_ids are: ${tearsheetPickIds.join(", ")}.`,
            `Active project_id (if any): ${resolvedProjectId || "null"}.`,
            `Default qty per line: ${qtyHint}.${leadCeiling ? ` Lead-time ceiling: ${leadCeiling} weeks.` : ""}`,
            "Call draft_quote NOW with one line per pick_id above (use the qty hint unless the brief implies otherwise). Do not output any prose.",
          ].join("\n");

          try {
            const resp = await chatFetch( {
              method: "POST",
              headers: { Authorization: `Bearer ${aiAuthKey(LOVABLE_API_KEY)}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: aiModel(modelFor("balanced")),
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
            const { validation } = validateProposalAgainstBrief(proposal, userConversationText, capturedRequirements);
            if (!validation.ok) {
              controller.enqueue(encoder.encode(
                `event: proposal_blocked\ndata: ${JSON.stringify({
                  request_id: requestId,
                  tool: "draft_quote",
                  tool_call_id: proposal.tool_call_id,
                  reason: "requirements_violation",
                  coverage: validation.coverage,
                  violations: validation.violations,
                  message: buildRequirementsBlockedMessage(validation.violations),
                })}\n\n`,
              ));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: buildRequirementsBlockedMessage(validation.violations) } }] })}\n\n`));
              console.warn(`[concierge chain] blocked draft_quote with ${lines.length} lines violations=${JSON.stringify(validation.violations)}`);
              return;
            }
            controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
            console.log(`[concierge chain] emitted draft_quote with ${lines.length} lines from tearsheet "${tearsheetTitle}"`);
          } catch (e) {
            console.error("chain draft_quote failed:", e);
          }
        };

        // ----- Promise-without-delivery recovery -----
        // If the assistant's prose announced a tearsheet (e.g. "here's a draft
        // tearsheet…", "curated pieces below", "review and amend") but no
        // tool call (tearsheet / quote / ffe) was emitted, force a follow-up
        // `propose_tearsheet` call so the card actually appears.
        const TEARSHEET_PROMISE_RE = /(draft\s+tearsheet|here'?s\s+a\s+(draft\s+)?tearsheet|curated\s+(pieces?|selection)\s+(below|that|with)|review\s+and\s+amend|tearsheet\s+with\s+some\s+curated|i(?:'d| would)?\s+recommend\s+the\s+following|recommend\s+the\s+following\s+(bespoke\s+)?(options?|pieces?|tables?|chairs?|sofas?|lamps?|sconces?|rugs?|consoles?)|here\s+are\s+(?:some|a\s+few)\s+(options?|pieces?|suggestions?)|consider\s+the\s+following|following\s+(bespoke\s+)?(options?|pieces?|suggestions?))/i;
        // Detect a prose "list" of 2+ named pieces (e.g. "Brand X's Oak Table: ...\n\nBrand Y's Walnut Table: ...")
        const PROSE_LIST_RE = /(^|\n)\s*(?:[-*•]\s+|\d+[.)]\s+|)([A-Z][A-Za-z'’&. ]{2,60}(?:Table|Chair|Sofa|Lamp|Sconce|Rug|Console|Cabinet|Sideboard|Bed|Mirror|Bench|Stool|Pendant|Chandelier|Desk|Shelf|Shelving|Bookcase|Armchair|Daybed)[A-Za-z'’ ]*)\s*:\s/g;
        const hasProseList = () => {
          const t = assistantTextBuf || "";
          PROSE_LIST_RE.lastIndex = 0;
          let m, n = 0;
          while ((m = PROSE_LIST_RE.exec(t)) !== null) { n++; if (n >= 2) return true; }
          return false;
        };
        const runTearsheetIfPromised = async () => {
          const buffers = Array.from(toolCallBuffers.values());
          const hasAnyDeliverable = buffers.some((b) =>
            b.name === "propose_tearsheet" ||
            b.name === "add_to_tearsheet" ||
            b.name === "draft_quote" ||
            b.name === "add_to_quote" ||
            b.name === "propose_ffe_rows" ||
            b.name === "prepare_visualization_brief"
          );
          if (hasAnyDeliverable) return;
          const promisedByPlan =
            effectiveBrief.plan.includes("propose_tearsheet") ||
            effectiveBrief.plan.includes("add_to_tearsheet");
          const promisedByText = TEARSHEET_PROMISE_RE.test(assistantTextBuf || "") || hasProseList();
          if (!promisedByPlan && !promisedByText) return;

          try {
            const nudge = [
              "You just told the user you would draft a tearsheet, but you did NOT call the propose_tearsheet tool.",
              "Call `propose_tearsheet` NOW with 4-8 pick_ids drawn ONLY from the CURATED PIECES section of the system prompt (exact UUIDs in square brackets).",
              "Include a short `title`, `pick_rationales` (one short reason per pick_id), and optional `note`.",
              "Do not output any prose — only the tool call.",
            ].join("\n");
            const resp = await chatFetch({
              method: "POST",
              headers: { Authorization: `Bearer ${aiAuthKey(LOVABLE_API_KEY)}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: aiModel(modelFor("balanced")),
                max_completion_tokens: CHAT_MAX_TOKENS,
                messages: [
                  { role: "system", content: languageDirective + systemPrompt },
                  ...trimmedMessages,
                  { role: "system", content: languageDirective + nudge },
                ],
                tools: TOOLS.filter((t: any) => t.function?.name === "propose_tearsheet"),
                tool_choice: { type: "function", function: { name: "propose_tearsheet" } },
              }),
            });
            if (!resp.ok) { console.error("[concierge promise-recovery] http", resp.status); return; }
            const data = await resp.json();
            if (data?.usage) {
              logAiUsage({
                feature: "trade-concierge-promise-recovery",
                model: modelFor("balanced"),
                usage: data.usage,
                userId,
              }).catch(() => {});
            }
            const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
            if (!argsStr) return;
            const parsed = JSON.parse(argsStr);
            const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const rawPickIds: string[] = Array.isArray(parsed.pick_ids) ? parsed.pick_ids : [];
            let pickIds: string[] = rawPickIds.filter((x) => typeof x === "string" && UUID_RE.test(x)).slice(0, 16);
            if (pickIds.length === 0) {
              console.warn("[concierge promise-recovery] no valid pick_ids returned");
              return;
            }
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
            let previewRaw = await hydratePickPreview(supabase, pickIds);
            if (requestedTypology) {
              previewRaw = previewRaw.filter((p: any) => rowMatchesRequestedTypology(p, requestedTypology));
              ({ previewRaw, pickIds } = dedupePreviewRows(previewRaw, pickIds));
              if (pickIds.length < 2) {
                console.warn(`[concierge promise-recovery] blocked — insufficient true ${requestedTypology} picks after typology validation`);
                const releaseFrame = { choices: [{ delta: { content: buildNoStrictTypologyReply(requestedTypology) } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(releaseFrame)}\n\n`));
                return;
              }
            }
            const preview = previewRaw.map((p: any) => {
              const r = p && rationaleMap[p.id];
              if (!r) return p;
              return { ...p, rationale: r.reason, rationale_detail: r.detail || null };
            });
            const proposal = {
              tool: "propose_tearsheet",
              tool_call_id: crypto.randomUUID(),
              args: {
                title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "Curated selection",
                pick_ids: pickIds,
                note: typeof parsed.note === "string" ? parsed.note : null,
                pick_rationales: rationaleMap,
              },
              preview,
            };
            const { validation } = validateProposalAgainstBrief(proposal, userConversationText, capturedRequirements);
            if (!validation.ok) {
              controller.enqueue(encoder.encode(
                `event: proposal_blocked\ndata: ${JSON.stringify({
                  request_id: requestId,
                  tool: "propose_tearsheet",
                  tool_call_id: proposal.tool_call_id,
                  reason: "requirements_violation",
                  coverage: validation.coverage,
                  violations: validation.violations,
                  message: buildRequirementsBlockedMessage(validation.violations),
                })}\n\n`,
              ));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: buildRequirementsBlockedMessage(validation.violations) } }] })}\n\n`));
              console.warn(`[concierge promise-recovery] blocked propose_tearsheet (${pickIds.length} picks) violations=${JSON.stringify(validation.violations)}`);
              return;
            }
            // Register the synthesized buffer so chained-quote recovery can see it.
            const maxIdx = Array.from(toolCallBuffers.keys()).reduce((m, i) => (i > m ? i : m), -1);
            toolCallBuffers.set(maxIdx + 1, {
              id: proposal.tool_call_id,
              name: "propose_tearsheet",
              argsText: JSON.stringify(proposal.args),
            });
            controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
            console.log(`[concierge promise-recovery] emitted propose_tearsheet (${pickIds.length} picks)`);
            if (effectiveBrief.plan.includes("prepare_visualization_brief")) {
              const room = effectiveBrief.brief.room || (/belgravia/.test(lastUserMsgLower) ? "Belgravia drawing-room" : null);
              const stylePreset = "Editorial Luxury";
              const materials = effectiveBrief.brief.materials.length ? effectiveBrief.brief.materials.join(", ") : "the requested palette and materials";
              const vizProposal = {
                tool: "prepare_visualization_brief",
                tool_call_id: `synthetic-viz-${crypto.randomUUID()}`,
                args: {
                  mode: "composite",
                  style_preset: stylePreset,
                  title: (typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "Render brief").slice(0, 80),
                  room_label: room,
                  brief_notes: `${room ? `${room}: ` : ""}${effectiveBrief.brief.summary || lastUserMsg} Render in ${stylePreset} with ${materials}; use the selected Maison Affluency pieces as overlay candidates with careful scale, sightlines and material fidelity.`.slice(0, 1200),
                  pick_ids: pickIds.slice(0, 12),
                  source_image_url: null,
                },
                preview: preview.slice(0, 12),
              };
              toolCallBuffers.set(maxIdx + 2, {
                id: vizProposal.tool_call_id,
                name: "prepare_visualization_brief",
                argsText: JSON.stringify(vizProposal.args),
              });
              controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(vizProposal)}\n\n`));
              console.log(`[concierge promise-recovery] emitted prepare_visualization_brief (${pickIds.length} picks)`);
            }
          } catch (e) {
            console.error("[concierge promise-recovery] failed:", e);
          }
        };

        let sawDone = false;
        const shouldSuppressSelectionProse = forcePlannedTearsheet;
        // Inspector gate: when the planner expects a card (tearsheet / quote /
        // ffe / etc), buffer prose deltas instead of streaming live so the
        // Inspector agent can diff-check against DB ground truth and rewrite
        // any factual claim before the user sees it.
        const plannerExpectsCard = Array.isArray(effectiveBrief?.plan) && effectiveBrief.plan.some((t) =>
          t === "propose_tearsheet" || t === "add_to_tearsheet" ||
          t === "draft_quote" || t === "add_to_quote" ||
          t === "propose_ffe_rows" || t === "estimate_shipping"
        );
        // Discovery-stage guard: ALSO buffer prose on turns with no expected
        // card, so the Discovery Guard can scrub invented brand/piece names
        // before the user sees them. Trust > streaming latency for a luxury
        // concierge. Only bypass when we already fully suppress prose.
        const shouldBufferProseForInspector = !shouldSuppressSelectionProse;
        const bufferedProseLines: string[] = [];
        // Some fallback models (notably Cloudflare Llama) do NOT emit native
        // `tool_calls`; they stringify the JSON envelope into `delta.content`.
        // If the very first content chunk looks like a tool-call envelope, we
        // suppress all text output for this turn and attempt to recover a
        // structured tool call at stream end.
        let suspectedToolCallText = false;
        let suppressedTextBuf = "";
        let forwardedAnyText = false;
        let assistantTextBuf = "";
        const looksLikeToolEnvelopeStart = (s: string) => {
          const t = s.trimStart();
          if (!t.startsWith("{")) return false;
          // Common Llama patterns we've observed
          return /^\{\s*"(type|name|function|parameters|arguments|tool|tool_call)"\s*:/.test(t);
        };
        // First-chunk heuristic: if the assistant's very first content delta
        // begins with `{`, treat it as a suspected stringified tool envelope
        // even before we can see the key. Real prose almost never opens with `{`.
        const looksLikeOpeningBrace = (s: string) => s.trimStart().startsWith("{");
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
                    // Emit an early `tool_start` frame the first time we see a
                    // card-producing tool name for this index. The client renders
                    // a skeleton card immediately while the model is still
                    // streaming the tool arguments.
                    if (buf.name && CARD_TOOL_NAMES.has(buf.name) && !toolStartEmittedIdx.has(idx)) {
                      toolStartEmittedIdx.add(idx);
                      const startFrame = {
                        tool: buf.name,
                        tool_call_id: buf.id ?? null,
                        index: idx,
                        request_id: requestId,
                      };
                      controller.enqueue(encoder.encode(`event: tool_start\ndata: ${JSON.stringify(startFrame)}\n\n`));
                    }
                  }
                  // Don't forward raw tool_call deltas to the client; we emit a proposal event instead.
                  continue;
                }
                // Inspect plain-text content for stringified tool-call envelopes
                const contentDelta = typeof delta?.content === "string" ? delta.content : null;
                  if (contentDelta !== null) {
                  if (!suspectedToolCallText && suppressedTextBuf === "" && !forwardedAnyText) {
                    if (looksLikeToolEnvelopeStart(contentDelta) || looksLikeOpeningBrace(contentDelta)) {
                      suspectedToolCallText = true;
                    }
                  }
                    if (shouldSuppressSelectionProse) {
                      assistantTextBuf += contentDelta;
                      continue; // selection turns must render validated cards, not prose product names
                    }
                  if (suspectedToolCallText) {
                    suppressedTextBuf += contentDelta;
                    continue; // do not forward
                  }
                  if (contentDelta.trim().length > 0) forwardedAnyText = true;
                  assistantTextBuf += contentDelta;
                }
                // Plain text delta — buffer if the Inspector is going to
                // validate a card, otherwise stream through unchanged.
                if (shouldBufferProseForInspector && delta && typeof delta.content === "string") {
                  bufferedProseLines.push(line);
                } else {
                  controller.enqueue(encoder.encode(line + "\n"));
                }
              } catch {
                // Forward unparseable lines as-is so the client can attempt recovery
                controller.enqueue(encoder.encode(line + "\n"));
              }
            }
          }
          // If we suppressed content that looked like a tool envelope, try to
          // recover it into a real tool_call. Otherwise, release the buffered
          // text so the user still sees a reply.
          if (suspectedToolCallText && suppressedTextBuf.trim().length > 0) {
            let recovered = false;
            try {
              // Strip code fences if present
              let raw = suppressedTextBuf.trim();
              const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
              if (fence) raw = fence[1].trim();
              const parsed = JSON.parse(raw);
              const name = parsed?.name ?? parsed?.function?.name ?? parsed?.tool ?? parsed?.tool_call?.name;
              const params = parsed?.parameters ?? parsed?.arguments ?? parsed?.function?.arguments ?? parsed?.tool_call?.arguments ?? {};
              const KNOWN = new Set([
                "propose_tearsheet", "add_to_tearsheet", "draft_quote", "add_to_quote",
                "propose_ffe_rows", "estimate_shipping", "check_spatial_fit",
                "check_spatial_fit_batch", "log_spatial_fit_edit", "prepare_visualization_brief",
              ]);
              if (typeof name === "string" && KNOWN.has(name)) {
                const argsText = typeof params === "string" ? params : JSON.stringify(params);
                toolCallBuffers.set(0, { id: crypto.randomUUID(), name, argsText });
                console.warn(`[concierge] recovered stringified tool_call from fallback model: ${name}`);
                recovered = true;
              }
            } catch (e) {
              console.warn("[concierge] failed to parse suspected tool envelope:", (e as Error).message);
            }
            if (!recovered) {
              // Not a real tool envelope — release the text to the client so the
              // user isn't left with an empty assistant turn.
              const releaseFrame = {
                choices: [{ delta: { content: suppressedTextBuf } }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(releaseFrame)}\n\n`));
            }
          }

          // Stream fully consumed.
          // (1) Symmetric back-fill: if the model emitted ONLY a quote but the planner
          //     also expected a tearsheet, synthesize a propose_tearsheet buffer from
          //     the quote's pick_ids BEFORE flushProposal so deterministic ordering
          //     (tearsheet → quote) holds without buffering SSE writes.
          backfillTearsheetIfNeeded();
          backfillVisualizationBriefIfNeeded();
          await flushProposal();
          await emitDeterministicTearsheetFallback();
          // (1b) Promise-without-delivery recovery: the model wrote prose like
          //      "here's a draft tearsheet…" but never emitted propose_tearsheet
          //      (and no quote/ffe either). Force a follow-up tool call so the
          //      user actually sees the card they were promised.
          await runTearsheetIfPromised();
          // (2) Reverse back-fill: tearsheet emitted but quote missing — forces a
          //     draft_quote follow-up and emits it after the tearsheet card.
          await runChainIfNeeded();

          // ---- Inspector Agent (second-pass factual validator) ----
          // Only runs when we buffered prose AND at least one card proposal
          // was actually emitted this turn. Cheap fast model diff-checks the
          // buffered prose against the DB rows behind the card(s) and rewrites
          // any factual claim that contradicts them (wrong totals, wrong
          // brand attribution, invented pieces). Fail-open: on error the
          // original buffered prose is flushed unchanged.
          if (shouldBufferProseForInspector) {
            // Build the shared allowlist ONCE per turn — reused by the
            // Inspector fallback redactor and the Discovery Guard.
            const allowedDesigners = Array.isArray(designerNames) ? designerNames.slice(0, 400) : [];
            const titleRe = /["“]([^"”\n]{2,120})["”]/g;
            const allowedTitles: string[] = [];
            {
              let tm: RegExpExecArray | null;
              const src = typeof piecesList === "string" ? piecesList : "";
              while ((tm = titleRe.exec(src)) !== null) {
                const t = tm[1].trim();
                if (t) allowedTitles.push(t);
                if (allowedTitles.length >= 800) break;
              }
            }

            // Hard-fallback emitter: when a guardrail LLM fails, we NEVER
            // release the raw model prose. We deterministically redact it;
            // if redaction guts it, we replace with SAFE_FALLBACK_PROSE.
            const flushWithHardFallback = (rawProse: string, tag: string, reason: string) => {
              const red = deterministicRedact({
                prose: rawProse,
                allowedDesigners,
                allowedPieceTitles: allowedTitles,
              });
              const finalProse = red.gutted || !red.redacted_prose ? SAFE_FALLBACK_PROSE : red.redacted_prose;
              try {
                console.log(JSON.stringify({
                  tag: "concierge_hard_fallback",
                  request_id: requestId,
                  ts: new Date().toISOString(),
                  source: tag,
                  reason,
                  chars_removed: red.chars_removed,
                  removed_spans: red.removed_spans,
                  gutted: red.gutted,
                  used_safe_fallback: red.gutted || !red.redacted_prose,
                  original_len: rawProse.length,
                  final_len: finalProse.length,
                }));
              } catch { /* best-effort */ }
              controller.enqueue(encoder.encode(`event: hard_fallback\ndata: ${JSON.stringify({ source: tag, reason, removed: red.removed_spans, safe_fallback: red.gutted || !red.redacted_prose, request_id: requestId })}\n\n`));
              const frame = { choices: [{ delta: { content: finalProse } }] };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
            };

            // Trivial-completion sanity net: some upstream models (or the
            // Cloudflare Llama fallback with tools stripped) occasionally emit
            // a single-token reply like `true` / `false` / `null` / `{}`.
            // The guardrail pipeline would happily pass those through — they
            // contain no designer names — so the user sees the literal word
            // "true" as the assistant reply. Detect and swap for the safe
            // discovery fallback before running any guard/inspector.
            {
              const trivial = assistantTextBuf.trim();
              const looksTrivial =
                trivial.length > 0 &&
                trivial.length <= 8 &&
                /^["'`]?(true|false|null|undefined|yes|no|ok|okay|\{\}|\[\]|""|'')["'`]?[.!?]?$/i.test(trivial);
              const hasAnyCard = toolCallBuffers.size > 0;
              if (looksTrivial && !hasAnyCard) {
                try {
                  console.log(JSON.stringify({
                    tag: "concierge_trivial_completion",
                    request_id: requestId,
                    ts: new Date().toISOString(),
                    raw: trivial,
                    len: trivial.length,
                  }));
                } catch { /* best-effort */ }
                controller.enqueue(encoder.encode(`event: hard_fallback\ndata: ${JSON.stringify({ source: "trivial_completion", reason: "single_token_reply", raw: trivial, request_id: requestId })}\n\n`));
                const frame = { choices: [{ delta: { content: SAFE_FALLBACK_PROSE } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
                if (sawDone) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                try { await finalizeResume("complete"); } catch { /* ignore */ }
                controller.close();
                return;
              }
            }

            try {
              const cardBufs = Array.from(toolCallBuffers.values()).filter((b) =>
                b.name === "propose_tearsheet" || b.name === "add_to_tearsheet" ||
                b.name === "draft_quote" || b.name === "add_to_quote"
              );
              const groundTruthCards: Array<{ tool: string; pickIds: string[]; previews: any[] }> = [];
              for (const b of cardBufs) {
                let parsed: any = null;
                try { parsed = JSON.parse(b.argsText || "{}"); } catch { continue; }
                let ids: string[] = [];
                if (Array.isArray(parsed.pick_ids)) {
                  ids = parsed.pick_ids.filter((x: unknown) => typeof x === "string");
                } else if (Array.isArray(parsed.lines)) {
                  ids = parsed.lines
                    .map((l: any) => (l && typeof l.pick_id === "string" ? l.pick_id : null))
                    .filter((x: string | null): x is string => !!x);
                }
                if (!ids.length) continue;
                const previews = await hydratePickPreview(supabase, ids);
                groundTruthCards.push({ tool: b.name || "unknown", pickIds: ids, previews });
              }

              const proseText = assistantTextBuf.trim();
              if (groundTruthCards.length && proseText.length > 0) {
                const gt = buildInspectorGroundTruth(groundTruthCards);
                const reqValidation = validateRequirementsCoverage(
                  capturedRequirements as any,
                  gt,
                );
                if (!reqValidation.ok) {
                  controller.enqueue(encoder.encode(`event: requirements_validation\ndata: ${JSON.stringify({ request_id: requestId, ok: false, violations: reqValidation.violations, coverage: reqValidation.coverage })}\n\n`));
                  try {
                    console.log(JSON.stringify({
                      tag: "concierge_requirements_validation",
                      request_id: requestId,
                      ts: new Date().toISOString(),
                      ok: false,
                      violations: reqValidation.violations,
                      coverage: reqValidation.coverage,
                      total_items: reqValidation.total_items,
                      unmatched_ids: reqValidation.unmatched_ids,
                    }));
                  } catch { /* best-effort */ }
                }
                const inspector = await runInspectorPass({
                  prose: proseText,
                  groundTruth: gt,
                  apiKey: LOVABLE_API_KEY,
                });
                logInspectorRun(buildInspectorLogRecord({
                  requestId,
                  originalProse: proseText,
                  result: inspector,
                  groundTruth: gt,
                  requirements: capturedRequirements as any,
                  requirementsValidation: reqValidation,
                }));
                if (inspector.corrections.length > 0 || !reqValidation.ok) {
                  controller.enqueue(encoder.encode(`event: inspector\ndata: ${JSON.stringify({ ok: inspector.ok && reqValidation.ok, corrections: inspector.corrections, ms: inspector.ms, request_id: requestId, requirements_ok: reqValidation.ok, slot_violations: reqValidation.violations })}\n\n`));
                }
                if (!inspector.ok) {
                  // HARD FALLBACK — never release raw model prose when the
                  // Inspector fails. Deterministic redaction + safe fallback.
                  flushWithHardFallback(proseText, "inspector", inspector.reason || "inspector_failed");
                } else {
                  const finalProse = inspector.corrected_prose;
                  if (finalProse) {
                    const frame = { choices: [{ delta: { content: finalProse } }] };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
                  }
                }
              } else {
                // No card emitted this turn — run BOTH the Discovery Guard
                // AND the Inspector Agent (with an empty ground truth + the
                // curation allowlist) so pure discovery prose gets the same
                // fact-checking rigor as card-bearing turns.
                const proseTextForGuard = assistantTextBuf.trim();
                if (proseTextForGuard.length > 0) {
                  // Stage 1: Discovery Guard — strips obvious namedrops fast.
                  const guard = await runDiscoveryProseGuard({
                    prose: proseTextForGuard,
                    allowedDesigners,
                    allowedPieceTitles: allowedTitles,
                    apiKey: LOVABLE_API_KEY,
                  });
                  try {
                    console.log(JSON.stringify({
                      tag: "concierge_discovery_guard",
                      request_id: requestId,
                      ts: new Date().toISOString(),
                      ok: guard.ok,
                      ms: guard.ms,
                      reason: guard.reason,
                      removed_names: guard.removed_names,
                      changed: guard.ok && guard.corrected_prose.trim() !== proseTextForGuard.trim(),
                      original_len: proseTextForGuard.length,
                      corrected_len: guard.corrected_prose.length,
                      allowed_designers_count: allowedDesigners.length,
                      allowed_titles_count: allowedTitles.length,
                    }));
                  } catch { /* best-effort */ }
                  if (guard.removed_names.length > 0) {
                    controller.enqueue(encoder.encode(`event: discovery_guard\ndata: ${JSON.stringify({ removed: guard.removed_names, ms: guard.ms, request_id: requestId })}\n\n`));
                  }
                  if (!guard.ok) {
                    // HARD FALLBACK — guard failed; do not fall through to
                    // the Inspector on unreviewed raw prose.
                    flushWithHardFallback(proseTextForGuard, "discovery_guard", guard.reason || "guard_failed");
                  } else {
                    // Stage 2: Inspector Agent — second-pass factual audit
                    // against the curation allowlist. Runs even without any
                    // card GT because the allowlist supplies the scope of
                    // permitted names.
                    const guardOut = guard.corrected_prose;
                    const inspectorDiscovery = await runInspectorPass({
                      prose: guardOut,
                      groundTruth: { cards: [] },
                      apiKey: LOVABLE_API_KEY,
                      allowedDesigners,
                      allowedPieceTitles: allowedTitles,
                    });
                    logInspectorRun(buildInspectorLogRecord({
                      requestId,
                      originalProse: guardOut,
                      result: inspectorDiscovery,
                      groundTruth: { cards: [] },
                      requirements: capturedRequirements as any,
                      requirementsValidation: null,
                    }));
                    if (inspectorDiscovery.corrections.length > 0) {
                      controller.enqueue(encoder.encode(`event: inspector\ndata: ${JSON.stringify({ ok: inspectorDiscovery.ok, corrections: inspectorDiscovery.corrections, ms: inspectorDiscovery.ms, request_id: requestId, discovery: true })}\n\n`));
                    }
                    if (!inspectorDiscovery.ok) {
                      // Inspector failed on the guard-cleaned prose — hard
                      // fallback rather than releasing the guard output raw.
                      flushWithHardFallback(guardOut, "inspector_discovery", inspectorDiscovery.reason || "inspector_failed");
                    } else if (inspectorDiscovery.corrected_prose) {
                      const frame = { choices: [{ delta: { content: inspectorDiscovery.corrected_prose } }] };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
                    }
                  }
                }
                // else: no prose at all — nothing to release.
              }
            } catch (inspErr) {
              // HARD FALLBACK — an exception in the guardrail pipeline must
              // NEVER release raw model prose. Redact deterministically and
              // swap in the safe fallback if the redaction guts the reply.
              console.error("[concierge inspector] pass failed, applying hard fallback:", inspErr);
              const rawProse = assistantTextBuf.trim();
              if (rawProse) {
                flushWithHardFallback(rawProse, "pipeline_exception", (inspErr as Error)?.message || "unknown");
              }
            }
          }

          if (sawDone) controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        } catch (e) {
          console.error("stream interceptor error:", e);
          try { await finalizeResume("error"); } catch { /* ignore */ }
        } finally {
          // Mark the resume session complete so a late reconnect can drain
          // the frames it missed and terminate cleanly.
          try { await finalizeResume("complete"); } catch { /* ignore */ }
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
    flushTrace("error", { message: e instanceof Error ? e.message : String(e) });
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
