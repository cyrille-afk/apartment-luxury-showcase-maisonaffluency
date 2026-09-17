import { describe, it, expect } from "vitest";
import { isAttachmentPlaceholderText } from "@/lib/attachmentIntent";
describe("placeholder", () => {
  it("drops notifications", () => {
    ["here is the floor plan attached","see attachment","file dropped","attached the pdf","",  "please find attached the layout"].forEach(t=>expect(isAttachmentPlaceholderText(t)).toBe(true));
  });
  it("keeps real content", () => {
    ["Living and Dining room","Analyze the ceiling heights in this plan","The project is in Marrakech","we need 8 seats"].forEach(t=>expect(isAttachmentPlaceholderText(t)).toBe(false));
  });
});
