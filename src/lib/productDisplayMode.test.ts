import { describe, expect, it } from "vitest";
import { productDisplayPolicy } from "./productDisplayMode";
describe("product display rules", () => {
  it("locks studio to EUR in Singapore", () => { expect(productDisplayPolicy(false, "SGD").currency).toBe("EUR"); });
  it("uses SGD in Singapore presentation", () => { expect(productDisplayPolicy(true, "SGD").currency).toBe("SGD"); });
  it("uses localized USD presentation", () => { expect(productDisplayPolicy(true, "USD").currency).toBe("USD"); });
  it("hides net prices in presentation", () => { expect(productDisplayPolicy(true, "SGD").showNetPrice).toBe(false); });
  it("hides trade actions in presentation", () => { expect(productDisplayPolicy(true, "SGD").showTradeTools).toBe(false); expect(productDisplayPolicy(false, "SGD").showTradeTools).toBe(true); });
});
