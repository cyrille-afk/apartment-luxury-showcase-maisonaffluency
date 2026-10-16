import { describe, expect, it } from "vitest";
import { displayNameForContact, suggestEmailName } from "@/lib/quoteContact";
import { displayNameForContact as emailDisplayName } from "../../../supabase/functions/_shared/quoteContactDisplay";

describe("suggestEmailName", () => {
  it("title-cases dotted local parts", () => {
    expect(suggestEmailName("pollyanna.baker@icloud.com")).toBe("Pollyanna Baker");
  });
});

describe("displayNameForContact", () => {
  it("uses the same readable name for editor/PDF and quote emails without mutating saved details", () => {
    const contact = Object.freeze({ name: "pollyanna.baker", email: "pollyanna.baker@icloud.com" });
    expect(displayNameForContact(contact.name, contact.email)).toBe("Pollyanna Baker");
    expect(emailDisplayName(contact.name, contact.email)).toBe("Pollyanna Baker");
    expect(contact.name).toBe("pollyanna.baker");
    expect(emailDisplayName("Maison Affluency")).toBe("Maison Affluency");
  });
  it("renders an email local-part name as a person name (no dot)", () => {
    expect(displayNameForContact("pollyanna.baker", "pollyanna.baker@icloud.com")).toBe("Pollyanna Baker");
  });

  it("suggests from the email when no name is recorded", () => {
    expect(displayNameForContact(null, "pollyanna.baker@icloud.com")).toBe("Pollyanna Baker");
    expect(displayNameForContact("", "pollyanna.baker@icloud.com")).toBe("Pollyanna Baker");
  });

  it("keeps a real recorded name untouched", () => {
    expect(displayNameForContact("Pollyanna Baker", "pollyanna.baker@icloud.com")).toBe("Pollyanna Baker");
  });

  it("keeps a proper name that merely resembles an email local part when the email differs", () => {
    expect(displayNameForContact("Jean-Luc", "jlr@maison.fr")).toBe("Jean-Luc");
  });

  it("prettifies a lowercase local-part name even without an email", () => {
    expect(displayNameForContact("anne.marie", null)).toBe("Anne Marie");
  });

  it("returns null for empty inputs", () => {
    expect(displayNameForContact(null, null)).toBeNull();
  });
});
