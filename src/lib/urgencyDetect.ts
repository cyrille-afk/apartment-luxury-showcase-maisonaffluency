// Client-side temporal-urgency detector for the trade concierge.
//
// Mirrors the RUSH / URGENCY ACKNOWLEDGMENT PROTOCOL in
// `supabase/functions/trade-concierge/index.ts` so the UI can flag pieces
// with an "Express Shipping" tag the instant the user submits a rush turn,
// without waiting for the LLM to round-trip a structured urgency flag.

const URGENCY_PATTERNS: RegExp[] = [
  /\bhuge rush\b/i,
  /\bin a rush\b/i,
  /\brush\s+(order|job|project|delivery|install)\b/i,
  /\bfast[\s-]?track\b/i,
  /\btight(?:er)?\s+deadline\b/i,
  /\btimeline\s+crunch\b/i,
  /\bneeded?\s+yesterday\b/i,
  /\basap\b/i,
  /\bas soon as possible\b/i,
  /\burgent(?:ly)?\b/i,
  /\bwe need it by\b/i,
  /\bneed(?:ed|s)?\s+(?:it|them|these|this)?\s*by\b/i,
  /\binstallation\s+(?:next|this)\s+(?:week|month)\b/i,
  /\bdeliver(?:y|ed)?\s+by\b/i,
  /\bbefore\s+(?:the\s+)?(?:end of|mid[\s-]?)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\b/i,
];

export function detectUrgency(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const text = String(raw);
  if (!text.trim()) return false;
  for (const rx of URGENCY_PATTERNS) {
    if (rx.test(text)) return true;
  }
  return false;
}
