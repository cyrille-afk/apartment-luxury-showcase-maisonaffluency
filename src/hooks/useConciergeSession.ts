// Concierge session — a single localStorage-backed handoff object that carries
// the user's brief, chosen product, and locked finishes across the concierge
// workflow: Brief Builder → 3D finish selection (PickAssetDrawer / Trade
// Product page) → Tearsheet Builder → Quote.
//
// Kept intentionally client-side (no DB) so it works instantly and offline.
// Cross-component sync in the same tab is done via a custom event.

import { useCallback, useEffect, useState } from "react";
import { emitHandoff, type HandoffEvent } from "@/lib/conciergeHandoff";

export type ConciergeSessionProduct = {
  id: string;
  slug?: string | null;
  title: string;
  designer_name?: string | null;
  imageUrl?: string | null;
  source?: "curator" | "trade" | null;
};

export type ConciergeSessionFinishes = {
  fabric: string | null;
  fabricImg: string | null;
  wood: string | null;
  woodImg: string | null;
  variant: string | null;
};

export type ConciergeSession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  briefText: string | null;
  product: ConciergeSessionProduct | null;
  finishes: ConciergeSessionFinishes;
  locked: boolean;
  tearsheetProjectId?: string | null;
  boardId?: string | null;
  quoteId?: string | null;
  /**
   * Server-side stream id from the most recent `trade-concierge` turn.
   * Populated via `useConciergeSession().setStreamId(id)` on the
   * `onStreamStart` callback of `streamConcierge`. Used as the Realtime
   * topic key (`concierge:${streamId}`) for bidirectional handoff.
   */
  streamId?: string | null;
  /**
   * Human-readable project / client-folder name the architect gave to this
   * session (e.g. "Apt 4B"). Set once after the first finish lock; reused
   * across every subsequent tearsheet + Add-to-Project action in the same
   * chat so the AI can say "Add this to the Apt 4B folder as well?".
   */
  projectName?: string | null;
  /**
   * Project city (destination) most recently confirmed with the concierge,
   * parsed from Felix's own city-lock reply / delivery preamble. Used by
   * tearsheet cards to render per-product logistics micro-tags (e.g.
   * "White-Glove Delivery to Singapore in 2 Weeks").
   */
  projectCity?: string | null;
};

const STORAGE_KEY = "concierge:session";
const EVENT_NAME = "concierge:session:changed";

const EMPTY_FINISHES: ConciergeSessionFinishes = {
  fabric: null,
  fabricImg: null,
  wood: null,
  woodImg: null,
  variant: null,
};

function newId(): string {
  try {
    return crypto.randomUUID?.() ?? `cs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  } catch {
    return `cs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function readSession(): ConciergeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConciergeSession>;
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
    return {
      id: parsed.id,
      createdAt: parsed.createdAt ?? Date.now(),
      updatedAt: parsed.updatedAt ?? Date.now(),
      briefText: parsed.briefText ?? null,
      product: parsed.product ?? null,
      finishes: { ...EMPTY_FINISHES, ...(parsed.finishes || {}) },
      locked: !!parsed.locked,
      tearsheetProjectId: parsed.tearsheetProjectId ?? null,
      boardId: parsed.boardId ?? null,
      quoteId: parsed.quoteId ?? null,
      streamId: parsed.streamId ?? null,
      projectName: parsed.projectName ?? null,
      projectCity: parsed.projectCity ?? null,
    };
  } catch {
    return null;
  }
}

function writeSession(next: ConciergeSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore quota / serialization errors
  }
}

function ensureSession(existing: ConciergeSession | null): ConciergeSession {
  const now = Date.now();
  if (existing) return existing;
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    briefText: null,
    product: null,
    finishes: { ...EMPTY_FINISHES },
    locked: false,
    tearsheetProjectId: null,
    boardId: null,
    quoteId: null,
    streamId: null,
    projectName: null,
    projectCity: null,
}

// Module-level mutators — usable from event handlers without needing the hook.
export function updateConciergeSession(
  patch: Partial<Omit<ConciergeSession, "id" | "createdAt">> | ((s: ConciergeSession) => Partial<ConciergeSession>),
): ConciergeSession {
  const current = ensureSession(readSession());
  const delta = typeof patch === "function" ? patch(current) : patch;
  const next: ConciergeSession = {
    ...current,
    ...delta,
    finishes: delta.finishes ? { ...current.finishes, ...delta.finishes } : current.finishes,
    updatedAt: Date.now(),
  };
  writeSession(next);
  return next;
}

export function resetConciergeSession() {
  writeSession(null);
}

export function getConciergeSession(): ConciergeSession | null {
  return readSession();
}

export function useConciergeSession() {
  const [session, setSession] = useState<ConciergeSession | null>(() => readSession());

  useEffect(() => {
    const sync = () => setSession(readSession());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) sync();
    });
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const setBrief = useCallback((briefText: string | null) => {
    const next = updateConciergeSession({ briefText });
    // Bridge onto the Realtime handoff channel so peer tabs / dashboards
    // pick up the locked brief without polling localStorage.
    if (next.streamId && briefText != null) {
      void emitHandoff(next.streamId, "brief_locked", { brief_text_length: briefText.length });
    }
  }, []);

  const setProduct = useCallback((product: ConciergeSessionProduct | null) => {
    const next = updateConciergeSession({ product, locked: false });
    if (next.streamId && product) {
      void emitHandoff(next.streamId, "product_selected", {
        product_id: product.id,
        title: product.title,
        source: product.source ?? null,
      });
    }
  }, []);

  const setFinishes = useCallback((finishes: Partial<ConciergeSessionFinishes>) => {
    updateConciergeSession({ finishes: { ...EMPTY_FINISHES, ...finishes } });
  }, []);

  const lockFinishes = useCallback(() => {
    const next = updateConciergeSession({ locked: true });
    if (next.streamId) {
      void emitHandoff(next.streamId, "finishes_locked", {
        fabric: next.finishes.fabric,
        wood: next.finishes.wood,
        variant: next.finishes.variant,
      });
    }
  }, []);

  const setBoardId = useCallback((boardId: string | null) => {
    updateConciergeSession({ boardId });
  }, []);

  const setQuoteId = useCallback((quoteId: string | null) => {
    updateConciergeSession({ quoteId });
  }, []);

  /**
   * Set/replace the active stream id (from `streamConcierge`'s
   * `onStreamStart` callback). This is what unlocks bidirectional handoff:
   * without a streamId we have no Realtime topic to broadcast on.
   */
  const setStreamId = useCallback((streamId: string | null) => {
    updateConciergeSession({ streamId });
  }, []);

  /**
   * Emit a client-originated handoff event on the current stream. No-op if
   * there is no active streamId — callers can call this unconditionally.
   */
  const emit = useCallback(async (event: HandoffEvent, payload: Record<string, unknown> = {}) => {
    const sid = readSession()?.streamId;
    if (!sid) return { ok: false, error: "no active stream" as const };
    return emitHandoff(sid, event, payload);
  }, []);

  const reset = useCallback(() => {
    resetConciergeSession();
  }, []);

  return {
    session,
    setBrief,
    setProduct,
    setFinishes,
    lockFinishes,
    setBoardId,
    setQuoteId,
    setStreamId,
    emit,
    reset,
  };
}
