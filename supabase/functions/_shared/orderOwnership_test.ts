import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canReuseBankTransferOrder } from "./orderOwnership.ts";

Deno.test("a new bank-transfer order reference can be claimed", () => {
  assertEquals(canReuseBankTransferOrder(null, null), true);
});

Deno.test("the authenticated owner can reuse an unpaid order", () => {
  assertEquals(canReuseBankTransferOrder({ user_id: "owner" }, "owner"), true);
});

Deno.test("another signed-in user cannot overwrite an order", () => {
  assertEquals(canReuseBankTransferOrder({ user_id: "owner" }, "attacker"), false);
});

Deno.test("an anonymous caller cannot overwrite a guest or member order", () => {
  assertEquals(canReuseBankTransferOrder({ user_id: null }, null), false);
  assertEquals(canReuseBankTransferOrder({ user_id: "owner" }, null), false);
});
