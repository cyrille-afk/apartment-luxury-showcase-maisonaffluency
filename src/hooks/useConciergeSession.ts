// Concierge session — a single localStorage-backed handoff object that carries
// the user's brief, chosen product, and locked finishes across the concierge
// workflow: Brief Builder → 3D finish selection (PickAssetDrawer / Trade
// Product page) → Tearsheet Builder → Quote.
//
// Kept intentionally client-side (no DB) so it works instantly and offline.
// Cross-component sync in the same tab is done via a custom event.

import { useCallback, useEffect, useState } from "react";

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
  };
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
    updateConciergeSession({ briefText });
  }, []);

  const setProduct = useCallback((product: ConciergeSessionProduct | null) => {
    updateConciergeSession({ product, locked: false });
  }, []);

  const setFinishes = useCallback((finishes: Partial<ConciergeSessionFinishes>) => {
    updateConciergeSession({ finishes: { ...EMPTY_FINISHES, ...finishes } });
  }, []);

  const lockFinishes = useCallback(() => {
    updateConciergeSession({ locked: true });
  }, []);

  const setBoardId = useCallback((boardId: string | null) => {
    updateConciergeSession({ boardId });
  }, []);

  const setQuoteId = useCallback((quoteId: string | null) => {
    updateConciergeSession({ quoteId });
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
    reset,
  };
}
