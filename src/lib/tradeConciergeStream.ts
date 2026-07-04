import { supabase } from "@/integrations/supabase/client";

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type ChatMessage = {
  role: "user" | "assistant";
  content: string | ChatContentPart[];
};

/** Extract plain text from a possibly-multimodal content payload. */
export function chatMessageText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((p): p is Extract<ChatContentPart, { type: "text" }> => p?.type === "text")
    .map((p) => p.text)
    .join(" ");
}

export type RationaleEntry = { reason: string; detail?: string | null };

/**
 * Attached by the edge function to every card-producing proposal. Reports
 * whether the assembled `pick_ids` cover the `capturedRequirements` slots
 * extracted earlier in the same turn. Cards render this as a badge:
 * "Matches brief" (ok) or "Does not satisfy brief" (violations), with a
 * tooltip listing the per-slot shortfalls.
 */
export type RequirementsValidation = {
  ok: boolean;
  brand_ok?: boolean;
  budget_ok?: boolean;
  palette_ok?: boolean;
  coverage?: Array<{
    slot?: string;
    typology?: string | null;
    required_qty?: number;
    delivered_qty?: number;
    // legacy shape from the inspector: `qty_min` + `delivered`
    qty_min?: number;
    qty_max?: number;
    delivered?: number;
  }>;
  violations?: Array<{
    kind?:
      | "slot_undelivered"
      | "slot_overdelivered"
      | "brand_mismatch"
      | "budget_over"
      | "budget_currency_mismatch"
      | "palette_mismatch"
      | "no_slots";
    slot?: string;
    typology?: string | null;
    required_qty?: number;
    delivered_qty?: number;
    reason?: string;
    // budget fields
    requested_cents?: number;
    total_cents?: number;
    currency?: string;
    over_by_cents?: number;
    // palette fields
    requested?: string[];
    found?: string[];
    offending_ids?: string[];
    offending_titles?: string[];
  }>;
  budget?: {
    requested_cents: number;
    currency: string;
    priced_items: number;
    unpriced_items: number;
    total_cents: number;
    over_by_cents: number;
    ok: boolean;
  } | null;
  palette?: {
    requested: string[];
    ok: boolean;
    matched_ids: string[];
    offending_ids: string[];
  } | null;
  total_items?: number;
  unmatched_ids?: string[];
  enforcement?: "open" | "closed";
};


export type CreateTearsheetProposal = {
  tool: "propose_tearsheet";
  tool_call_id: string;
  args: {
    title: string;
    pick_ids: string[];
    note: string | null;
    pick_rationales?: Record<string, RationaleEntry>;
  };
  preview: PickPreview[];
  requirements_validation?: RequirementsValidation;
};

export type AddToTearsheetProposal = {
  tool: "add_to_tearsheet";
  tool_call_id: string;
  args: {
    board_id: string | null;
    board_title: string;
    pick_ids: string[];
    note: string | null;
    pick_rationales?: Record<string, RationaleEntry>;
  };
  preview: PickPreview[];
  requirements_validation?: RequirementsValidation;
};

export type QuoteLine = {
  pick_id: string;
  qty: number;
  variant?: string | null;
  lead_weeks?: number | null;
  note?: string | null;
};

export type DraftQuoteProposal = {
  tool: "draft_quote";
  tool_call_id: string;
  args: {
    project_id: string | null;
    /** Picked client id (added by the QuoteProposalCard before commit). */
    client_id?: string | null;
    /** Denormalized client display name (written alongside client_id, per memory rule). */
    client_name?: string | null;
    currency: string | null;
    note: string | null;
    lines: QuoteLine[];
  };
  preview: QuoteLinePreview[];
  requirements_validation?: RequirementsValidation;
};

export type AddToQuoteProposal = {
  tool: "add_to_quote";
  tool_call_id: string;
  args: {
    quote_id: string;
    quote_label: string;
    note: string | null;
    lines: QuoteLine[];
  };
  preview: QuoteLinePreview[];
  requirements_validation?: RequirementsValidation;
};

