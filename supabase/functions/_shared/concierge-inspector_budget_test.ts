import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseBudgetFromText } from "./concierge-inspector.ts";

Deno.test("parseBudgetFromText ignores uncurrencyed technical numbers", () => {
  assertEquals(parseBudgetFromText("MAX FOOTPRINT: length ≤ 5000mm"), null);
  assertEquals(parseBudgetFromText("Show me dining tables under 8000 with 12 seats"), null);
  assertEquals(parseBudgetFromText("lead time below 8 weeks"), null);
});

Deno.test("parseBudgetFromText accepts explicit currency budgets", () => {
  assertEquals(parseBudgetFromText("Show me dining tables under $8k"), {
    cents: 800_000,
    currency: "USD",
  });
  assertEquals(parseBudgetFromText("budget SGD 120000"), {
    cents: 12_000_000,
    currency: "SGD",
  });
  assertEquals(parseBudgetFromText("up to 40,000 eur"), {
    cents: 4_000_000,
    currency: "EUR",
  });
});