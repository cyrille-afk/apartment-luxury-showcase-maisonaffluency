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
};

export type ConciergeProposal = TearsheetProposal | QuoteProposal | FfeProposal;

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

export async function streamConcierge({
  messages,
  projectId,
  surface,
  onDelta,
  onProposal,
  onEscalation,
  onDone,
  onError,
  signal,
}: {
  messages: ChatMessage[];
  /** Active trade project id (from session storage / URL) — gives the agent project + studio context. */
  projectId?: string | null;
  /** "public" for anon /concierge visitors; "trade" (default) for signed-in trade users. */
  surface?: "public" | "trade";
  onDelta: (text: string) => void;
  onProposal?: (proposal: ConciergeProposal) => void;
  onEscalation?: (event: EscalationEvent) => void;
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
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      ...(surface === "public" ? { "x-concierge-surface": "public", "x-concierge-sid": publicSid ?? "" } : {}),
    },
    body: JSON.stringify({ messages, project_id: projectId ?? null, surface: surface ?? "trade" }),
    signal,
  });

  if (!resp.ok) {
    let body: any;
    try { body = await resp.json(); } catch { body = { error: "Request failed" }; }
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

  const handleDataPayload = (jsonStr: string) => {
    if (jsonStr === "[DONE]") {
      streamDone = true;
      return;
    }
    try {
      const parsed = JSON.parse(jsonStr);
      if (currentEvent === "proposal") {
        if (onProposal) onProposal(parsed as ConciergeProposal);
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
