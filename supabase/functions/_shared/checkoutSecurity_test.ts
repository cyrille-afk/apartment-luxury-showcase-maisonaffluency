import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveConfirmedShipping } from "./confirmedShipping.ts";
import { canReusePaymentIntent, type ReusableIntent } from "./paymentIntentReuse.ts";

const QUOTE_ID = "1358f23d-a533-4949-9b7f-bfaa393706ab";
const OWNER = "f4c79a4a-a624-4c0f-87be-70c28ac66092";
const OTHER = "00000000-0000-4000-8000-000000000001";
const future = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
const past = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);

function fakeAdmin(row: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => ({ data: row && row.id === id ? row : null, error: null }),
        }),
      }),
    }),
  };
}
const quote = (over: Record<string, unknown> = {}) => ({
  id: QUOTE_ID, user_id: OWNER, total_cents: 45000, currency: "EUR",
  status: "confirmed", valid_until: future, ...over,
});
const resolve = (row: Record<string, unknown> | null, o: Partial<{ quoteRef: unknown; currency: string; userId: string | null }> = {}) =>
  resolveConfirmedShipping(fakeAdmin(row), {
    confirmed: true, quoteRef: QUOTE_ID, currency: "eur", userId: OWNER, ...o,
  });

// ---- Invalid / expired shipping quotes ----
Deno.test("valid confirmed quote: amount comes from the quote row", async () => {
  assertEquals(await resolve(quote()), { ok: true, cents: 45000, quoteId: QUOTE_ID });
});
Deno.test("no shipping requested adds nothing", async () => {
  const r = await resolveConfirmedShipping(fakeAdmin(null), { confirmed: false, quoteRef: "x", currency: "eur", userId: null });
  assertEquals(r, { ok: true, cents: 0, quoteId: null });
});
for (const ref of ["", "abc", 450, null, `${QUOTE_ID}x`, "'; drop table shipping_quotes;--"]) {
  Deno.test(`malformed reference rejected: ${JSON.stringify(ref)}`, async () => {
    assertEquals((await resolve(quote(), { quoteRef: ref })).ok, false);
  });
}
Deno.test("unknown quote rejected", async () => {
  assertEquals(await resolve(null), { ok: false, error: "Shipping quote not found." });
});
for (const status of ["draft", "pending", "cancelled", "expired"]) {
  Deno.test(`unconfirmed quote rejected: ${status}`, async () => {
    assertEquals((await resolve(quote({ status }))).ok, false);
  });
}
Deno.test("expired quote rejected", async () => {
  assertEquals(await resolve(quote({ valid_until: past })), { ok: false, error: "This shipping quote has expired." });
});
Deno.test("quote valid through end of today", async () => {
  const today = new Date().toISOString().slice(0, 10);
  assertEquals((await resolve(quote({ valid_until: today }))).ok, true);
});
Deno.test("currency mismatch rejected", async () => {
  assertEquals(await resolve(quote(), { currency: "sgd" }), {
    ok: false, error: "Shipping quote currency does not match this order.",
  });
});
for (const total_cents of [0, -100, 5_000_001, "abc"]) {
  Deno.test(`invalid amount rejected: ${total_cents}`, async () => {
    assertEquals((await resolve(quote({ total_cents }))).ok, false);
  });
}

// ---- Cross-customer quote access ----
Deno.test("another customer's quote is indistinguishable from not found", async () => {
  assertEquals(await resolve(quote(), { userId: OTHER }), { ok: false, error: "Shipping quote not found." });
});
Deno.test("ownership checked before leaking currency/expiry details", async () => {
  const r = await resolve(quote({ valid_until: past, currency: "USD" }), { userId: OTHER });
  assertEquals(r, { ok: false, error: "Shipping quote not found." });
});

// ---- Changing another buyer's open card payment ----
const intent = (over: Partial<ReusableIntent> = {}): ReusableIntent => ({
  status: "requires_payment_method", client_secret: "pi_123_secret_abc", currency: "eur",
  payment_method_types: ["card"], metadata: { user_id: OWNER }, ...over,
});
const reuse = (i: ReusableIntent, o: Partial<{ clientSecret: unknown; userId: string | null; currency: string; method: string }> = {}) =>
  canReusePaymentIntent(i, { clientSecret: "pi_123_secret_abc", userId: OWNER, currency: "eur", method: "card", ...o });

Deno.test("owner holding the client secret may update", () => assert(reuse(intent())));
Deno.test("missing client secret refused", () => assertEquals(reuse(intent(), { clientSecret: undefined }), false));
Deno.test("wrong client secret refused", () => assertEquals(reuse(intent(), { clientSecret: "pi_123_secret_zzz" }), false));
Deno.test("non-string secret refused", () => assertEquals(reuse(intent(), { clientSecret: { $ne: "" } }), false));
Deno.test("intent without a secret never matches empty input", () =>
  assertEquals(reuse(intent({ client_secret: null }), { clientSecret: "" }), false));
Deno.test("different signed-in buyer refused even with secret", () =>
  assertEquals(reuse(intent(), { userId: OTHER }), false));
Deno.test("guest cannot take over a signed-in buyer's intent", () =>
  assertEquals(reuse(intent(), { userId: null }), false));
Deno.test("signed-in user cannot take over a guest intent", () =>
  assertEquals(reuse(intent({ metadata: {} })), false));
Deno.test("guest with secret may update own guest intent", () =>
  assert(reuse(intent({ metadata: {} }), { userId: null })));
for (const status of ["succeeded", "processing", "canceled", "requires_capture"]) {
  Deno.test(`non-updatable status refused: ${status}`, () => assertEquals(reuse(intent({ status })), false));
}
Deno.test("currency change refused", () => assertEquals(reuse(intent(), { currency: "sgd" }), false));
Deno.test("payment method change refused", () => assertEquals(reuse(intent(), { method: "paynow" }), false));

Deno.test("guest cannot apply any confirmed shipping quote", async () => {
  assertEquals(await resolve(quote(), { userId: null }), { ok: false, error: "Shipping quote not found." });
});