export type TearsheetProposal = CreateTearsheetProposal | AddToTearsheetProposal;
export type QuoteProposal = DraftQuoteProposal | AddToQuoteProposal;

export type FfeRow = {
  pick_id: string;
  room: string;
  qty: number;
  variant?: string | null;
  lead_weeks?: number | null;
  note?: string | null;
};

export type FfeLinePreview = QuoteLinePreview & { room: string };

export type FfeProposal = {
  tool: "propose_ffe_rows";
  tool_call_id: string;
  args: {
    project_id: string;
    project_name: string | null;
    currency: string | null;
    note: string | null;
    rows: FfeRow[];
  };
  preview: FfeLinePreview[];
  requirements_validation?: RequirementsValidation;
};

export type VisualizationBriefProposal = {
  tool: "prepare_visualization_brief";
  tool_call_id: string;
  args: {
    mode: "elevation_to_axo" | "section_to_axo" | "stylize" | "composite" | "3d_to_cad" | "cad_overlay";
    style_preset: "Photorealistic" | "Watercolor" | "Minimal Line" | "Editorial Luxury" | "Scandinavian";
    title: string | null;
    room_label: string | null;
    brief_notes: string;
    pick_ids: string[];
    source_image_url: string | null;
  };
  preview: PickPreview[];
  requirements_validation?: RequirementsValidation;
};

export type ConciergeProposal = TearsheetProposal | QuoteProposal | FfeProposal | VisualizationBriefProposal;

export type EscalationEvent = {
  sentiment: string;
  intent: string;
  user_id: string | null;
  excerpt: ChatMessage[];
};

export type PickPreview = {
  id: string;
  title: string;
  image_url: string | null;
  image_from_hotspot?: boolean;
  materials: string | null;
  category: string | null;
  designer_name: string | null;
  rationale?: string;
  rationale_detail?: string | null;
};

export type VariantOption = {
  label: string;
  price_cents: number | null;
};

