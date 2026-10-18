import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { verifyCatalogLines } from "./catalogPricing.ts";
const option = { id: "finish-1", name: "Lacquer / Aged Brass", price_cents: 240000 };
const rule = { id: "11111111-1111-4111-8111-111111111111", preferred_pick_id: "pick-1", enabled: true, finish_options: [option], finish_currency: "USD" };
const claim = { pickId: "pick-1", title: "Segment Console Table", finishLabel: option.name, pairing: { ruleId: rule.id, optionId: option.id }, unitCents: 240000, quantity: 3 };
const admin = (published = true, activeRule = rule) => ({ from: (table: string) => {
  const data = table === "curated_pairing_rules" ? [activeRule] : table === "designer_curator_picks_public" ? [{ id: "pick-1", designer_id: "designer" }] : table === "designers" ? published ? [{ id: "designer" }] : [] : [];
  const q: any = { then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
  for (const key of ["select", "in", "eq", "or"]) q[key] = () => q;
  return q;
} });
Deno.test("pairing exact retail finish ×3 is 720000 cents", async () => {
  const result = await verifyCatalogLines(admin(), [claim], "USD");
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.subtotalCents, 720000);
});
Deno.test("pairing rejects tampered same-currency price", async () => assertEquals((await verifyCatalogLines(admin(), [{ ...claim, unitCents: 239999 }], "USD")).ok, false));
Deno.test("pairing rejects wrong finish name", async () => assertEquals((await verifyCatalogLines(admin(), [{ ...claim, finishLabel: "Other" }], "USD")).ok, false));
Deno.test("pairing rejects unpublished designer", async () => assertEquals((await verifyCatalogLines(admin(false), [claim], "USD")).ok, false));
Deno.test("pairing rejects paused rule", async () => assertEquals((await verifyCatalogLines(admin(true, { ...rule, enabled: false }), [claim], "USD")).ok, false));
Deno.test("pairing rejects deleted option", async () => assertEquals((await verifyCatalogLines(admin(true, { ...rule, finish_options: [] }), [claim], "USD")).ok, false));