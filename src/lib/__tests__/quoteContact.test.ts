import { describe, expect, it } from "vitest";
import { displayNameForContact, suggestEmailName } from "@/lib/quoteContact";
import { displayNameForContact as emailDisplayName } from "../../../supabase/functions/_shared/quoteContactDisplay";

describe("suggestEmailName", () => {
  it("title-cases dotted local parts", () => {
    expect(suggestEmailName("pollyanna.baker@icloud.com")).toBe("Pollyanna Baker");
  });

  it("preserves accents in dotted usernames", () => {
    expect(suggestEmailName("élodie.brontë@example.com")).toBe("Élodie Brontë");
    expect(suggestEmailName("e\u0301lodie.brontë@example.com")).toBe("E\u0301lodie Brontë");
  });

  it("renders single-letter username segments as initials", () => {
    expect(suggestEmailName("j.r.r.tolkien@example.com")).toBe("J. R. R. Tolkien");
    expect(suggestEmailName("élodie.j.durand@example.com")).toBe("Élodie J. Durand");
  });

  it("preserves hyphenated names rather than splitting them into words", () => {
    expect(suggestEmailName("jean-luc.picard@example.com")).toBe("Jean-Luc Picard");
    expect(suggestEmailName("jean-luc@example.com")).toBe("Jean-Luc");
  });

  it("preserves existing internal casing and apostrophes", () => {
    expect(suggestEmailName("anne.McDonald@example.com")).toBe("Anne McDonald");
    expect(suggestEmailName("siobhán.o’neill@example.com")).toBe("Siobhán O’Neill");
  });

  it("does not invent names from numeric or malformed usernames", () => {
    expect(suggestEmailName("élodie..durand@example.com")).toBeNull();
    expect(suggestEmailName("user123@example.com")).toBeNull();
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

  it("preserves recorded accents, initials and hyphens even when matching the email", () => {
    expect(displayNameForContact("Élodie J. Brontë-Smith", "élodie.j.brontë-smith@example.com")).toBe("Élodie J. Brontë-Smith");
    expect(displayNameForContact("J.R. Tolkien", "j.r.tolkien@example.com")).toBe("J.R. Tolkien");
    expect(displayNameForContact("Jean-Luc", "jean-luc@example.com")).toBe("Jean-Luc");
  });

  it("applies the same Unicode and initial rules to all display callers", () => {
    for (const formatter of [displayNameForContact, emailDisplayName]) {
      expect(formatter("élodie.j.brontë-smith")).toBe("Élodie J. Brontë-Smith");
      expect(formatter(null, "élodie.j.brontë-smith@example.com")).toBe("Élodie J. Brontë-Smith");
    }
  });
});
