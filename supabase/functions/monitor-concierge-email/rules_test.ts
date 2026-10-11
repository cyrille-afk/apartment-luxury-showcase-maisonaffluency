import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isConciergeEmail, isDeliveryFailure } from "./rules.ts";

const now = new Date("2026-10-11T12:00:00Z");

Deno.test("inquiry and quote emails are concierge emails", () => {
  assertEquals(isConciergeEmail("inquiry-notification", "x@y.com"), true);
  assertEquals(isConciergeEmail("quote-submitted", "x@y.com"), true);
  assertEquals(isConciergeEmail("trade-approval-copy-concierge", "x@y.com"), true);
  assertEquals(isConciergeEmail("trade-welcome-auto", "x@y.com"), false);
});
Deno.test("anything to the concierge inbox counts", () => {
  assertEquals(isConciergeEmail("trade-approval", "concierge@maisonaffluency.com"), true);
});
Deno.test("suppressed and dlq are failures; sent is not", () => {
  assertEquals(isDeliveryFailure("suppressed", now.toISOString(), now), true);
  assertEquals(isDeliveryFailure("dlq", now.toISOString(), now), true);
  assertEquals(isDeliveryFailure("sent", now.toISOString(), now), false);
});
Deno.test("pending is a failure only after 20 minutes", () => {
  assertEquals(isDeliveryFailure("pending", "2026-10-11T11:45:00Z", now), false);
  assertEquals(isDeliveryFailure("pending", "2026-10-11T11:39:00Z", now), true);
});