export type QuoteLinePreview = {
  pick_id: string;
  title: string;
  designer_name: string | null;
  image_url: string | null;
  variant: string | null;
  qty: number;
  unit_price_cents: number | null;
  currency: string | null;
  trade_discount_pct: number;
  lead_weeks: number | null;
  note: string | null;
  variant_options?: VariantOption[];
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-concierge`;
const PUBLIC_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/concierge-public-stream`;

export type InspectorEvent = {
  ok: boolean;
  corrections: Array<{ original: string; replacement: string; reason: string }>;
  ms: number;
  request_id?: string;
};

/**
 * Hard-constraint pre-filters actually applied to catalog retrieval for
 * this turn (color/material/category tokens). Emitted once, near the start
 * of the SSE stream. Empty arrays mean nothing was filtered — the UI should
 * treat that as "no chips" rather than an error.
 */
export type AppliedConstraintsEvent = {
  colors: string[];
  materials: string[];
  categories: string[];
  /** Which catalog path(s) the filters were actually applied to. */
  applied_to: Array<"rag" | "sql">;
  /** True when the hard-constraint pre-filter matched zero pieces this turn. */
  empty?: boolean;
  /** Which retrieval path returned zero rows (rag = pgvector shortlist, sql = bulk catalog). */
  empty_source?: "rag" | "sql" | null;
};

/**
 * Emitted the first time the model starts streaming a card-producing tool
 * call (`propose_tearsheet`, `add_to_tearsheet`, `draft_quote`,
 * `add_to_quote`, `propose_ffe_rows`, `prepare_visualization_brief`),
 * BEFORE the completed `event: proposal` frame arrives. The client uses this
 * to render a skeleton card immediately so the architect sees the AI
 * "thinking" instead of a blank pause.
 */
export type ToolStartEvent = {
  tool:
    | "propose_tearsheet"
    | "add_to_tearsheet"
    | "draft_quote"
    | "add_to_quote"
    | "propose_ffe_rows"
    | "prepare_visualization_brief";
  tool_call_id: string | null;
  index: number;
  request_id?: string;
};

/**
 * Fires when the SSE stream drops mid-turn and the client is about to
 * transparently reconnect. Lets the UI surface a subtle "Reconnecting…"
 * hint without treating the drop as a hard error. `attempt` is 1-indexed
 * (attempt=1 = first retry after the initial failure).
 */
export type ReconnectEvent = {
  attempt: number;
  maxAttempts: number;
  reason: "network_error" | "stream_truncated";
  /** ms until the next attempt starts (already scheduled). */
  delayMs: number;
};

export async function streamConcierge({
  messages,
  projectId,
  surface,
  lang,
  onDelta,
  onProposal,
  onToolStart,
  onEscalation,
  onRequestId,
  onInspector,
  onAppliedConstraints,
  onReconnect,
  onDone,
  onError,
  signal,
}: {
  messages: ChatMessage[];
  /** Active trade project id (from session storage / URL) — gives the agent project + studio context. */
  projectId?: string | null;
  /** "public" for anon /concierge visitors; "trade" (default) for signed-in trade users. */
  surface?: "public" | "trade";
  /** UI language code (en/id/th/zh). Forwarded to the edge function so the model's reply language matches the picker. */
  lang?: string | null;
  onDelta: (text: string) => void;
  onProposal?: (proposal: ConciergeProposal) => void;
  /**
   * Fires as soon as the model begins streaming a card-producing tool call,
   * before the full `event: proposal` frame arrives. Use to render a
   * skeleton placeholder card in the timeline.
   */
  onToolStart?: (event: ToolStartEvent) => void;
  onEscalation?: (event: EscalationEvent) => void;
  /** Fires once at the start of the stream with the server-side trace id. */
  onRequestId?: (requestId: string) => void;
  /** Fires each time the Inspector Agent completes a card run. */
  onInspector?: (event: InspectorEvent) => void;
  /** Fires once near the start with the hard-constraint pre-filters applied to catalog retrieval. */
  onAppliedConstraints?: (event: AppliedConstraintsEvent) => void;
  /** Fires when the stream drops mid-turn and we're about to auto-reconnect. */
  onReconnect?: (event: ReconnectEvent) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  signal?: AbortSignal;
}) {
  // Forward the user's session token so the edge function can list their existing tearsheets.
  const { data: sess } = await supabase.auth.getSession();
  const bearer = sess.session?.access_token || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

  // Stable per-session id for anon rate limiting on the public surface.
  let publicSid: string | null = null;
  if (surface === "public") {
    try {
      publicSid = sessionStorage.getItem("concierge:sid");
      if (!publicSid) {
        publicSid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem("concierge:sid", publicSid);
      }
    } catch { /* ignore */ }
  }

  const endpoint = surface === "public" ? PUBLIC_CHAT_URL : CHAT_URL;

  // Reconnect budget. When we hold a server-side resume token
  // (`streamId`) we can safely reconnect even after structured events
  // have been emitted, because the server replays only frames with
  // seq > lastSeq — no duplicates. Without a token we fall back to
  // partial-text continuation and stop after structured output.
  const MAX_ATTEMPTS = 3;
  const backoffMs = (attempt: number) => Math.min(4000, 500 * 2 ** attempt);

  // Preserved across reconnect attempts.
  let partialText = "";
  let hasStructuredOutput = false;
  let requestIdNotified = false;
  let currentMessages: ChatMessage[] = messages;
  // Server-side cursor. Populated from `event: stream_start` and
  // `:seq=N` SSE comments so a reconnect can request an exact resume.
  let streamId: string | null = null;
  let lastSeq = 0;

  const initialClientRequestId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  type AttemptOutcome =
    | { kind: "done" }
    | { kind: "truncated" }
    | { kind: "network_error"; message: string }
    | { kind: "hard_error"; message: string }
    | { kind: "resume_expired" }; // server returned 410; caller should fall back to continuation

  type AttemptMode = "fresh" | "resume" | "continuation";

  const runOnce = async (mode: AttemptMode): Promise<AttemptOutcome> => {
    const clientRequestId = mode === "fresh"
      ? initialClientRequestId
      : (crypto.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const body = mode === "resume" && streamId
      ? { resume: { stream_id: streamId, last_seq: lastSeq }, surface: surface ?? "trade" }
      : { messages: currentMessages, project_id: projectId ?? null, surface: surface ?? "trade", lang: lang ?? null };

    // Track the custom (non-standard) headers we send so the client can name a
    // suspect when a CORS preflight fails silently in the browser. Standard
    // headers (Content-Type/Authorization/apikey) never trigger a preflight
    // block on their own — a mismatch always comes from one of these.
    const customHeaders: string[] = ["x-request-id"];
    if (surface === "public") customHeaders.push("x-concierge-surface", "x-concierge-sid");

    let resp: Response;
    try {
      resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          "x-request-id": clientRequestId,
          ...(surface === "public" ? { "x-concierge-surface": "public", "x-concierge-sid": publicSid ?? "" } : {}),
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (signal?.aborted) return { kind: "hard_error", message: "aborted" };
      // A TypeError with no Response object is the browser's tell for a failed
      // CORS preflight (or a network layer refusal). Tag the outcome so the UI
      // can surface a targeted toast naming the custom headers we sent, since
      // those are the only realistic culprits for a preflight rejection.
      const msg = e instanceof Error ? e.message : "fetch failed";
      const isCorsLikely =
        e instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(msg);
      if (isCorsLikely) {
        return {
          kind: "network_error",
          message: `CORS_LIKELY:${customHeaders.join(",")}|${msg}`,
        };
      }
      return { kind: "network_error", message: msg };
    }

    if (!resp.ok) {
      let errBody: any;
      try { errBody = await resp.json(); } catch { errBody = { error: "Request failed" }; }
      if (mode === "resume" && resp.status === 410) return { kind: "resume_expired" };
      if (resp.status === 401 || resp.status === 403) return { kind: "hard_error", message: "UNAUTHORIZED" };
      if (resp.status === 429 && errBody.retry_in != null) return { kind: "hard_error", message: `RATE_LIMIT:${errBody.retry_in}` };
      return { kind: "hard_error", message: errBody.error || `Error ${resp.status}` };
    }

    if (!resp.body) return { kind: "hard_error", message: "No response stream" };

    if (!requestIdNotified && onRequestId) {
      requestIdNotified = true;
      try { onRequestId(initialClientRequestId); } catch { /* ignore */ }
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamDone = false;
    let currentEvent: string | null = null;

    const handleDataPayload = (jsonStr: string) => {
      if (jsonStr === "[DONE]") { streamDone = true; return; }
      try {
        const parsed = JSON.parse(jsonStr);
        if (currentEvent === "stream_start") {
          const sid = (parsed as { stream_id?: string })?.stream_id;
          if (typeof sid === "string") streamId = sid;
          return;
        }
        if (currentEvent === "stream_resume" || currentEvent === "resume_timeout" || currentEvent === "resume_error") {
          // Informational — ignored by callers, but useful in devtools.
          return;
        }
        if (currentEvent === "request_id") {
          if (mode === "fresh") {
            const rid = (parsed as { request_id?: string })?.request_id;
            if (typeof rid === "string" && onRequestId && !requestIdNotified) {
              requestIdNotified = true;
              onRequestId(rid);
            }
          }
          return;
        }
        if (currentEvent === "inspector") { if (onInspector) onInspector(parsed as InspectorEvent); return; }
        if (currentEvent === "applied_constraints") { if (onAppliedConstraints) onAppliedConstraints(parsed as AppliedConstraintsEvent); return; }
        if (currentEvent === "proposal") { hasStructuredOutput = true; if (onProposal) onProposal(parsed as ConciergeProposal); return; }
        if (currentEvent === "tool_start") { hasStructuredOutput = true; if (onToolStart) onToolStart(parsed as ToolStartEvent); return; }
        if (currentEvent === "escalation") { hasStructuredOutput = true; if (onEscalation) onEscalation(parsed as EscalationEvent); return; }
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) { partialText += content; onDelta(content); }
      } catch { /* ignore partial / unparseable */ }
    };

    const handleLine = (line: string) => {
      if (line === "") { currentEvent = null; return; }
      if (line.startsWith(":")) {
        // SSE comment. The server tags every frame with `:seq=N` so we
        // can request an exact resume cursor on reconnect.
        const m = /^:seq=(\d+)/.exec(line);
        if (m) {
          const n = Number(m[1]);
          if (Number.isFinite(n) && n > lastSeq) lastSeq = n;
        }
        return;
      }
      if (line.startsWith("event: ")) { currentEvent = line.slice(7).trim(); return; }
      if (!line.startsWith("data: ")) return;
      handleDataPayload(line.slice(6).trim());
    };

    try {
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          handleLine(line);
          if (streamDone) break;
        }
      }
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          handleLine(raw);
        }
      }
    } catch (e) {
      if (signal?.aborted) return { kind: "hard_error", message: "aborted" };
      return { kind: "network_error", message: e instanceof Error ? e.message : "read failed" };
    }

    if (streamDone) return { kind: "done" };
    return { kind: "truncated" };
  };

  let mode: AttemptMode = "fresh";
  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) return;
    const outcome = await runOnce(mode);

    if (outcome.kind === "done") { onDone(); return; }

    if (outcome.kind === "hard_error") {
      if (outcome.message === "aborted") return;
      onError(outcome.message);
      return;
    }

    // CORS/preflight failures never recover on retry — the browser will
    // reject the same headers every time. Surface immediately.
    if (outcome.kind === "network_error" && outcome.message.startsWith("CORS_LIKELY:")) {
      onError(outcome.message);
      return;
    }

    if (outcome.kind === "resume_expired") {
      // Server dropped the frames for this stream_id. Fall through to
      // partial-text continuation on the next attempt.
      streamId = null;
    }

    // truncated | network_error | resume_expired → maybe reconnect.
    // With a resume token we can always safely reconnect (server replays
    // only unseen frames). Without one, stop once structured output has
    // been emitted so we don't duplicate cards.
    const canResume = streamId !== null;
    if (!canResume && hasStructuredOutput) {
      onError(outcome.kind === "truncated" ? "STREAM_TRUNCATED" : (outcome as any).message ?? "STREAM_TRUNCATED");
      return;
    }
    if (attempt >= MAX_ATTEMPTS) {
      onError(outcome.kind === "truncated" ? "STREAM_TRUNCATED" : (outcome as any).message ?? "STREAM_TRUNCATED");
      return;
    }

    const delayMs = backoffMs(attempt);
    if (onReconnect) {
      try {
        onReconnect({
          attempt: attempt + 1,
          maxAttempts: MAX_ATTEMPTS,
          reason: outcome.kind === "truncated" ? "stream_truncated" : outcome.kind === "resume_expired" ? "network_error" : "network_error",
          delayMs,
        });
      } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, delayMs));
    if (signal?.aborted) return;

    if (canResume) {
      mode = "resume";
      // Nothing else to reshape — the resume request already carries
      // { stream_id, last_seq } and the server picks up from the DB.
    } else if (partialText.trim().length > 0) {
      mode = "continuation";
      currentMessages = [
        ...messages,
        { role: "assistant", content: partialText },
        {
          role: "user",
          content:
            "(the previous response was cut off by a dropped connection) Please continue exactly from where you left off. Do not repeat, summarise, or re-introduce anything you already said.",
        },
      ];
    } else {
      mode = "fresh";
      currentMessages = messages;
    }
  }
}

const COMMIT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-concierge-commit`;

export type CommitResult =
  | { ok: true; board_id?: string; quote_id?: string; url: string; added: number; duplicates?: number }
  | { ok: false; error: string };

export async function commitProposal(
  proposal: { tool: string; args: unknown },
  authToken: string,
): Promise<CommitResult> {
  try {
    const resp = await fetch(COMMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(proposal),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, error: data.error || `Error ${resp.status}` };
    return {
      ok: true,
      board_id: data.board_id,
      quote_id: data.quote_id,
      url: data.url,
      added: data.added,
      duplicates: data.duplicates,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
