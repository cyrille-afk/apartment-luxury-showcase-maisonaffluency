import { useCallback, useEffect, useReducer, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CuratorialRoute = "FLASH" | "FRONTIER";
export type RouterPhase = "idle" | "routing" | "streaming" | "done" | "error";

export const ROUTING_BUDGET_MS = 800;

interface State {
  phase: RouterPhase;
  route: CuratorialRoute | null;
  /** True when the 800ms budget or a failure forced FRONTIER. */
  fallback: boolean;
  text: string;
  error: string | null;
}

type Action =
  | { type: "start" }
  | { type: "routed"; route: CuratorialRoute; fallback: boolean }
  | { type: "chunk"; text: string }
  | { type: "done" }
  | { type: "error"; error: string }
  | { type: "reset" };

const initial: State = { phase: "idle", route: null, fallback: false, text: "", error: null };

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "start": return { ...initial, phase: "routing" };
    case "routed": return { ...state, phase: "streaming", route: a.route, fallback: a.fallback };
    case "chunk": return { ...state, text: state.text + a.text };
    case "done": return { ...state, phase: "done" };
    case "error": return { ...state, phase: "error", error: a.error };
    case "reset": return initial;
  }
}

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in to use the Curatorial Guide.");
  return {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Classify with a strict 800ms budget. Any timeout, network error, non-2xx
 * or malformed reply resolves to FRONTIER to protect accuracy.
 */
export async function classifyWithBudget(
  prompt: string,
  budgetMs = ROUTING_BUDGET_MS,
): Promise<{ route: CuratorialRoute; fallback: boolean }> {
  const fallback = { route: "FRONTIER" as const, fallback: true };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<typeof fallback>((resolve) => {
      timer = setTimeout(() => { controller.abort(); resolve(fallback); }, budgetMs);
    });
    const call = (async () => {
      const res = await fetch(`${FN_BASE}/curatorial-route`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      if (!res.ok) return fallback;
      const data = await res.json();
      if (data?.route === "FLASH") return { route: "FLASH" as const, fallback: false };
      return { route: "FRONTIER" as const, fallback: Boolean(data?.fallback) };
    })();
    return await Promise.race([call, timeout]);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Isolated state handler: its own reducer, no global/cart store access, and
 * streamed chunks are batched per animation frame so long answers never
 * monopolise the main thread.
 */
export function useCuratorialRouter() {
  const [state, dispatch] = useReducer(reducer, initial);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const ask = useCallback(async (rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    if (!prompt) return;
    stop();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "start" });

    const { route, fallback } = await classifyWithBudget(prompt);
    if (controller.signal.aborted) return;
    dispatch({ type: "routed", route, fallback });

    let buffer = "";
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (buffer) { dispatch({ type: "chunk", text: buffer }); buffer = ""; }
    };

    try {
      const res = await fetch(`${FN_BASE}/curatorial-guide-stream`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ prompt, route }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `The guide is unavailable (${res.status}).`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!frame) frame = requestAnimationFrame(flush);
      }
      if (frame) cancelAnimationFrame(frame);
      flush();
      dispatch({ type: "done" });
    } catch (e) {
      if (frame) cancelAnimationFrame(frame);
      if (controller.signal.aborted) { flush(); dispatch({ type: "done" }); return; }
      flush();
      dispatch({ type: "error", error: (e as Error).message || "Something went wrong." });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [stop]);

  const reset = useCallback(() => { stop(); dispatch({ type: "reset" }); }, [stop]);

  return { ...state, ask, stop, reset, busy: state.phase === "routing" || state.phase === "streaming" };
}
