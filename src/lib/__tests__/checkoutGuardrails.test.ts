import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_CHECKOUT_CLAIMS,
  buildVerifiedTotals,
  reconcileBackendAmount,
} from "../checkoutGuardrails";

const lines = [
  { title: "Clam Chair", unitCents: 751300, currency: "usd", quantity: 1 },
  { title: "Side Table", unitCents: 250000, currency: "usd", quantity: 2 },
];

describe("verified totals", () => {
  it("sums every line with no extra addends", () => {
    const t = buildVerifiedTotals(lines);
    expect(t.subtotalCents).toBe(751300 + 500000);
    expect(t.totalCents).toBe(t.subtotalCents);
  });

  it("blocks checkout when the backend amount differs", () => {
    const t = buildVerifiedTotals(lines);
    expect(reconcileBackendAmount(t, t.totalCents).ok).toBe(true);
    expect(reconcileBackendAmount(t, t.totalCents - 1).ok).toBe(false);
    expect(reconcileBackendAmount(t, t.totalCents, "eur").ok).toBe(false);
  });

  it("blocks mixed-currency carts", () => {
    const t = buildVerifiedTotals([lines[0], { ...lines[1], currency: "eur" }]);
    expect(reconcileBackendAmount(t, t.totalCents).ok).toBe(false);
  });
});

describe("checkout copy", () => {
  it("contains no unverifiable pricing claims", () => {
    const src = readFileSync("src/pages/Checkout.tsx", "utf8");
    // Scan only user-visible code: strip comments (engineering notes may
    // legitimately name real backend mechanics) and the guardrail import.
    const text = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.includes("checkoutGuardrails") && !/^\s*\/\//.test(l))
      .join("\n");
    const hits = FORBIDDEN_CHECKOUT_CLAIMS.filter((r) => r.pattern.test(text)).map((r) => r.label);
    expect(hits).toEqual([]);
  });
});
