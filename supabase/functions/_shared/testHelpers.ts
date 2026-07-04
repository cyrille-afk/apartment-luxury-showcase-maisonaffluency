// Shared helpers for concierge SSE test suites.

/**
 * Consume an SSE stream from an edge function response and return the
 * concatenated assistant text (delta.content), plus any parsed proposal /
 * escalation events. Mirrors the client parser in
 * `src/lib/tradeConciergeStream.ts` closely enough to verify catalog output.
 */
export async function readConciergeStream(
  resp: Response,
  opts: { timeoutMs?: number } = {},
): Promise<{
  text: string;
  proposals: unknown[];
  escalations: unknown[];
  requestIds: string[];
  inspectorEvents: Array<{ ok?: boolean; corrections?: unknown[]; ms?: number; request_id?: string; discovery?: boolean }>;
  discoveryGuardEvents: Array<{ removed?: string[]; ms?: number; request_id?: string }>;
  hardFallbackEvents: Array<{ source?: string; reason?: string; removed?: string[]; safe_fallback?: boolean; request_id?: string }>;
}> {
  const empty = { text: "", proposals: [], escalations: [], requestIds: [], inspectorEvents: [], discoveryGuardEvents: [], hardFallbackEvents: [] };
  if (!resp.body) return empty;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const proposals: unknown[] = [];
  const escalations: unknown[] = [];
  const requestIds: string[] = [];
  const inspectorEvents: Array<{ ok?: boolean; corrections?: unknown[]; ms?: number; request_id?: string; discovery?: boolean }> = [];
  const discoveryGuardEvents: Array<{ removed?: string[]; ms?: number; request_id?: string }> = [];
  const hardFallbackEvents: Array<{ source?: string; reason?: string; removed?: string[]; safe_fallback?: boolean; request_id?: string }> = [];
  let currentEvent: string | null = null;
  const started = Date.now();

  const snapshot = () => ({ text, proposals, escalations, requestIds, inspectorEvents, discoveryGuardEvents, hardFallbackEvents });

  const handle = (jsonStr: string) => {
    if (jsonStr === "[DONE]") return "done";
    try {
      const parsed = JSON.parse(jsonStr);
      if (currentEvent === "proposal") { proposals.push(parsed); return; }
      if (currentEvent === "escalation") { escalations.push(parsed); return; }
      if (currentEvent === "request_id") {
        // deno-lint-ignore no-explicit-any
        const rid = (parsed as any)?.request_id;
        if (typeof rid === "string") requestIds.push(rid);
        return;
      }
      if (currentEvent === "inspector") {
        // deno-lint-ignore no-explicit-any
        inspectorEvents.push(parsed as any);
        return;
      }
      if (currentEvent === "discovery_guard") {
        // deno-lint-ignore no-explicit-any
        discoveryGuardEvents.push(parsed as any);
        return;
      }
      if (currentEvent === "hard_fallback") {
        // deno-lint-ignore no-explicit-any
        hardFallbackEvents.push(parsed as any);
        return;
      }
      // deno-lint-ignore no-explicit-any
      const content = (parsed as any).choices?.[0]?.delta?.content;
      if (typeof content === "string") text += content;
    } catch { /* ignore partial chunks */ }
  };

  while (true) {
    if (Date.now() - started > timeoutMs) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new Error(`SSE read exceeded ${timeoutMs}ms`);
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line === "") { currentEvent = null; continue; }
      if (line.startsWith(":")) continue;
      if (line.startsWith("event: ")) { currentEvent = line.slice(7).trim(); continue; }
      if (!line.startsWith("data: ")) continue;
      if (handle(line.slice(6).trim()) === "done") {
        try { await reader.cancel(); } catch { /* ignore */ }
        return snapshot();
      }
    }
  }
  return snapshot();
}


/** Case-insensitive substring match on the accumulated stream text. */
export function streamContainsAny(haystack: string, needles: string[]): string | null {
  const hay = haystack.toLowerCase();
  for (const n of needles) {
    if (n && hay.includes(n.toLowerCase())) return n;
  }
  return null;
}
