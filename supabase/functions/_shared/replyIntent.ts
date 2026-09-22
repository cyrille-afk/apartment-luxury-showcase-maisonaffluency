// Conservative positive-intent detection for inbound acquisition replies.
//
// Deliberately deterministic: an activation email carrying a private portal key
// must never fire on an ambiguous, negative, or quoted-back message. Anything we
// are not sure about stays unactioned for manual review.

/** Strip quoted history, signatures and forwarded blocks from a reply body. */
export function extractReplyText(raw: string): string {
  const lines = String(raw ?? "").replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) break; // quoted history
    if (/^on .+ wrote:$/i.test(trimmed)) break;
    if (/^-{2,}\s*original message\s*-{2,}$/i.test(trimmed)) break;
    if (/^(from|sent|to|subject):\s/i.test(trimmed) && kept.length > 0) break;
    if (/^-{2,}\s*$/.test(trimmed) || trimmed === "__") break; // signature delimiter
    if (/^(warm regards|best regards|kind regards|regards|sincerely|thanks,|thank you,)\b/i.test(trimmed)) break;
    kept.push(line);
  }

  return kept.join("\n").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const POSITIVE_PATTERNS: RegExp[] = [
  /^yes\b/i,
  /^yes[\s!.,]*$/i,
  /^sure\b/i,
  /^absolutely\b/i,
  /^definitely\b/i,
  /^of course\b/i,
  /\bplease do\b/i,
  /\bplease send\b/i,
  /\bsend it over\b/i,
  /\bsend it through\b/i,
  /\bsend over\b/i,
  /\bsend the (?:key|link|credential|credentials|access)\b/i,
  /\bsounds good\b/i,
  /\bsounds great\b/i,
  /\bwe(?:'| a)re interested\b/i,
  /\bi(?:'| a)?m interested\b/i,
  /\bwe would be interested\b/i,
  /\b(?:yes,? )?we(?:'d| would) love (?:to|that)\b/i,
  /\bhappy to (?:proceed|take a look|see it)\b/i,
  /\bgo ahead\b/i,
  /\bcount us in\b/i,
];

const NEGATIVE_PATTERNS: RegExp[] = [
  /\bnot interested\b/i,
  /\bno,? thank(?:s| you)\b/i,
  /\bplease (?:remove|unsubscribe|stop)\b/i,
  /\bunsubscribe\b/i,
  /\bdo not (?:contact|email)\b/i,
  /\bdon'?t (?:contact|email)\b/i,
  /\bnot at this time\b/i,
  /\bnot right now\b/i,
  /\bwe(?:'| a)re not\b/i,
  /\bno longer\b/i,
  /\bout of office\b/i,
  /\bautomatic reply\b/i,
  /\bauto[- ]?reply\b/i,
  /\bdelivery (?:status notification|has failed)\b/i,
  /\bundeliverable\b/i,
  /\bmailer-daemon\b/i,
];

export type ReplyIntent = "positive" | "negative" | "unclear";

/**
 * Classify an inbound reply. Only returns "positive" for a short, clearly
 * affirmative message with no negative or auto-responder marker in it.
 */
export function classifyReplyIntent(rawBody: string): {
  intent: ReplyIntent;
  text: string;
} {
  const text = extractReplyText(rawBody);
  if (!text) return { intent: "unclear", text };

  // Long essays are routed to a human: the phrase match is not reliable there.
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 120) return { intent: "unclear", text };

  if (NEGATIVE_PATTERNS.some((re) => re.test(text))) {
    return { intent: "negative", text };
  }
  if (POSITIVE_PATTERNS.some((re) => re.test(text))) {
    return { intent: "positive", text };
  }
  return { intent: "unclear", text };
}

/** Normalise an address for comparison: lowercase, strip display name + plus-tag. */
export function normalizeEmail(input: unknown): string {
  const raw = String(input ?? "").trim();
  const angled = raw.match(/<([^>]+)>/);
  const address = (angled ? angled[1] : raw).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return "";
  return address;
}

/** Same as normalizeEmail but with any `+tag` sub-address removed. */
export function baseEmail(input: unknown): string {
  const address = normalizeEmail(input);
  if (!address) return "";
  const [local, domain] = address.split("@");
  return `${local.split("+")[0]}@${domain}`;
}

/** URL-safe studio slug used in the portal link. */
export function studioSlug(name: unknown): string {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
