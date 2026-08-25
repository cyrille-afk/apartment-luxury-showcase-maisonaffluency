// Bidirectional Realtime handoff channel for the trade concierge.
//
// Complements the SSE stream from `trade-concierge` with a Supabase Realtime
// channel keyed by the same `stream_id`. This gives us three things the
// unidirectional SSE alone cannot:
//
//   1. Multi-tab observability — a second tab (e.g. the trade dashboard) can
//      subscribe to `concierge:${streamId}` and react to `proposal_ready`,
//      `escalation_ready`, `stream_completed` without holding its own SSE
//      connection.
//   2. Client -> server -> broadcast — the browser can post lightweight
//      state changes (brief locked, product selected, finishes locked,
//      proposal dismissed) via `trade-concierge-handoff`, which persists an
//      audit row AND re-broadcasts on the same channel so peer tabs see it.
//   3. Late-joiner correctness — since broadcast is fire-and-forget, only
//      persisted state (via the audit table + `brief_drafts`) survives a
//      refresh. Realtime is the low-latency courier; the DB is truth.
//
// The public concierge surface intentionally does NOT use this channel:
// anonymous visitors have no owned stream session and no audit surface, so
// there's nothing to bridge across tabs.

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const HANDOFF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-concierge-handoff`;

export type HandoffEvent =
  | "brief_locked"
  | "product_selected"
  | "finishes_locked"
  | "proposal_dismissed"
  | "tearsheet_opened";

/** Events the *server* broadcasts on the same topic (see `_resume.ts`). */
export type HandoffServerEvent =
  | "stream_started"
  | "proposal_ready"
  | "escalation_ready"
  | "tool_start_ready"
  | "stream_completed";

export type HandoffFrame = {
  event: HandoffEvent | HandoffServerEvent | string;
  payload: Record<string, unknown>;
};

export type HandoffHandlers = {
  /** Fired on every broadcast (both server- and peer-originated). */
  onEvent?: (frame: HandoffFrame) => void;
  /** Convenience: filter to a specific event kind. */
  onProposalReady?: (payload: Record<string, unknown>) => void;
  onStreamCompleted?: (payload: Record<string, unknown>) => void;
  onBriefLocked?: (payload: Record<string, unknown>) => void;
  onProductSelected?: (payload: Record<string, unknown>) => void;
  onFinishesLocked?: (payload: Record<string, unknown>) => void;
};

/**
 * Subscribe to `concierge:${streamId}` and dispatch every broadcast to the
 * provided handlers. Returns a disposer that removes the channel.
 *
 * Safe to call multiple times for the same streamId; each invocation opens
 * an independent subscription, so callers should keep the returned disposer
 * and invoke it on cleanup (e.g. useEffect return).
 */
export function openHandoffChannel(
  streamId: string,
  handlers: HandoffHandlers = {},
): () => void {
  if (!streamId) return () => {};
  const topic = `concierge:${streamId}`;
  const channel: RealtimeChannel = supabase.channel(topic, {
    config: { private: true, broadcast: { self: false, ack: false } },
  });

  channel.on("broadcast", { event: "*" }, ({ event, payload }) => {
    const frame: HandoffFrame = { event, payload: (payload as Record<string, unknown>) ?? {} };
    try { handlers.onEvent?.(frame); } catch { /* handler errors are non-fatal */ }
    switch (event) {
      case "proposal_ready":     try { handlers.onProposalReady?.(frame.payload); } catch { /* ignore */ } break;
      case "stream_completed":   try { handlers.onStreamCompleted?.(frame.payload); } catch { /* ignore */ } break;
      case "brief_locked":       try { handlers.onBriefLocked?.(frame.payload); } catch { /* ignore */ } break;
      case "product_selected":   try { handlers.onProductSelected?.(frame.payload); } catch { /* ignore */ } break;
      case "finishes_locked":    try { handlers.onFinishesLocked?.(frame.payload); } catch { /* ignore */ } break;
    }
  });

  channel.subscribe();
  return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
}

/**
 * POST a client-originated handoff event to `trade-concierge-handoff`. The
 * server verifies ownership of `streamId`, persists an audit row, and
 * re-broadcasts on `concierge:${streamId}` so peer subscribers observe it.
 *
 * Returns `{ ok }` — callers can generally fire-and-forget. Errors are
 * logged but not thrown, because handoff is an opportunistic side-channel;
 * losing it must not break the primary tearsheet / quote path.
 */
export async function emitHandoff(
  streamId: string,
  event: HandoffEvent,
  payload: Record<string, unknown> = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!streamId) return { ok: false, error: "missing stream_id" };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "not signed in" };
    const resp = await fetch(HANDOFF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify({ stream_id: streamId, event, payload }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.warn("[handoff] emit failed:", resp.status, body);
      return { ok: false, error: `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    console.warn("[handoff] emit threw:", msg);
    return { ok: false, error: msg };
  }
}
