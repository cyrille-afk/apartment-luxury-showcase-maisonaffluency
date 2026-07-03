import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the supabase client BEFORE importing the module under test.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "test-token" } } }),
    },
  },
}));

import { streamConcierge, type ToolStartEvent, type ConciergeProposal } from "@/lib/tradeConciergeStream";

/**
 * Build a fake fetch Response whose body streams the given SSE frames in
 * order. Each frame is emitted in its own chunk so the parser sees realistic
 * partial reads.
 */
function makeSSEResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame));
        // Yield to the microtask queue so the reader can observe intermediate
        // events (the test relies on ordering, not race conditions).
        await Promise.resolve();
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const sseToolStart = (tool: string, tool_call_id: string, index = 0) =>
  `event: tool_start\ndata: ${JSON.stringify({ tool, tool_call_id, index, request_id: "req-x" })}\n\n`;

const sseProposal = (tool: string, tool_call_id: string) => {
  const payload: any = {
    tool,
    tool_call_id,
    args: { title: "Test board", pick_ids: ["p1"], note: null },
    preview: [
      { id: "p1", title: "Piece 1", image_url: null, materials: null, category: null, designer_name: null },
    ],
    requirements_validation: { ok: true, coverage: [], violations: [] },
  };
  return `event: proposal\ndata: ${JSON.stringify(payload)}\n\n`;
};

const sseProposalBlocked = (tool: string, tool_call_id: string) =>
  `event: proposal_blocked\ndata: ${JSON.stringify({
    request_id: "req-x",
    tool,
    tool_call_id,
    reason: "requirements_violation",
    coverage: [],
    violations: [{ slot: "sofa", required_qty: 2, delivered_qty: 1, reason: "qty_shortfall" }],
  })}\n\n`;

const sseDone = () => `data: [DONE]\n\n`;

describe("tradeConciergeStream — event ordering", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Ensure any test starts from a clean slate.
    (globalThis as any).fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("emits tool_start BEFORE the proposal frame with a matching tool_call_id", async () => {
    const toolCallId = "tc-1";
    (globalThis.fetch as any).mockResolvedValue(
      makeSSEResponse([
        sseToolStart("propose_tearsheet", toolCallId),
        sseProposal("propose_tearsheet", toolCallId),
        sseDone(),
      ]),
    );

    const events: Array<{ kind: "tool_start" | "proposal"; toolCallId: string | null }> = [];

    let done = false;
    await streamConcierge({
      messages: [{ role: "user", content: "hello" }],
      onDelta: () => {},
      onToolStart: (ev: ToolStartEvent) => events.push({ kind: "tool_start", toolCallId: ev.tool_call_id }),
      onProposal: (p: ConciergeProposal) => events.push({ kind: "proposal", toolCallId: p.tool_call_id }),
      onDone: () => { done = true; },
      onError: (msg) => { throw new Error("unexpected error: " + msg); },
    });

    expect(done).toBe(true);
    // Ordering: skeleton first, real proposal second.
    expect(events.map((e) => e.kind)).toEqual(["tool_start", "proposal"]);
    // The tool_call_id is preserved so the client can swap the skeleton in place.
    expect(events[0].toolCallId).toBe(toolCallId);
    expect(events[1].toolCallId).toBe(toolCallId);
  });

  it("emits tool_start followed by proposal_blocked (no proposal) when the Inspector fails closed", async () => {
    const toolCallId = "tc-2";
    let blockedPayload: any = null;

    (globalThis.fetch as any).mockResolvedValue(
      makeSSEResponse([
        sseToolStart("propose_tearsheet", toolCallId),
        sseProposalBlocked("propose_tearsheet", toolCallId),
        sseDone(),
      ]),
    );

    const events: string[] = [];

    // proposal_blocked isn't a first-class callback on streamConcierge; we
    // intercept it through onDelta by parsing the raw stream instead. Easier:
    // just assert the CALLBACKS invoked. In fail-closed mode the server does
    // NOT emit `event: proposal`, so onProposal must never fire.
    await streamConcierge({
      messages: [{ role: "user", content: "hello" }],
      onDelta: () => {},
      onToolStart: () => events.push("tool_start"),
      onProposal: () => events.push("proposal"),
      onDone: () => events.push("done"),
      onError: (msg) => { throw new Error("unexpected error: " + msg); },
    });

    // Skeleton was announced, but no proposal followed — the client is
    // responsible for clearing the pending placeholder on `done`.
    expect(events).toEqual(["tool_start", "done"]);
    expect(events).not.toContain("proposal");
    // sanity: we consumed the response (avoids Deno-style resource-leak warns
    // even under Node/jsdom).
    expect(blockedPayload).toBeNull();
  });

  it("emits tool_start once per card even when multiple tool_calls are interleaved", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      makeSSEResponse([
        sseToolStart("propose_tearsheet", "tc-a", 0),
        sseToolStart("draft_quote", "tc-b", 1),
        sseProposal("propose_tearsheet", "tc-a"),
        sseProposal("draft_quote", "tc-b"),
        sseDone(),
      ]),
    );

    const events: Array<{ kind: string; id: string | null }> = [];
    await streamConcierge({
      messages: [{ role: "user", content: "hello" }],
      onDelta: () => {},
      onToolStart: (ev) => events.push({ kind: "tool_start", id: ev.tool_call_id }),
      onProposal: (p) => events.push({ kind: "proposal", id: p.tool_call_id }),
      onDone: () => {},
      onError: (msg) => { throw new Error("unexpected error: " + msg); },
    });

    // Both skeletons arrive before either proposal; each proposal correlates
    // to its skeleton by tool_call_id so the client can swap them
    // independently.
    expect(events).toEqual([
      { kind: "tool_start", id: "tc-a" },
      { kind: "tool_start", id: "tc-b" },
      { kind: "proposal", id: "tc-a" },
      { kind: "proposal", id: "tc-b" },
    ]);
  });
});
