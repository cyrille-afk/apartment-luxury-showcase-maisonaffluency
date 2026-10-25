import { describe, expect, it } from "vitest";
import { parseDesignerNote, plainDesignerNote, wrapDesignerNote } from "./designerNoteFormat";

describe("designer note formatting", () => {
  it("parses bold, highlight and bullets", () => {
    const [a, b] = parseDesignerNote("Use **COM** fabric\n- ==12 weeks== lead");
    expect(a.runs).toEqual([{ text: "Use ", bold: false, mark: false }, { text: "COM", bold: true, mark: false }, { text: " fabric", bold: false, mark: false }]);
    expect(b.bullet).toBe(true);
    expect(b.runs[0]).toEqual({ text: "12 weeks", bold: false, mark: true });
  });
  it("leaves unmatched markers as literal text", () => {
    expect(parseDesignerNote("5 ** 2")[0].runs.map(r => r.text).join("")).toBe("5 ** 2");
  });
  it("strips markers for plain text", () => {
    expect(plainDesignerNote("- **Oak** top")).toBe("• Oak top");
  });
  it("wraps bullet continuations with indent", () => {
    const out = wrapDesignerNote(parseDesignerNote("- one two three"), 8, t => t.length, 2);
    expect(out.length).toBeGreaterThan(1);
    expect(out[0].bullet).toBe(true);
    expect(out[1]).toMatchObject({ bullet: false, indent: true });
  });
});
