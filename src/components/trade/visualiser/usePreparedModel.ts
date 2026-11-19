import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Retain the committed resource during same-piece updates, never during a swap. */
export function usePreparedModel<T>(identity: string, configuration: string, prepare: (signal: AbortSignal) => Promise<T>, dispose: (model: T) => void) {
  const [prepared, setPrepared] = useState<{ identity: string; model: T } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const active = useRef<T | null>(null);
  const model = prepared?.identity === identity ? prepared.model : null;
  useLayoutEffect(() => {
    active.current = model;
    return () => { active.current = null; };
  }, [model]);
  useEffect(() => {
    if (!prepared) return;
    const previous = prepared.model;
    // Run after React detaches the primitive; StrictMode's replay keeps it active.
    return () => queueMicrotask(() => { if (active.current !== previous) dispose(previous); });
  }, [prepared, dispose]);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void prepare(controller.signal).then(next => {
      if (controller.signal.aborted) { dispose(next); return; }
      setPrepared({ identity, model: next });
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error("The furniture could not be prepared."));
    });
    return () => controller.abort();
  }, [identity, configuration, prepare, dispose]);
  if (error) throw error;
  return model;
}