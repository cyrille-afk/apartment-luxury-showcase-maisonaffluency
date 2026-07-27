// Extract the confirmed project/destination city from a Felix assistant reply.
// The concierge prompt guarantees the city appears in bold in several
// canonical phrases (city-lock reply, delivery preamble, hub confirmation),
// e.g. "…anchored to **Singapore**…" or "…pre-filtered for delivery to
// **Miami**…". We match the tightest patterns first so we don't accidentally
// grab a bolded style token.

const PATTERNS: RegExp[] = [
  /pre[- ]?filtered for delivery to\s+\*\*([^*\n]+?)\*\*/i,
  /white[- ]?glove (?:delivery|route)s? to\s+\*\*([^*\n]+?)\*\*/i,
  /delivery to\s+\*\*([^*\n]+?)\*\*/i,
  /anchored (?:to|in)\s+\*\*([^*\n]+?)\*\*/i,
  /routed through\s+\*\*([^*\n]+?)\*\*/i,
  /mapped to\s+\*\*([^*\n]+?)\*\*/i,
  /project (?:city|is|in)[:\s]+\*\*([^*\n]+?)\*\*/i,
];

export function extractProjectCityFromAssistant(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m && m[1]) {
      const city = m[1].trim().replace(/[.,;:!?]+$/, "");
      if (city.length >= 2 && city.length <= 40) return city;
    }
  }
  return null;
}
