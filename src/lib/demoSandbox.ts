// Demo tour sandbox data — used by /trade-demo.
// Nothing here writes to the database; everything lives in memory / sessionStorage.

export const DEMO_CLIENT_NAME = "Affluency ETC Pte Ltd";
export const DEMO_PROJECT_NAME = "Chatsworth Road GCB";
export const DEMO_CITY = "Singapore";
export const DEMO_CURRENCY = "EUR";
export const DEMO_TRADE_DISCOUNT_PCT = 0.08;

export const DEMO_FREE_TEXT =
  "I'm currently working on furnishing a GCB living and dining room";

export const DEMO_PASTED_BRIEF =
  "I'm currently gathering furnishing ideas of a large GBC living room of 6x5m. I'm particularly interested in the sofas, armchairs, and coffee table from Man of Parts.";

export type DemoPiece = {
  pickId: string;
  title: string;
  designer: string;
  brand: string;
  category: string;
  imageUrl: string;
  dimensions: string;
  finishes: { base: string; top: string };
  finishOptions: { base: string[]; top: string[] };
  rrpCents: number;
  tradePriceCents: number;
  leadTime: string;
};

// Three real Man of Parts pieces (pick ids verified from designer_curator_picks).
export const DEMO_PIECES: DemoPiece[] = [
  {
    pickId: "a2656f2b-c440-4e1c-a2a9-e47513b6d787",
    title: "Sandy Cove Sofa",
    designer: "Sebastian Herkner",
    brand: "Man of Parts",
    category: "Sofa",
    imageUrl:
      "https://res.cloudinary.com/dif1oamtj/image/upload/w_800,c_fill,q_auto:good,f_auto/v1782188316/SandyCovea_a4lxyy.jpg",
    dimensions: "W 240 × D 98 × H 78 cm — SH 42 cm",
    finishes: { base: "Tobacco Oak", top: "Fabric Cat. Karakorum" },
    finishOptions: {
      base: ["Tobacco Oak", "Nude Oak", "Black Pepper Oak"],
      top: [
        "COM Fabric",
        "Fabric Cat. Opera",
        "Fabric Cat. Karakorum",
        "Fabric Cat. Aries",
        "Leather Cat. Sierra",
      ],
    },
    rrpCents: 801000,
    tradePriceCents: 737000,
    leadTime: "14–16 weeks",
  },
  {
    pickId: "f1a56c37-f49a-4ba0-bc00-a5adcbffb887",
    title: "Frenchmen Street Lounge Chair",
    designer: "Sebastian Herkner",
    brand: "Man of Parts",
    category: "Lounge Chair",
    imageUrl:
      "https://res.cloudinary.com/dif1oamtj/image/upload/w_800,c_fill,q_auto:good,f_auto/v1782140189/FRENCHMAN_STREE_covera_h34oca.jpg",
    dimensions: "W 88 × D 92 × H 78 cm — SH 40 cm",
    finishes: { base: "Nude Oak", top: "Leather Cat. Sierra" },
    finishOptions: {
      base: ["Tobacco Oak", "Nude Oak", "Black Pepper Oak"],
      top: [
        "Fabric Cat. Opera",
        "Fabric Cat. Karakorum",
        "Leather Cat. Sierra",
        "Leather Cat. Cervo",
      ],
    },
    rrpCents: 521000,
    tradePriceCents: 479100,
    leadTime: "14–16 weeks",
  },
  {
    pickId: "a5d5ce54-efbb-4148-ba1c-20a1de887580",
    title: "Praia da Granja Coffee Table",
    designer: "Sebastian Herkner",
    brand: "Man of Parts",
    category: "Coffee Table",
    imageUrl:
      "https://res.cloudinary.com/dif1oamtj/image/upload/w_800,c_fill,q_auto:good,f_auto/v1782128425/CoverA_u05lfp.jpg",
    dimensions: "W 120 × D 80 × H 32 cm (Rectangle)",
    finishes: { base: "Travertine Silver", top: "Tobacco Oak Base" },
    finishOptions: {
      base: ["Travertine Silver", "Travertine Roman", "Nero Marquina"],
      top: ["Nude Oak Base", "Tobacco Oak Base", "Black Pepper Oak Base"],
    },
    rrpCents: 924000,
    tradePriceCents: 850000,
    leadTime: "16–18 weeks",
  },
];

export function fmtEUR(cents: number): string {
  return `€${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)}`;
}

// ─────────────────────────────────────────────────────────────
// Pricing sanity check
// ─────────────────────────────────────────────────────────────
// Catches decimal / order-of-magnitude typos in the demo seed
// (e.g. "€80,100 instead of €8,010" — a 10× error). Runs at
// module load; a stricter live cross-check against
// `designer_curator_picks.trade_price_cents` is available via
// `verifyDemoPricesLive()` and is invoked once from the demo
// launcher.
//
// Bounds are deliberately wide to accommodate every catalogue
// category (accessory → statement furniture). Anything outside
// these bounds, or an RRP < trade price, is almost certainly a
// data-entry error.

const PRICE_MIN_CENTS = 10_000;      // €100
const PRICE_MAX_CENTS = 5_000_000;   // €50,000
const MAX_TRADE_DISCOUNT_PCT = 0.5;  // trade should not be < 50% of RRP

type PriceIssue = {
  pickId: string;
  title: string;
  field: "rrpCents" | "tradePriceCents" | "ratio";
  value: number;
  reason: string;
};

