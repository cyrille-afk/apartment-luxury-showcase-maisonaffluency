// Hybrid AI routing for curatorial queries.
//
// Flow:
//   1. Classify intent (cheap tier) through the semantic cache. A cached
//      classification is reused when cosine similarity >= CLASSIFIER_REUSE_THRESHOLD
//      (0.93) — that instantly picks the model with zero classifier spend.
//   2. Route: simple product / material lookups -> Flash model,
//      complex multi-step design reasoning -> Frontier model.
//   3. Retrieve grounded catalog context via the `match_trade_products` RPC
//      (threshold 0.4, hard limit 7 items) BEFORE the LLM call.
//   4. Call the routed model with that filtered context injected in the prompt.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { withSemanticCache } from "./aiCache.ts";
import { embedQuery } from "./aiEmbeddings.ts";
import { MODEL_TIERS, tokenBudget } from "./aiModels.ts";
import { logAiUsage } from "./aiUsage.ts";
import {
  logGuardrailViolation,
  STRICT_NO_INVENT_SUFFIX,
  validateAIResponse,
  type ValidateAIResponseResult,
} from "./aiGuardrail.ts";


const GATEWAY_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Reuse a cached classifier verdict at or above this cosine similarity. */
export const CLASSIFIER_REUSE_THRESHOLD = 0.93;
/** Minimum similarity a product must reach to enter the LLM context. */
export const DEFAULT_MATCH_THRESHOLD = 0.4;
/** Hard cap on context items — prevents context pollution. */
export const DEFAULT_MATCH_COUNT = 7;

const FLASH_MODEL = MODEL_TIERS.balanced; // simple lookups
const FRONTIER_MODEL = MODEL_TIERS.strong; // multi-step reasoning
const CLASSIFIER_MODEL = MODEL_TIERS.cheap;

export type QueryComplexity = "simple" | "complex";

export interface QueryClassification {
  complexity: QueryComplexity;
  needs_catalog: boolean;
  confidence: number;
}

export interface ProductContextItem {
  id: string;
  product_name: string;
  brand_name: string | null;
  designer_name: string | null;
  designer_slug: string | null;
  category: string | null;
  subcategory: string | null;
  materials: string | null;
  dimensions: string | null;
  description: string | null;
  image_url: string | null;
  trade_price_cents: number | null;
  currency: string | null;
  similarity: number;
}

export interface CuratorialQueryArgs {
  query: string;
  apiKey: string;
  /** Prior turns, oldest first. Optional. */
  history?: { role: "user" | "assistant"; content: string }[];
  systemPrompt?: string;
  matchThreshold?: number;
  matchCount?: number;
  userId?: string | null;
  /** Skip cache read/write for this call. */
  bypassCache?: boolean;
  feature?: string;
  /** Disable the anti-hallucination guardrail (default: enabled). */
  skipGuardrail?: boolean;
}

export interface CuratorialQueryResult {
  answer: string;
  model: string;
  tier: "flash" | "frontier";
  classification: QueryClassification;
  classifierCache: { hit: boolean; source: "exact" | "semantic" | "miss"; similarity: number };
  products: ProductContextItem[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  latencyMs: number;
  guardrail?: {
    intercepted: boolean;
    action: "none" | "stripped" | "regenerated" | "regeneration_failed";
    invalidNames: string[];
  };
}


function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function heuristicClassify(query: string): QueryClassification {
  const q = query.toLowerCase();
  const reasoningHints =
    /(scheme|specify|compare|why|combination|layout|palette|whole|entire|room|project|budget|alternative|trade[- ]off|pair with|source .* and|multi|step|plan|brief)/;
  const words = q.split(/\s+/).filter(Boolean).length;
  const complex = reasoningHints.test(q) || words > 28;
  return {
    complexity: complex ? "complex" : "simple",
    needs_catalog: true,
    confidence: 0.5,
  };
}

function parseClassification(raw: string): QueryClassification | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const complexity: QueryComplexity = parsed.complexity === "complex" ? "complex" : "simple";
    return {
      complexity,
      needs_catalog: parsed.needs_catalog !== false,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.75,
    };
  } catch {
    return null;
  }
}

