// Central model registry for every Lovable AI Gateway call across edge functions.
// Single source of truth — never hardcode model IDs in functions.
//
// Tier guidance:
//   cheap     → classification, intent detection, sentiment, short rewrites, translation
//   balanced  → chat, extraction with vision, multi-turn agent loops
//   strong    → spatial reasoning, multi-room planning, complex brief synthesis
//   image     → image generation
//   imageHi   → higher-fidelity image generation fallback
//
// Pricing (USD per 1M tokens, in/out) is mirrored from `_shared/aiUsage.ts`
// MODEL_PRICING so callers can reason about cost when choosing tiers.
// Review quarterly against https://docs.lovable.dev/ai-gateway pricing.

export const MODEL_TIERS = {
  cheap: "google/gemini-3.1-flash-lite-preview", // $0.05 / $0.20
  balanced: "google/gemini-3-flash-preview",      // $0.075 / $0.30
  strong: "google/gemini-2.5-pro",                // $1.25 / $5.00
  image: "google/gemini-3.1-flash-image-preview", // flat ~$0.039/image
  imageHi: "google/gemini-3-pro-image-preview",   // flat ~$0.12/image
} as const;

export type ModelTier = keyof typeof MODEL_TIERS;

export function modelFor(tier: ModelTier): string {
  return MODEL_TIERS[tier];
}
