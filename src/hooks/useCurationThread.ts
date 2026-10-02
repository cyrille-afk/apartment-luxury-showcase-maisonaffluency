import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { classifyWithBudget, type CuratorialRoute } from "@/hooks/useCuratorialRouter";

export interface CurationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  route: CuratorialRoute | null;
}
export type ThreadPhase = "loading" | "idle" | "routing" | "streaming" | "error";

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/curatorial-guide-stream`;

/**
 * Thread-scoped Curatorial Guide state. Isolated from cart/global stores;
 * stream chunks are batched per animation frame. The server persists turns.
 */
export function useCurationThread(threadId: string | undefined, onTurnSaved?: () => void) {
  const [messages, setMessages] = useState<CurationMessage[]>([]);
  const [phase, setPhase] = useState<ThreadPhase>("loading");
  const [route, setRoute] = useState<CuratorialRoute | null>(null);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const savedRef = useRef(onTurnSaved);
  savedRef.current = onTurnSaved;

  useEffect(() => {
    let cancelled = false;
    const prev = abortRef.current;
    abortRef.current = null; // mark old stream as superseded so it can't touch the new thread's state
    prev?.abort();
    setMessages([]); setError(null); setRoute(null);
    setLoadedFor(undefined);
    if (!threadId) { setPhase("idle"); return; }
    setPhase("loading");
    supabase.from("curation_messages").select("id, role, content, route")
      .eq("thread_id", threadId).order("created_at", { ascending: true })
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) { setError("Could not load this curation."); setPhase("error"); return; }
        setMessages((data ?? []).map((r) => ({
          id: r.id, role: r.role === "assistant" ? "assistant" : "user", content: r.content,
          route: r.route === "FLASH" || r.route === "FRONTIER" ? r.route : null,
        })));
        setPhase("idle");
        setLoadedFor(threadId);
      });
    return () => { cancelled = true; };
  }, [threadId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  const send = useCallback(async (raw: string, targetThreadId = threadId) => {
    const prompt = raw.trim();
    if (!prompt || !targetThreadId) return;
    const prior = abortRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    prior?.abort();
    setError(null);
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: prompt, route: null }]);
    setPhase("routing");

    const decision = await classifyWithBudget(prompt);
    if (controller.signal.aborted) { if (abortRef.current === controller) setPhase("idle"); return; }
    setRoute(decision.route); setFallback(decision.fallback);
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "", route: decision.route }]);
    setPhase("streaming");

    let buffer = ""; let frame = 0;
    const flush = () => {
      frame = 0;
      if (!buffer) return;
      const chunk = buffer; buffer = "";
      setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: x.content + chunk } : x)));
    };
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please sign in again to continue.");
      const res = await fetch(FN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, route: decision.route, threadId: targetThreadId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `The guide is unavailable (${res.status}).`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        if (!frame) frame = requestAnimationFrame(flush);
      }
      if (frame) cancelAnimationFrame(frame);
      flush();
      setPhase("idle");
    } catch (e) {
      if (frame) cancelAnimationFrame(frame);
      if (controller.signal.aborted) {
        if (abortRef.current === controller) { flush(); setPhase("idle"); }
      }
      else {
        setMessages((m) => m.filter((x) => !(x.id === assistantId && !x.content)));
        setError((e as Error).message || "Something went wrong.");
        setPhase("error");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      savedRef.current?.();
    }
  }, [threadId]);

  return { loadedFor, messages, phase, route, fallback, error, send, stop, busy: phase === "routing" || phase === "streaming" };
}
