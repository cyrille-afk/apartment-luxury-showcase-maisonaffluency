import { describe, it, expect } from "vitest";
import { prefillCountryForPhone, phoneCountryMismatch } from "./phoneCountry";
describe("phoneCountry", () => {
  it("+65 prefills Singapore", () => expect(prefillCountryForPhone("+6596669029")).toBe("Singapore"));
  it("flags +65 with France", () => expect(phoneCountryMismatch("+65 9666 9029", "France")).toMatch(/Singapore/));
  it("no flag when matching", () => expect(phoneCountryMismatch("+971 50 123 4567", "United Arab Emirates")).toBeNull());
  it("+1 accepts Canada", () => expect(phoneCountryMismatch("+1 416 555 0199", "Canada")).toBeNull());
  it("local numbers never flag", () => expect(phoneCountryMismatch("96669029", "France")).toBeNull());
});
