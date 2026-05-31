// Central prompt library. Adding a new system prompt here (rather than inline
// in a function) gives us:
//   - one place to edit tone, brand voice, and constraints,
//   - automatic parameterization via {{token}} placeholders,
//   - a deterministic SHA-256 over the rendered prompt for cache + analytics
//     (see _shared/cache.ts and ai_usage_events.prompt_hash).
//
// Add a new entry by appending to PROMPTS and calling `buildPrompt("key", vars)`.

export const PROMPTS = {
  // Trade concierge — concise voice rules; long instructions live in trade-concierge/index.ts
  // because they interleave with dynamic catalog context. This template is the brand-voice
  // header injected at the top.
  conciergeVoice: `You are Maison Affluency's senior trade concierge. Reply in concise, editorial English.
- Address the trade user as a peer.
- Never invent pieces, designers, or prices outside the provided catalog context.
- When proposing pieces, use the structured tools — never paste raw IDs in prose.`,

  // Product description writer — tone is variable; the base template handles the rest.
  productDescription: `Write a single-paragraph product description for a luxury furniture e-commerce site.
Tone: {{tone}}. Keep it under 80 words. No marketing fluff, no exclamation marks, no "introducing".`,

  // Sentiment / intent classifier for the concierge.
  sentimentClassify: `Classify the user's latest message in a luxury B2B furniture concierge chat.
Return JSON only via the tool call. Be conservative — only flag escalate=true when the user is clearly frustrated,
complains repeatedly, threatens to leave, or explicitly asks for a human.`,

  // Shipment document intake — pulls structured fields from an invoice / packing list.
  shipmentExtract: `You are a logistics intake assistant for a luxury furniture trade portal.
Extract shipment details from the document or email the user provides and return STRICT JSON via the tool call.
Use ISO 3166-1 alpha-2 country codes (e.g. IT, FR, SG, HK, AE, US, GB, AU, BE, ES).`,

  // Taste profile — turns user signals (favourites, picks, time-on-page) into a persona JSON.
  tasteProfile: `Given a user's interaction signals, infer a designer-style persona.
Return a single JSON object with keys: tags (string[]), preferred_styles (string[]), summary (string, <40 words).`,

  // Board recommendations — companion pieces for an existing mood board.
  boardRecommendations: `You are a senior interior designer suggesting companion pieces for an existing mood board.
Return JSON with key "picks" (array of {id, reason}). Pick from the provided catalog only. Max 6 items.`,

  // FFE layout — spatial reasoning over a room plan image.
  ffeLayout: `You are a senior interior architect proposing furniture placement for the room shown.
Return STRICT JSON via the tool call. Respect circulation paths, scale, and the user's brief.`,
} as const;

export type PromptKey = keyof typeof PROMPTS;

/**
 * Render a template by replacing {{key}} placeholders with values from `vars`.
 * Unknown placeholders are left as-is so missing context is visible during dev.
 */
export function buildPrompt(key: PromptKey, vars: Record<string, string> = {}): string {
  let out: string = PROMPTS[key];
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

/** Stable SHA-256 hash of a prompt string. Used for cache keys + ai_usage_events.prompt_hash. */
export async function hashPrompt(prompt: string): Promise<string> {
  const data = new TextEncoder().encode(prompt);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
