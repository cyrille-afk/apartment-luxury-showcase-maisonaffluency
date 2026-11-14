import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { adhocPaymentAmountCents } from "./quoteTotal.ts";

Deno.test("full admin payment links use the saved quote total", () => {
  assertEquals(adhocPaymentAmountCents(12345, "full"), 12345);
});

Deno.test("deposit admin payment links use the server-side 60 percent split", () => {
  assertEquals(adhocPaymentAmountCents(12345, "deposit"), 7407);
});
