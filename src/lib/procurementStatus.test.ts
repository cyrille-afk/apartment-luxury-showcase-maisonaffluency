import { describe, expect, it } from "vitest";
import { procurementState, quoteDocumentEditable } from "./procurementStatus";

describe("issued procurement document", () => {
  it("stays DRAFT before finalization", () => {
    expect(procurementState(null)).toBe("DRAFT");
    expect(quoteDocumentEditable(null, "draft")).toBe(true);
  });
  it("changes to PROCUREMENT_REVIEW after finalization", () => {
    expect(procurementState("2026-11-10T13:17:00Z")).toBe("PROCUREMENT_REVIEW");
  });
  it("freezes issued line items, client profiles and addresses even for administrators", () => {
    expect(quoteDocumentEditable("2026-11-10T13:17:00Z", "submitted", true)).toBe(false);
    expect(quoteDocumentEditable("2026-11-10T13:17:00Z", "draft", true)).toBe(false);
  });
});