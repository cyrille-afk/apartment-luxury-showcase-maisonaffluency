// Streams the AI Curatorial Guide answer as plain text.
// FLASH  -> light reasoning (fast).  FRONTIER -> deep reasoning (slower, more accurate).
// Optional threadId: verifies ownership, replays prior turns, and persists both
// the user turn and the completed (or stopped) assistant turn.
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText, type ModelMessage } from "npm:ai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireUser } from "../_shared/auth.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const RUN_ID = "X-Lovable-AIG-Run-ID";
const HISTORY_TURNS = 20;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID, X-Curatorial-Route",
};
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You are the Maison Affluency Curatorial Guide — a discreet, expert advisor on collectible design, furniture, lighting and finishes for interior designers.
Write in polished British English, concise and specific. Never invent products, designers, prices or lead times; if unsure, say so and suggest the client speak with the Maison Affluency team. Never quote prices — public pricing is "Price upon Request".`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = await requireUser(req, "curatorial-guide-stream");
  if (!auth.ok) return json(auth.body, auth.status);

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const route = body.route === "FLASH" ? "FLASH" : "FRONTIER";
  const threadId = typeof body.threadId === "string" && UUID.test(body.threadId) ? body.threadId : null;
  if (!prompt || prompt.length > 4000) return json({ error: "Invalid prompt" }, 400);
  if (body.threadId && !threadId) return json({ error: "Invalid thread" }, 400);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured" }, 500);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let history: ModelMessage[] = [];
  let isFirstTurn = false;
  if (threadId) {
    const { data: thread, error } = await db
      .from("curation_threads").select("id, user_id").eq("id", threadId).maybeSingle();
    if (error) return json({ error: "Could not load this curation" }, 500);
    if (!thread || thread.user_id !== auth.userId) return json({ error: "Curation not found" }, 404);

    const { data: rows, error: mErr } = await db
      .from("curation_messages").select("role, content")
      .eq("thread_id", threadId).order("created_at", { ascending: false }).limit(HISTORY_TURNS);
    if (mErr) return json({ error: "Could not load this curation" }, 500);
    isFirstTurn = !rows?.length;
    history = (rows ?? []).reverse()
      .filter((r) => r.content?.trim())
      .map((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content }) as ModelMessage);

    const { error: insErr } = await db.from("curation_messages")
      .insert({ thread_id: threadId, user_id: auth.userId, role: "user", content: prompt, route });
    if (insErr) return json({ error: "Could not save your question" }, 500);
  }

  let runId = req.headers.get(RUN_ID)?.trim() || undefined;
  let upstreamError: { status: number; message: string } | null = null;
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID)) headers.set(RUN_ID, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_ID)?.trim() || undefined;
      if (!res.ok) {
        const text = await res.clone().text().catch(() => "");
        let message = text.slice(0, 300);
        try { const p = JSON.parse(text); message = p?.error?.message ?? p?.message ?? message; } catch { /* keep */ }
        upstreamError = { status: res.status, message };
      }
      return res;
    },
  });

  const userTurn = route === "FLASH" ? `${prompt}\n\nAnswer briefly (under 120 words).` : prompt;
  const result = streamText({
    model: provider.responses(MODEL),
    system: SYSTEM,
    messages: [...history, { role: "user", content: userTurn }],
    abortSignal: req.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: route === "FLASH" ? "low" : "high",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const persist = async (answer: string) => {
    if (!threadId) return;
    if (answer.trim()) {
      const { error } = await db.from("curation_messages")
        .insert({ thread_id: threadId, user_id: auth.userId, role: "assistant", content: answer, route });
      if (error) console.error("persist assistant failed", error.message);
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (isFirstTurn) patch.title = prompt.length > 60 ? `${prompt.slice(0, 57).trimEnd()}…` : prompt;
    const { error } = await db.from("curation_threads").update(patch).eq("id", threadId);
    if (error) console.error("touch thread failed", error.message);
  };

  // Peek the first chunk so upstream 4xx/5xx surface with their real status.
  const reader = result.textStream.getReader();
  let first: ReadableStreamReadResult<string>;
  try {
    first = await reader.read();
  } catch (e) {
    await persist("");
    if (req.signal.aborted) return new Response(null, { status: 499, headers: cors });
    const err = upstreamError as { status: number; message: string } | null;
    return json({ error: err?.message || (e as Error).message || "AI request failed" }, err?.status ?? 500);
  }
  if (first.done && upstreamError) {
    await persist("");
    const err = upstreamError as { status: number; message: string };
    return json({ error: err.message }, err.status);
  }

  const enc = new TextEncoder();
  let answer = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done && first.value) { answer += first.value; controller.enqueue(enc.encode(first.value)); }
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          answer += value;
          controller.enqueue(enc.encode(value));
        }
        controller.close();
      } catch (e) {
        if (!req.signal.aborted) controller.error(e);
      } finally {
        await persist(answer);
      }
    },
    cancel() { reader.cancel().catch(() => {}); },
  });

  const headers = new Headers({ ...cors, "Content-Type": "text/plain; charset=utf-8", "X-Curatorial-Route": route });
  if (runId) headers.set(RUN_ID, runId);
  return new Response(stream, { headers });
});
