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
  // Mint a client-side trace id. The edge function honors `x-request-id`
  // when present, so the same id appears in the SSE `event: request_id`
  // frame, every `event: inspector` frame, and the server `concierge_inspector`
  // log line. Displayed in the UI so the user can copy it while debugging.
  const clientRequestId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      "x-request-id": clientRequestId,
      ...(surface === "public" ? { "x-concierge-surface": "public", "x-concierge-sid": publicSid ?? "" } : {}),
    },
    body: JSON.stringify({ messages, project_id: projectId ?? null, surface: surface ?? "trade", lang: lang ?? null }),
    signal,
  });

  if (!resp.ok) {
    let body: any;
    try { body = await resp.json(); } catch { body = { error: "Request failed" }; }
    if (resp.status === 401 || resp.status === 403) {
      onError("UNAUTHORIZED");
      return;
    }
    if (resp.status === 429 && body.retry_in != null) {
      onError(`RATE_LIMIT:${body.retry_in}`);
      return;
    }
    onError(body.error || `Error ${resp.status}`);
    return;
  }

  if (!resp.body) {
    onError("No response stream");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;
  let currentEvent: string | null = null;

  // Notify the caller immediately with the client-minted id so the UI can
  // render the correlation chip even before the server's `event: request_id`
  // frame arrives. The server will echo this exact value.
  if (onRequestId) {
    try { onRequestId(clientRequestId); } catch { /* ignore */ }
  }

  const handleDataPayload = (jsonStr: string) => {
    if (jsonStr === "[DONE]") {
      streamDone = true;
      return;
    }
    try {
      const parsed = JSON.parse(jsonStr);
      if (currentEvent === "request_id") {
        const rid = (parsed as { request_id?: string })?.request_id;
        if (typeof rid === "string" && onRequestId) onRequestId(rid);
        return;
      }
      if (currentEvent === "inspector") {
        if (onInspector) onInspector(parsed as InspectorEvent);
        return;
      }
      if (currentEvent === "applied_constraints") {
        if (onAppliedConstraints) onAppliedConstraints(parsed as AppliedConstraintsEvent);
        return;
      }
      if (currentEvent === "proposal") {
        if (onProposal) onProposal(parsed as ConciergeProposal);
        return;
      }
      if (currentEvent === "tool_start") {
        if (onToolStart) onToolStart(parsed as ToolStartEvent);
        return;
      }
      if (currentEvent === "escalation") {
        if (onEscalation) onEscalation(parsed as EscalationEvent);
        return;
      }
      const content = parsed.choices?.[0]?.delta?.content as string | undefined;
      if (content) onDelta(content);
    } catch {
      /* ignore partial / unparseable */
    }
  };

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);

      if (line === "") {
        // SSE event terminator — reset event name
        currentEvent = null;
        continue;
      }
      if (line.startsWith(":")) continue;

      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith("data: ")) continue;

      handleDataPayload(line.slice(6).trim());
      if (streamDone) break;
    }
  }

  // flush remaining
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith("event: ")) { currentEvent = raw.slice(7).trim(); continue; }
      if (!raw.startsWith("data: ")) continue;
      handleDataPayload(raw.slice(6).trim());
    }
  }

  onDone();
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
