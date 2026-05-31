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

// ─────────────────────────────────────────────────────────────────────────────
// Semantic-similarity cache.
//
// Use when paraphrased prompts should reuse the same answer (intent
// classification, short concierge greetings/FAQs, deterministic rewrites).
// Flow: exact-hash check → embed → vector match above threshold → on miss
// produce + persist. Tune `threshold` carefully — too low serves wrong
// answers. 0.92 is a safe default for classification; do NOT use for
// translation or anything where wording variations matter.

import { embedQuery } from "./aiEmbeddings.ts";

export interface SemanticCacheArgs extends CacheArgs {
  /** Lovable API key — required to embed the prompt on miss. */
  apiKey: string;
  /** Cosine similarity required to count as a hit. Default 0.92. */
  threshold?: number;
}

export interface SemanticCacheResult<T> extends CacheResult<T> {
  /** Similarity of the matched row (1.0 for exact-hash hits). */
  similarity: number;
  /** 'exact' = hash matched, 'semantic' = vector matched, 'miss' = fresh produce. */
  source: "exact" | "semantic" | "miss";
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export async function withSemanticCache<T>(
  args: SemanticCacheArgs,
  produce: () => Promise<{ value: T; usage?: { prompt_tokens?: number; completion_tokens?: number } }>,
): Promise<SemanticCacheResult<T>> {
  const promptHash = await hashPrompt(args.prompt);
  const threshold = args.threshold ?? 0.92;
  const ttl = args.ttlSec ?? 60 * 60 * 24 * 30;
  const sb = client();

  // 1. Exact-hash fast path (free, no embedding needed).
  if (sb) {
    const { data: exact } = await sb
      .from("ai_semantic_cache")
      .select("id, response_json, prompt_tokens, completion_tokens, hits")
      .eq("feature", args.feature)
      .eq("model", args.model)
      .eq("prompt_hash", promptHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (exact) {
      sb.from("ai_semantic_cache")
        .update({ hits: ((exact as any).hits ?? 0) + 1, last_hit_at: new Date().toISOString() })
        .eq("id", (exact as any).id).then(() => {});
      return {
        value: (exact as any).response_json as T,
        cached: true, promptHash, similarity: 1, source: "exact",
        usage: {
          prompt_tokens: (exact as any).prompt_tokens ?? 0,
          completion_tokens: (exact as any).completion_tokens ?? 0,
        },
      };
    }
  }

  // 2. Embed once — reused for lookup + (on miss) insert.
  const queryEmbedding = await embedQuery(args.apiKey, args.prompt);

  // 3. Semantic lookup via match_semantic_cache RPC.
  if (sb && queryEmbedding) {
    const { data: hits, error } = await sb.rpc("match_semantic_cache", {
      _feature: args.feature,
      _model: args.model,
      _query_embedding: queryEmbedding as any,
      _threshold: threshold,
      _limit: 1,
    });
    if (!error && Array.isArray(hits) && hits.length) {
      const hit = hits[0] as any;
      sb.from("ai_semantic_cache")
        .update({ hits: 1, last_hit_at: new Date().toISOString() })
        .eq("id", hit.id).then(() => {});
      return {
        value: hit.response_json as T,
        cached: true, promptHash, similarity: hit.similarity, source: "semantic",
        usage: {
          prompt_tokens: hit.prompt_tokens ?? 0,
          completion_tokens: hit.completion_tokens ?? 0,
        },
      };
    }
  }

  // 4. Miss → produce and persist.
  const produced = await produce();
  if (sb) {
    const expires_at = new Date(Date.now() + ttl * 1000).toISOString();
    sb.from("ai_semantic_cache").insert({
      feature: args.feature,
      model: args.model,
      prompt: args.prompt.slice(0, 4000),
      prompt_hash: promptHash,
      embedding: queryEmbedding as any,
      response_json: produced.value,
      prompt_tokens: produced.usage?.prompt_tokens ?? null,
      completion_tokens: produced.usage?.completion_tokens ?? null,
      expires_at,
    }).then(() => {});
  }

  return {
    value: produced.value,
    cached: false, promptHash, similarity: 0, source: "miss",
    usage: produced.usage,
  };
}
