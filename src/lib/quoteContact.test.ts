import { describe, expect, it } from "vitest";
import { resolveQuoteContact, suggestEmailName } from "./quoteContact";

describe("inquiry contact continuity", () => {
  const inquiry = { name: "pollyanna.baker", email: "pollyanna.baker@icloud.com", phone: "+44 7751252504" };
  it("retains the captured phone on an empty draft", () => {
    expect(resolveQuoteContact({ phone: null }, inquiry).phone).toBe("+44 7751252504");
  });
  it("prefills the resumed draft email from its inquiry", () => {
    expect(resolveQuoteContact({ email: "" }, inquiry).email).toBe("pollyanna.baker@icloud.com");
  });
  it("preserves explicitly chosen quote contacts", () => {
    expect(resolveQuoteContact({ email: "assistant@example.com", phone: "+442000000000" }, inquiry)).toMatchObject({ email: "assistant@example.com", phone: "+442000000000" });
  });
  it("suggests Pollyanna Baker without changing captured identity", () => {
    expect(suggestEmailName(inquiry.email)).toBe("Pollyanna Baker");
    expect(inquiry.name).toBe("pollyanna.baker");
  });
  it("does not guess names from ambiguous handles", () => {
    expect(suggestEmailName("pb1984@icloud.com")).toBeNull();
    expect(suggestEmailName("info@company.com")).toBeNull();
  });
});
