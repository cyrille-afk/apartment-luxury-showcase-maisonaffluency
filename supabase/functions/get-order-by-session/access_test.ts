import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canReadOrder } from "../_shared/orderAccess.ts";
const order = { user_id: "owner", customer_email: "owner@example.com" };
Deno.test("order email alone never grants guest access", () => {
  assertEquals(canReadOrder(null, order), false);
});
Deno.test("unconfirmed matching email never grants access", () => {
  assertEquals(canReadOrder({ id: "owner", email: order.customer_email }, order), false);
});
Deno.test("verified account must own an account-bound order", () => {
  assertEquals(canReadOrder({ id: "attacker", email: order.customer_email, email_confirmed_at: "2026-10-22" }, order), false);
  assertEquals(canReadOrder({ id: "owner", email: order.customer_email, email_confirmed_at: "2026-10-22" }, order), true);
});
Deno.test("guest order requires a verified matching mailbox", () => {
  assertEquals(canReadOrder({ id: "owner", email: "other@example.com", email_confirmed_at: "2026-10-22" }, { ...order, user_id: null }), false);
  assertEquals(canReadOrder({ id: "owner", email: order.customer_email, email_confirmed_at: "2026-10-22" }, { ...order, user_id: null }), true);
});