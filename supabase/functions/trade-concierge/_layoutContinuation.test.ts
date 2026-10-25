import { expect, it } from "vitest";
import { isLayoutScheduleContinuation } from "./_layoutContinuation";

it("routes a completed Option 3 brief to its room schedule", () => {
  expect(isLayoutScheduleContinuation("[Layout selected — do NOT re-ask the brief.] I have selected Option 3. Compile using propose_ffe_rows.", true)).toBe(true);
});
it("does not unlock an incomplete brief", () => {
  expect(isLayoutScheduleContinuation("[Layout selected] Option 3 propose_ffe_rows", false)).toBe(false);
});
it("does not change ordinary catalogue requests", () => {
  expect(isLayoutScheduleContinuation("Suggest bar stools for Bangkok", true)).toBe(false);
});