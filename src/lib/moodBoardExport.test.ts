import { describe, expect, it } from "vitest";
import { moodBoardPdfBudget, type MoodBoardPdfContext } from "./moodBoardExport";

const context: MoodBoardPdfContext = { roomType: "living", currency: "EUR", allocated: 1679100, target: 2000000, unpriced: 0 };
describe("Mood Board PDF budget", () => {
  it("uses the live allocated and target cent amounts", () => {
    expect(moodBoardPdfBudget(context)).toMatchObject({ allocated: "€ 16,791.00", target: "€ 20,000.00", status: "€ 3,209.00 remaining" });
  });
  it("keeps the board currency without another conversion", () => {
    expect(moodBoardPdfBudget({ ...context, currency: "SGD" }).allocated).toBe("S$ 16,791.00");
  });
  it("does not represent incomplete pricing as a complete allocation", () => {
    expect(moodBoardPdfBudget({ ...context, unpriced: 1 }).allocated).toBe("€ 16,791.00 (partial)");
    expect(moodBoardPdfBudget({ ...context, pending: true }).allocated).toBe("Unconfirmed");
  });
  it("keeps an unset target distinct from zero", () => {
    expect(moodBoardPdfBudget({ ...context, target: null }).target).toBe("Not set");
    expect(moodBoardPdfBudget({ ...context, target: 0 }).target).toBe("€ 0.00");
  });
});