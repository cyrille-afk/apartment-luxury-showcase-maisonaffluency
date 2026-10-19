import { describe, expect, it } from "bun:test";
import {
  INQUIRY_SEARCH_FIELDS,
  inquirySearchOrGroup,
  inquirySearchTerms,
  inquirySearchWhere,
  matchesInquirySearch,
} from "./inquirySearch";

const consultation = {
  name: "Elizabeth Spradling",
  email: "lizspradling@mac.com",
  company: "Liz Spradling Antiques & Interiors",
  subject: null,
  message: "Bespoke Quote / Customisation — Console Cheval by Felix Agostini",
  product_name: "Console Cheval",
  designer_name: "Felix Agostini",
  admin_notes: "prefers brass",
};

describe("inquirySearchTerms", () => {
  it("splits, lowercases and trims typed text", () => {
    expect(inquirySearchTerms("  Venus   LAMP ")).toEqual(["venus", "lamp"]);
  });

  it("returns no terms for blank input", () => {
    expect(inquirySearchTerms("   ")).toEqual([]);
  });

  it("caps a pasted query at six terms", () => {
    expect(inquirySearchTerms("a b c d e f g h").length).toBe(6);
  });
});

describe("matchesInquirySearch", () => {
  it("matches on client name", () => {
    expect(matchesInquirySearch(consultation, "elizabeth")).toBe(true);
  });

  it("matches on email", () => {
    expect(matchesInquirySearch(consultation, "mac.com")).toBe(true);
  });

  it("matches on the message body", () => {
    expect(matchesInquirySearch(consultation, "console cheval")).toBe(true);
  });

  it("matches on a null-valued column without throwing", () => {
    expect(matchesInquirySearch({ ...consultation, subject: null }, "console")).toBe(true);
  });

  it("requires every typed term to appear (AND, not OR)", () => {
    expect(matchesInquirySearch(consultation, "console brass")).toBe(true);
    expect(matchesInquirySearch(consultation, "console zzzqqq")).toBe(false);
  });

  it("ignores a term that only appears in an unsearched column", () => {
    expect(matchesInquirySearch({ name: "x", message: "y", status: "new" }, "new")).toBe(false);
  });

  it("returns true for blank input", () => {
    expect(matchesInquirySearch(consultation, "  ")).toBe(true);
  });
});

describe("inquirySearchWhere", () => {
  it("builds one or-group per term", () => {
    expect(inquirySearchWhere("liz venus").length).toBe(2);
    expect(inquirySearchWhere("")).toEqual([]);
  });

  it("searches every configured column", () => {
    const group = inquirySearchOrGroup("liz");
    for (const field of INQUIRY_SEARCH_FIELDS) {
      expect(group).toContain(`${field}.ilike."%liz%"`);
    }
  });

  it("escapes ILIKE wildcards and quotes in the pattern", () => {
    const group = inquirySearchOrGroup('100%"');
    expect(group).toContain('.ilike."%100\\%%"');
    expect(group).not.toContain('""');
  });
});