export function checkDemoPriceSanity(pieces: DemoPiece[] = DEMO_PIECES): PriceIssue[] {
  const issues: PriceIssue[] = [];
  for (const p of pieces) {
    const bounded = (field: "rrpCents" | "tradePriceCents", v: number) => {
      if (v < PRICE_MIN_CENTS) {
        issues.push({ pickId: p.pickId, title: p.title, field, value: v,
          reason: `below €${PRICE_MIN_CENTS / 100} floor` });
      } else if (v > PRICE_MAX_CENTS) {
        issues.push({ pickId: p.pickId, title: p.title, field, value: v,
          reason: `above €${PRICE_MAX_CENTS / 100} ceiling — likely 10× typo` });
      }
    };
    bounded("rrpCents", p.rrpCents);
    bounded("tradePriceCents", p.tradePriceCents);
    if (p.tradePriceCents > p.rrpCents) {
      issues.push({ pickId: p.pickId, title: p.title, field: "ratio",
        value: p.tradePriceCents,
        reason: `trade price (${fmtEUR(p.tradePriceCents)}) exceeds RRP (${fmtEUR(p.rrpCents)})` });
    } else if (p.tradePriceCents < p.rrpCents * (1 - MAX_TRADE_DISCOUNT_PCT)) {
      issues.push({ pickId: p.pickId, title: p.title, field: "ratio",
        value: p.tradePriceCents,
        reason: `trade discount > ${MAX_TRADE_DISCOUNT_PCT * 100}% off RRP — likely wrong order of magnitude` });
    }
  }
  return issues;
}

// Runtime warning — logs once when the module loads.
const _issues = checkDemoPriceSanity();
if (_issues.length > 0 && typeof console !== "undefined") {
  console.warn(
    `[demoSandbox] Pricing sanity check found ${_issues.length} issue(s):`,
    _issues,
  );
}

/**
 * Cross-check demo seed prices against the live DB values on
 * `designer_curator_picks.trade_price_cents`. Warns if any seed
 * differs from the live price by more than 20% or by any factor
 * of 10 (the classic decimal typo).
 *
 * Call this once from the demo launcher — it is intentionally
 * lazy so it never blocks initial page load.
 */
export async function verifyDemoPricesLive(
  fetchImpl?: (ids: string[]) => Promise<Array<{ id: string; trade_price_cents: number | null }>>,
): Promise<PriceIssue[]> {
  const issues: PriceIssue[] = [];
  try {
    let rows: Array<{ id: string; trade_price_cents: number | null }> = [];
    if (fetchImpl) {
      rows = await fetchImpl(DEMO_PIECES.map((p) => p.pickId));
    } else {
      const mod = await import("@/integrations/supabase/client");
      const { data, error } = await mod.supabase
        .from("designer_curator_picks")
        .select("id, trade_price_cents")
        .in("id", DEMO_PIECES.map((p) => p.pickId));
      if (error) throw error;
      rows = (data || []) as Array<{ id: string; trade_price_cents: number | null }>;
    }
    const byId = new Map(rows.map((r) => [r.id, r.trade_price_cents]));
    for (const p of DEMO_PIECES) {
      const live = byId.get(p.pickId);
      if (live == null) continue;
      const ratio = p.tradePriceCents / live;
      const off10x = ratio >= 9 || ratio <= 1 / 9;
      const offBand = ratio > 1.2 || ratio < 0.8;
      if (off10x || offBand) {
        issues.push({
          pickId: p.pickId,
          title: p.title,
          field: "tradePriceCents",
          value: p.tradePriceCents,
          reason: `seed ${fmtEUR(p.tradePriceCents)} vs live ${fmtEUR(live)} — ratio ${ratio.toFixed(2)}${off10x ? " (10× typo)" : ""}`,
        });
      }
    }
    if (issues.length > 0 && typeof console !== "undefined") {
      console.warn(
        `[demoSandbox] Live pricing drift — ${issues.length} piece(s) diverge from DB:`,
        issues,
      );
    }
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[demoSandbox] verifyDemoPricesLive failed:", err);
    }
  }
  return issues;
}

export type DemoSteps = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const DEMO_STEP_META: Record<
  DemoSteps,
  { title: string; body: string; cta: string }
> = {
  1: {
    title: "1 · Start with a city",
    body: `Open the AI Concierge and mention the market you're working in. It picks up "${DEMO_CITY}" and tailors every recommendation to that context.`,
    cta: "Open the Concierge",
  },
  2: {
    title: "2 · State the intent",
    body: `Type a one-liner: "${DEMO_FREE_TEXT}". The Concierge already knows GCBs, room typologies, and reads it against Singapore's design vocabulary.`,
    cta: "Send the intent",
  },
  3: {
    title: "3 · Paste the brief",
    body: `Drop the full architectural brief — dimensions, room, brand focus. The Concierge returns a curated tearsheet grounded strictly in the catalog.`,
    cta: "Send the brief",
  },
  4: {
    title: "4 · Configure in 3D & lock finishes",
    body: `Each returned piece has a live 3D configurator. Rotate, try finishes, and lock the combination that fits the room.`,
    cta: "Lock all finishes",
  },
  5: {
    title: "5 · Add to a project",
    body: `Attach the locked selection to a project. Here: client "${DEMO_CLIENT_NAME}", project "${DEMO_PROJECT_NAME}".`,
    cta: "Add to project",
  },
  6: {
    title: "6 · Tearsheet",
    body: "The tearsheet consolidates everything: image, designer, dimensions, materials, finishes, lead time, and RRP.",
    cta: "Continue to quote",
  },
  7: {
    title: "7 · Quote with selected finishes",
    body: "Turn the tearsheet into a priced quote. Each line shows the exact finish combination, RRP, trade price, and totals.",
    cta: "Prepare the PDF",
  },
  8: {
    title: "8 · Download PDF",
    body: `A branded PDF is generated with the client "${DEMO_CLIENT_NAME}" and project "${DEMO_PROJECT_NAME}" on the cover.`,
    cta: "Download quote PDF",
  },
};
