// Shared helper: log a Lovable AI Gateway call to ai_usage_events.
// Fire-and-forget — never throws. Import and call after every AI response.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Estimated USD per 1M tokens (input / output). Update when Lovable pricing changes.
// Image models are billed as a flat per-image cost recorded in `flatPerCall`.
const MODEL_PRICING: Record<
  string,
  { in?: number; out?: number; flatPerCall?: number }
> = {
  "google/gemini-3-flash-preview": { in: 0.075, out: 0.3 },
  "google/gemini-3.5-flash": { in: 0.1, out: 0.4 },
  "google/gemini-3.1-flash-lite-preview": { in: 0.05, out: 0.2 },
  "google/gemini-3.1-pro-preview": { in: 1.25, out: 5 },
  "google/gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "google/gemini-2.5-flash-lite": { in: 0.04, out: 0.15 },
  "google/gemini-2.5-pro": { in: 1.25, out: 5 },
  "google/gemini-2.5-flash-image": { flatPerCall: 0.039 },
  "google/gemini-3-flash-preview-image": { flatPerCall: 0.039 },
  "google/gemini-3.1-flash-image-preview": { flatPerCall: 0.039 },
  "google/gemini-3-pro-image-preview": { flatPerCall: 0.12 },
  "openai/gpt-5": { in: 1.25, out: 10 },
  "openai/gpt-5-mini": { in: 0.25, out: 2 },
  "openai/gpt-5-nano": { in: 0.05, out: 0.4 },
  "openai/gpt-5.2": { in: 1.25, out: 10 },
  "openai/gpt-5.4": { in: 2, out: 12 },
  "openai/gpt-5.4-mini": { in: 0.4, out: 3 },
  "openai/gpt-5.4-nano": { in: 0.1, out: 0.6 },
  "openai/gpt-5.4-pro": { in: 5, out: 20 },
  "openai/gpt-5.5": { in: 2.5, out: 15 },
  "openai/gpt-5.5-pro": { in: 6, out: 24 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  if (p.flatPerCall) return p.flatPerCall;
  const inCost = ((p.in ?? 0) * promptTokens) / 1_000_000;
  const outCost = ((p.out ?? 0) * completionTokens) / 1_000_000;
  return Number((inCost + outCost).toFixed(6));
}

export interface LogAiUsageInput {
  feature: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  status?: "ok" | "error";
  errorCode?: string | null;
  userId?: string | null;
  latencyMs?: number | null;
}

export async function logAiUsage(input: LogAiUsageInput): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    const prompt = input.usage?.prompt_tokens ?? 0;
    const completion = input.usage?.completion_tokens ?? 0;
    const total = input.usage?.total_tokens ?? prompt + completion;
    const cost = estimateCostUsd(input.model, prompt, completion);

    const sb = createClient(url, key, { auth: { persistSession: false } });
    await sb.from("ai_usage_events").insert({
      feature: input.feature,
      model: input.model,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total,
      estimated_cost_usd: cost,
      user_id: input.userId ?? null,
      status: input.status ?? "ok",
      error_code: input.errorCode ?? null,
      latency_ms: input.latencyMs ?? null,
    });
  } catch (_e) {
    // Never let logging break the caller.
  }
}
