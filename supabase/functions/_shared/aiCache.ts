// Response cache for deterministic AI calls. Keyed by (feature, model, prompt_hash).
//
// Use for calls where the same prompt always produces the same output (translate,
// shipment extract, product description from a stable spec). Do NOT use for
// chat-style calls where freshness matters.
//
// Usage:
//   const out = await withCache(
//     { feature, model, prompt, ttlSec: 60 * 60 * 24 * 30 },
//     () => callUpstreamAi(...)
//   );
//   if (out.cached) { logAiUsage({ ..., cached: true, promptHash: out.promptHash }); }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { hashPrompt } from "./prompts.ts";

export interface CacheArgs {
  feature: string;
  model: string;
  prompt: string;
  /** Time-to-live in seconds. Defaults to 30 days. */
  ttlSec?: number;
}

export interface CacheResult<T> {
  value: T;
  cached: boolean;
  promptHash: string;
}

function client() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function withCache<T>(
  args: CacheArgs,
  produce: () => Promise<{ value: T; usage?: { prompt_tokens?: number; completion_tokens?: number } }>,
): Promise<CacheResult<T> & { usage?: { prompt_tokens?: number; completion_tokens?: number } }> {
  const promptHash = await hashPrompt(args.prompt);
  const sb = client();

  if (sb) {
    const { data: hit } = await sb
      .from("ai_response_cache")
      .select("response_json, prompt_tokens, completion_tokens")
      .eq("feature", args.feature)
      .eq("model", args.model)
      .eq("prompt_hash", promptHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (hit) {
      // Best-effort hit counter; ignore failures.
      sb.from("ai_response_cache")
        .update({ hits: (hit as any).hits ? (hit as any).hits + 1 : 1, last_hit_at: new Date().toISOString() })
        .eq("feature", args.feature).eq("model", args.model).eq("prompt_hash", promptHash)
        .then(() => {});
      return {
        value: (hit as any).response_json as T,
        cached: true,
        promptHash,
        usage: {
          prompt_tokens: (hit as any).prompt_tokens ?? 0,
          completion_tokens: (hit as any).completion_tokens ?? 0,
        },
      };
    }
  }

  const produced = await produce();

  if (sb) {
    const ttl = args.ttlSec ?? 60 * 60 * 24 * 30;
    const expires_at = new Date(Date.now() + ttl * 1000).toISOString();
    sb.from("ai_response_cache")
      .upsert(
        {
          feature: args.feature,
          model: args.model,
          prompt_hash: promptHash,
          response_json: produced.value,
          prompt_tokens: produced.usage?.prompt_tokens ?? null,
          completion_tokens: produced.usage?.completion_tokens ?? null,
          expires_at,
        },
        { onConflict: "feature,model,prompt_hash" },
      )
      .then(() => {});
  }

  return { value: produced.value, cached: false, promptHash, usage: produced.usage };
}
