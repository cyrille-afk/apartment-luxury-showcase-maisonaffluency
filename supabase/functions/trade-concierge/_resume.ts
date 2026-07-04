// Resume-token support for the trade-concierge SSE stream.
//
// Wire protocol
// -------------
// * On every new POST the server mints a `stream_id` (UUID), inserts a
//   `concierge_stream_sessions` row, and emits an SSE frame:
//       event: stream_start
//       data: {"stream_id":"<uuid>"}
// * Every subsequent SSE chunk is prefixed with a comment line
//       :seq=<n>
//   which standard SSE parsers ignore, and the raw chunk bytes are
//   persisted into `concierge_stream_frames` with the same monotonic seq.
// * The client tracks the highest `seq` it has observed. If the stream
//   drops mid-turn it re-POSTs with body
//       { resume: { stream_id, last_seq } }
//   and the server replays every persisted frame whose seq > last_seq,
//   waiting for new frames if the original run is still in progress, and
//   terminating with `data: [DONE]` once the session is marked complete.
//
// The edge function isolate is stateless across HTTP invocations, so
// "resume" is implemented via DB polling rather than IPC. The original
// isolate keeps writing frame rows even after the client disconnects (up
// until the runtime GCs the request), so the odds of a clean resume are
// high — and when they aren't, the client falls back to the partial-text
// continuation path that already exists in `src/lib/tradeConciergeStream`.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type SupaClient = ReturnType<typeof createClient>;

const encoder = new TextEncoder();

/**
 * Wraps a stream controller so every enqueue is
 *   1. tagged with an SSE `:seq=N` comment on the wire
 *   2. persisted to `concierge_stream_frames` (best-effort, batched)
 * and creates a matching `concierge_stream_sessions` row.
 *
 * Returns the stream_id and a `finalize(status)` hook the caller must
 * invoke in its `finally` block.
 */
