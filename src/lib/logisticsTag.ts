// Client-side logistics micro-tag for tearsheet product cards.
//
// Turns a pick's raw `stock_status` + `lead_time` into a one-line badge shown
// under each thumbnail in Felix's tearsheet proposal, e.g.:
//   • "Available for White-Glove Delivery to Singapore in 2 Weeks"
//   • "Handcrafted to Order · 10-Week Lead Time to Singapore"
//   • "Express Shipping Available to Miami" (urgency + short lead)
//
// If we can't confidently classify the piece we return null so the card stays
// silent rather than fabricating a lead time.

export type LogisticsInput = {
  lead_time?: string | null;
  stock_status?: string | null;
  brand_name?: string | null;
  designer_name?: string | null;
};

export type LogisticsTag = {
  kind: "in_stock" | "made_to_order" | "express";
  label: string;
};

// Default white-glove transit — matches what the concierge preamble promises.
const DEFAULT_WHITE_GLOVE_WEEKS = 2;
// Rush-project ceiling: pieces at or below this weekly lead time can be
// promoted to the "Express Shipping" badge when the session is urgency-locked.
const EXPRESS_LEAD_WEEKS_MAX = 4;

function isInStock(s: LogisticsInput): boolean {
  const stock = String(s.stock_status || "").toLowerCase();
  if (/(in[\s_-]?stock|available now|ready to ship|ships? now|immediate)/.test(stock)) return true;
  const lt = String(s.lead_time || "").toLowerCase();
  if (/(in[\s_-]?stock|available now|ready to ship|ships? now|immediate)/.test(lt)) return true;
  return false;
}

function parseLeadWeeks(raw: string | null | undefined): { min: number; max: number } | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  const range = s.match(/(\d+(?:\.\d+)?)\s*(?:[–\-]|to)\s*(\d+(?:\.\d+)?)\s*(week|wk|wks|weeks|month|months|mo|mos)\b/);
  if (range) {
    const mult = range[3].startsWith("mo") ? 4 : 1;
    return { min: parseFloat(range[1]) * mult, max: parseFloat(range[2]) * mult };
  }
  const single = s.match(/(\d+(?:\.\d+)?)\s*(week|wk|wks|weeks|month|months|mo|mos)\b/);
  if (single) {
    const mult = single[2].startsWith("mo") ? 4 : 1;
    const w = parseFloat(single[1]) * mult;
    return { min: w, max: w };
  }
  return null;
}

export function buildLogisticsTag(
  pick: LogisticsInput,
  projectCity: string | null,
  opts?: { urgent?: boolean },
): LogisticsTag | null {
  const cityLabel = projectCity && projectCity.trim() ? projectCity.trim() : null;
  const cityFragment = cityLabel ? ` to ${cityLabel}` : "";
  const urgent = !!opts?.urgent;

  const inStock = isInStock(pick);
  const parsed = parseLeadWeeks(pick.lead_time);
  const eligibleForExpress =
    urgent &&
    (inStock || (parsed !== null && parsed.max <= EXPRESS_LEAD_WEEKS_MAX));

  if (eligibleForExpress) {
    return {
      kind: "express",
      label: `Express Shipping Available${cityFragment}`,
    };
  }

  if (inStock) {
    return {
      kind: "in_stock",
      label: `Available for White-Glove Delivery${cityFragment} in ${DEFAULT_WHITE_GLOVE_WEEKS} Weeks`,
    };
  }

  if (parsed) {
    const weeks = parsed.min === parsed.max
      ? `${Math.round(parsed.max)}-Week`
      : `${Math.round(parsed.min)}–${Math.round(parsed.max)}-Week`;
    const total = Math.round(parsed.max) + DEFAULT_WHITE_GLOVE_WEEKS;
    const suffix = cityLabel
      ? `${weeks} Lead Time + ${DEFAULT_WHITE_GLOVE_WEEKS}wk White-Glove to ${cityLabel} (~${total}wks total)`
      : `${weeks} Lead Time`;
    return {
      kind: "made_to_order",
      label: `Handcrafted to Order · ${suffix}`,
    };
  }

  return null;
}
