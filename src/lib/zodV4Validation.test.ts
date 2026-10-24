import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateComparisonAnnotations } from "./snapshotComparisonAnnotations";

describe("Zod v4 upgrade — validation behaviour", () => {
  it("annotation notes keep a 600-character limit per note", () => {
    expect(() => validateComparisonAnnotations({ notes: { a: "x".repeat(600) } })).not.toThrow();
    expect(() => validateComparisonAnnotations({ notes: { a: "x".repeat(601) } })).toThrow();
  });

  it("annotation photos allow at most 3 JPEG data URLs per entry", () => {
    const jpg = "data:image/jpeg;base64,AAAA";
    expect(() => validateComparisonAnnotations({ photos: { a: [jpg, jpg, jpg] } })).not.toThrow();
    expect(() => validateComparisonAnnotations({ photos: { a: [jpg, jpg, jpg, jpg] } })).toThrow();
    expect(() => validateComparisonAnnotations({ photos: { a: ["data:image/png;base64,AAAA"] } })).toThrow();
  });

  it("enum custom message 'Required' still shows for the preferred contact field", () => {
    const s = z.enum(["Email", "Phone", "WhatsApp"], { error: "Required" });
    const r = s.safeParse("");
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe("Required");
  });

  it("form field errors are read from issues", () => {
    const r = z.object({ email: z.string().trim().email("Enter a valid email") }).safeParse({ email: "nope" });
    expect(!r.success && r.error.issues[0].path[0]).toBe("email");
    expect(!r.success && r.error.issues[0].message).toBe("Enter a valid email");
  });

  it("guid accepts any 8-4-4-4-12 id, as before the upgrade", () => {
    expect(z.string().guid().safeParse("00000000-0000-0000-0000-000000000001").success).toBe(true);
    expect(z.string().guid().safeParse("not-an-id").success).toBe(false);
  });
});