export function installFramePersistence(opts: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  supabase: SupaClient;
  userId: string;
  requestId: string;
  surface: string;
}): { streamId: string; finalize: (status: "complete" | "error") => Promise<void> } {
  const { controller, supabase, userId, requestId, surface } = opts;
  const streamId = (crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let seq = 0;
  let pending: Array<{ seq: number; chunk: string }> = [];
  let flushing = false;

  // Fire-and-forget session insert; if it fails resume simply won't work
  // for this turn — the live stream still functions.
  supabase
    .from("concierge_stream_sessions")
    .insert({
      stream_id: streamId,
      user_id: userId,
      request_id: requestId,
      surface,
      status: "in_progress",
    })
    .then(({ error }: any) => {
      if (error) console.warn("[concierge resume] session insert failed:", error.message);
    });

  const flush = async () => {
    if (flushing || pending.length === 0) return;
    flushing = true;
    const batch = pending;
    pending = [];
    try {
      const { error } = await supabase
        .from("concierge_stream_frames")
        .insert(batch.map((b) => ({ stream_id: streamId, seq: b.seq, chunk: b.chunk })));
      if (error) console.warn("[concierge resume] frame insert failed:", error.message);
    } catch (e) {
      console.warn("[concierge resume] frame insert threw:", e instanceof Error ? e.message : e);
    } finally {
      flushing = false;
      if (pending.length > 0) void flush();
    }
  };

  // Wrap enqueue.
  const rawEnqueue = (controller as any).enqueue.bind(controller);
  (controller as any).enqueue = (chunk: Uint8Array) => {
    seq += 1;
    const asText = new TextDecoder().decode(chunk);
    // Prefix the wire chunk with the SSE seq comment. Comments (lines
    // starting with ':') are ignored by every conformant SSE parser.
    const tagged = encoder.encode(`:seq=${seq}\n` + asText);
    try {
      rawEnqueue(tagged);
    } catch (e) {
      // Client is gone; keep persisting frames so a reconnect can replay.
      console.warn("[concierge resume] client stream write failed:", e instanceof Error ? e.message : e);
    }
    pending.push({ seq, chunk: asText });
    // Batch inserts into ~150ms windows so we don't overwhelm PG on chatty
    // token streams. Small enough that a fast reconnect still finds recent
    // frames on disk.
    if (pending.length === 1) {
      setTimeout(() => { void flush(); }, 150);
    } else if (pending.length >= 64) {
      void flush();
    }
  };

  // Emit stream_start immediately — this is seq=1 and gives the client the
  // resume token before any other event.
  (controller as any).enqueue(encoder.encode(
    `event: stream_start\ndata: ${JSON.stringify({ stream_id: streamId })}\n\n`,
  ));

  const finalize = async (status: "complete" | "error") => {
    // Ensure all pending frames are on disk before flipping status; the
    // replay poller uses status='complete' as the terminal signal.
    try {
      // Force final flush and wait for any in-flight one to settle.
      for (let i = 0; i < 20 && (pending.length > 0 || flushing); i++) {
        await flush();
        if (flushing) await new Promise((r) => setTimeout(r, 25));
      }
    } catch { /* ignore */ }
    try {
      await supabase
        .from("concierge_stream_sessions")
        .update({ status, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("stream_id", streamId);
    } catch (e) {
      console.warn("[concierge resume] session finalize failed:", e instanceof Error ? e.message : e);
    }
  };

  return { streamId, finalize };
}

/**
 * Serves a resume request. Streams every frame with seq > lastSeq for the
 * given stream_id (verifying the requester owns it), polling for new rows
 * if the original run is still `in_progress`, then closes with
 * `data: [DONE]`.
 *
 * Returns a Response on success, or `null` if the stream_id is unknown /
 * expired / not owned by this user — the caller should then return a 410
 * so the client falls back to its partial-text continuation.
 */
export async function serveResume(opts: {
  supabase: SupaClient;
  userId: string;
  streamId: string;
  lastSeq: number;
  corsHeaders: Record<string, string>;
}): Promise<Response | null> {
  const { supabase, userId, streamId, lastSeq, corsHeaders } = opts;

  // Best-effort TTL purge — never blocks the resume path.
  supabase.rpc("purge_stale_concierge_streams").then(({ error }: any) => {
    if (error) console.warn("[concierge resume] purge rpc failed:", error.message);
  });

  const { data: session, error: sessErr } = await supabase
    .from("concierge_stream_sessions")
    .select("stream_id, user_id, status")
    .eq("stream_id", streamId)
    .maybeSingle();
  if (sessErr) {
    console.warn("[concierge resume] session lookup failed:", sessErr.message);
    return null;
  }
  if (!session || session.user_id !== userId) return null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let cursor = Number.isFinite(lastSeq) ? Math.max(0, Math.floor(lastSeq)) : 0;
      const started = Date.now();
      const MAX_MS = 55_000;   // stay under 60s edge-function ceiling
      const POLL_MS = 400;

      // Announce that we're resuming so the client can distinguish it from
      // a fresh turn in the timeline debug view.
      controller.enqueue(enc.encode(
        `event: stream_resume\ndata: ${JSON.stringify({ stream_id: streamId, from_seq: cursor })}\n\n`,
      ));

      // deno-lint-ignore no-explicit-any
      let status: string = (session as any).status ?? "in_progress";

      while (true) {
        const { data: rows, error } = await supabase
          .from("concierge_stream_frames")
          .select("seq, chunk")
          .eq("stream_id", streamId)
          .gt("seq", cursor)
          .order("seq", { ascending: true })
          .limit(500);
        if (error) {
          controller.enqueue(enc.encode(`event: resume_error\ndata: ${JSON.stringify({ error: error.message })}\n\n`));
          break;
        }
        if (rows && rows.length > 0) {
          for (const row of rows as Array<{ seq: number; chunk: string }>) {
            // Re-tag with the seq comment so the client's tracker stays in
            // sync (the DB row already stores the raw chunk without the tag).
            controller.enqueue(enc.encode(`:seq=${row.seq}\n` + row.chunk));
            cursor = row.seq;
          }
        }
        if (status === "complete" || status === "error") {
          controller.enqueue(enc.encode(`data: [DONE]\n\n`));
          break;
        }
        if (Date.now() - started > MAX_MS) {
          controller.enqueue(enc.encode(
            `event: resume_timeout\ndata: ${JSON.stringify({ last_seq: cursor })}\n\n`,
          ));
          break;
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
        // Re-check status for termination.
        const { data: s2 } = await supabase
          .from("concierge_stream_sessions")
          .select("status")
          .eq("stream_id", streamId)
          .maybeSingle();
        // deno-lint-ignore no-explicit-any
        if (s2 && (s2 as any).status) status = (s2 as any).status;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}