async function callGateway(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<{ text: string; usage?: Record<string, number> }> {
  const resp = await fetch(GATEWAY_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw Object.assign(
      new Error(`AI gateway ${resp.status}: ${body.slice(0, 300)}`),
      { status: resp.status },
    );
  }

  const data = await resp.json();
  return {
    text: data?.choices?.[0]?.message?.content ?? "",
    usage: data?.usage,
  };
}

/** Classify the query, reusing a semantically similar cached verdict at >= 0.93. */
export async function classifyCuratorialQuery(
  query: string,
  apiKey: string,
  opts: { bypassCache?: boolean } = {},
): Promise<{
  classification: QueryClassification;
  cache: { hit: boolean; source: "exact" | "semantic" | "miss"; similarity: number };
}> {
  const cached = await withSemanticCache<QueryClassification>(
    {
      feature: "curatorial-router-classify",
      model: CLASSIFIER_MODEL,
      prompt: query,
      apiKey,
      threshold: CLASSIFIER_REUSE_THRESHOLD,
      bypass: opts.bypassCache,
      ttlSec: 60 * 60 * 24 * 30,
    },
    async () => {
      try {
        const { text, usage } = await callGateway(
          apiKey,
          CLASSIFIER_MODEL,
          [
            {
              role: "system",
              content:
                'You classify interior-design catalog queries. Reply with JSON only: {"complexity":"simple"|"complex","needs_catalog":boolean,"confidence":0-1}. ' +
                '"simple" = a single product, brand, material or specification lookup. ' +
                '"complex" = multi-step design reasoning, scheme building, comparison across pieces, or budget/space planning.',
            },
            { role: "user", content: query },
          ],
          tokenBudget("classify"),
        );
        const parsed = parseClassification(text);
        return { value: parsed ?? heuristicClassify(query), usage };
      } catch (e) {
        console.error("curatorial classifier failed", (e as Error).message);
        return { value: heuristicClassify(query) };
      }
    },
  );

  return {
    classification: cached.value,
    cache: { hit: cached.cached, source: cached.source, similarity: cached.similarity },
  };
}

/** Vector-search the trade catalog through the `match_trade_products` RPC. */
export async function retrieveProductContext(
  query: string,
  apiKey: string,
  matchThreshold = DEFAULT_MATCH_THRESHOLD,
  matchCount = DEFAULT_MATCH_COUNT,
): Promise<ProductContextItem[]> {
  const sb = serviceClient();
  if (!sb) return [];

  const embedding = await embedQuery(apiKey, query);
  if (!embedding) return [];

  const { data, error } = await sb.rpc("match_trade_products", {
    query_embedding: embedding as unknown as string,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error("match_trade_products failed", error.message);
    return [];
  }
  return ((data ?? []) as ProductContextItem[]).slice(0, matchCount);
}

function renderContext(products: ProductContextItem[]): string {
  if (!products.length) return "EMPTY — no catalog items matched above the relevance cutoff.";
  return products
    .map((p, i) => {
      const price = p.trade_price_cents
        ? `${(p.trade_price_cents / 100).toLocaleString()} ${p.currency ?? "EUR"}`
        : "Price upon Request";
      return [
        `${i + 1}. ${p.product_name}`,
        p.brand_name ? `   Brand: ${p.brand_name}` : null,
        p.designer_name ? `   Designer: ${p.designer_name}` : null,
        p.category ? `   Category: ${[p.category, p.subcategory].filter(Boolean).join(" / ")}` : null,
        p.materials ? `   Materials: ${p.materials}` : null,
        p.dimensions ? `   Dimensions: ${p.dimensions}` : null,
        `   Price: ${price}`,
        `   Relevance: ${p.similarity?.toFixed?.(3) ?? "n/a"}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

const BASE_SYSTEM_PROMPT = `You are the Maison Affluency AI Curatorial Guide, an expert luxury interior design copilot and materials authority.

Your knowledge is strictly anchored to the provided context, which is dynamically pulled from our Postgres backend (comprising 313 designers, 689 curator picks, and 1,002 trade products).

CRITICAL CONSTRAINTS:
1. ONLY recommend products, materials, and designers explicitly present in the provided [Database Context] block.
2. If the [Database Context] is empty or contains no items matching the user's aesthetic, state clearly that no exact matches exist in the current curation, and offer a close alternative using the available materials library.
3. NEVER make up designer names, product names, or specifications.
4. Follow the ROUTING MODE instruction supplied with the context block.

FORMATTING OUTPUT:
- Use clean Markdown. Always bold **Designer Names** and **Product Names**.
- Present product lists using structured bullet points including: Name, Designer, Material/Finish, and why it fits their space.
- Keep structural measurements and finish data technically accurate to the context.
- Write in English. Where a price is absent, say "Price upon Request".`;

const FLASH_MODE_INSTRUCTION =
  "ROUTING MODE: Flash — keep the response punchy, concise, and focused on direct product specifications.";
const FRONTIER_MODE_INSTRUCTION =
  "ROUTING MODE: Frontier — provide deep aesthetic reasoning, spatial context, and structural design advice.";


/**
 * Entry point: classify -> route -> retrieve -> answer.
 */
export async function handleCuratorialQuery(
  args: CuratorialQueryArgs,
): Promise<CuratorialQueryResult> {
  const started = Date.now();
  const feature = args.feature ?? "curatorial-query";
  const matchThreshold = args.matchThreshold ?? DEFAULT_MATCH_THRESHOLD;
  const matchCount = Math.min(args.matchCount ?? DEFAULT_MATCH_COUNT, DEFAULT_MATCH_COUNT);

  // 1 + 2. Cached-or-fresh classification decides the model.
  const { classification, cache } = await classifyCuratorialQuery(args.query, args.apiKey, {
    bypassCache: args.bypassCache,
  });
  const isComplex = classification.complexity === "complex";
  const model = isComplex ? FRONTIER_MODEL : FLASH_MODEL;
  const tier: "flash" | "frontier" = isComplex ? "frontier" : "flash";

  // 3. Grounding retrieval before the LLM call.
  const products = classification.needs_catalog
    ? await retrieveProductContext(args.query, args.apiKey, matchThreshold, matchCount)
    : [];

  // 4. Answer with the filtered context injected.
  const modeInstruction = isComplex ? FRONTIER_MODE_INSTRUCTION : FLASH_MODE_INSTRUCTION;
  const messages = [
    { role: "system", content: `${args.systemPrompt ?? BASE_SYSTEM_PROMPT}\n\n${modeInstruction}` },
    ...(args.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content:
        `${modeInstruction}\n\n[Database Context] (top ${products.length} of max ${matchCount}, cosine cutoff ${matchThreshold})\n` +
        `${renderContext(products)}\n[End Database Context]\n\nClient question: ${args.query}`,
    },
  ];


  try {
    const { text, usage } = await callGateway(
      args.apiKey,
      model,
      messages,
      tokenBudget(isComplex ? "reasoning" : "chat"),
    );

    // 5. Guardrail: never render a name that is not in Postgres.
    let answer = text;
    let guardrail: CuratorialQueryResult["guardrail"] = {
      intercepted: false,
      action: "none",
      invalidNames: [],
    };

    if (!args.skipGuardrail) {
      const check: ValidateAIResponseResult = await validateAIResponse(text, {
        contextItems: products,
      });

      if (!check.valid) {
        let finalAnswer = check.sanitized;
        let action: "stripped" | "regenerated" | "regeneration_failed" = "stripped";

        // Silent retry on the Flash model with the strict "do not invent profiles" variance.
        try {
          const retry = await callGateway(
            args.apiKey,
            FLASH_MODEL,
            [
              {
                role: "system",
                content: `${args.systemPrompt ?? BASE_SYSTEM_PROMPT}\n\n${FLASH_MODE_INSTRUCTION}\n${STRICT_NO_INVENT_SUFFIX}`,
              },
              messages[messages.length - 1],
            ],
            tokenBudget("chat"),
          );
          const recheck = await validateAIResponse(retry.text, { contextItems: products });
          if (recheck.valid && retry.text.trim()) {
            finalAnswer = retry.text;
            action = "regenerated";
          } else {
            finalAnswer = recheck.sanitized || check.sanitized;
            action = "regeneration_failed";
          }
        } catch (retryErr) {
          console.error("guardrail retry failed", (retryErr as Error).message);
          action = "regeneration_failed";
        }

        answer = finalAnswer;
        guardrail = { intercepted: true, action, invalidNames: check.invalidNames };

        logGuardrailViolation({
          userId: args.userId ?? null,
          feature,
          model,
          tier,
          query: args.query,
          invalidNames: check.invalidNames,
          validNames: check.validNames,
          action,
          rawAnswer: text,
          finalAnswer: answer,
        });
      }
    }

    const latencyMs = Date.now() - started;

    logAiUsage({
      feature,
      model,
      usage,
      userId: args.userId ?? null,
      latencyMs,
      tier: isComplex ? "strong" : "balanced",
    });

    return {
      answer,
      model,
      tier,
      classification,
      classifierCache: cache,
      products,
      usage,
      latencyMs,
      guardrail,
    };

  } catch (e) {
    const err = e as Error & { status?: number };
    logAiUsage({
      feature,
      model,
      status: "error",
      errorCode: String(err.status ?? "unknown"),
      userId: args.userId ?? null,
      latencyMs: Date.now() - started,
      tier: isComplex ? "strong" : "balanced",
    });
    throw err;
  }
}
