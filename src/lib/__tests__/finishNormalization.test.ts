import { describe, it, expect } from "vitest";
import {
  normalizeFinishToken,
  normalizeFinishOption,
  normalizeFinishOptions,
} from "../finishNormalization";

const ALINEA_LIBRARY = [
  "Bianco Statuarietto",
  "Ceppo di Sicilia",
  "Grafite",
  "Grey Saint Laurent",
  "Kyknos",
  "Picasso Green",
  "Port Saint Laurent",
  "Rosso Lepanto",
  "Travertino Rosso",
  "Travertino Silver",
];

describe("normalizeFinishToken", () => {
  it("returns the library spelling for an exact case-insensitive match", () => {
    expect(normalizeFinishToken("grafite", ALINEA_LIBRARY)).toBe("Grafite");
    expect(normalizeFinishToken("  KYKNOS ", ALINEA_LIBRARY)).toBe("Kyknos");
  });

  it("maps the Kynos → Kyknos typo (the Angelo M/R bug)", () => {
    expect(normalizeFinishToken("Kynos", ALINEA_LIBRARY)).toBe("Kyknos");
  });

  it("prefers substring matches to library entries (Bianco → Bianco Statuarietto)", () => {
    expect(normalizeFinishToken("Bianco", ALINEA_LIBRARY)).toBe("Bianco Statuarietto");
  });

  it("returns the input when nothing in the library is close enough", () => {
    expect(normalizeFinishToken("Mithril", ALINEA_LIBRARY)).toBe("Mithril");
    expect(normalizeFinishToken("Unobtanium", ALINEA_LIBRARY)).toBe("Unobtanium");
  });

  it("does not collapse short, semantically distinct finishes", () => {
    // Oak ↔ Ash have edit distance 2 but length 3 → proportional cap is 1.
    expect(normalizeFinishToken("Oak", ["Ash", "Walnut"])).toBe("Oak");
    expect(normalizeFinishToken("Ash", ["Oak", "Walnut"])).toBe("Ash");
  });

  it("returns the input when no library is provided", () => {
    expect(normalizeFinishToken("Kynos", [])).toBe("Kynos");
  });

  it("returns the input unchanged for empty/whitespace tokens", () => {
    expect(normalizeFinishToken("", ALINEA_LIBRARY)).toBe("");
    expect(normalizeFinishToken("   ", ALINEA_LIBRARY)).toBe("   ");
  });
});

describe("normalizeFinishOption (compound labels)", () => {
  it("normalizes each slash-separated part independently", () => {
    expect(
      normalizeFinishOption(
        "Travertino Rosso / Grey Saint Laurent / Picasso Green",
        ALINEA_LIBRARY,
      ),
    ).toBe("Travertino Rosso / Grey Saint Laurent / Picasso Green");
  });

  it("corrects typos inside a compound label", () => {
    expect(
      normalizeFinishOption(
        "Kynos / Grafite / Bianco",
        ALINEA_LIBRARY,
      ),
    ).toBe("Kyknos / Grafite / Bianco Statuarietto");
  });

  it("leaves unknown parts untouched while normalizing known ones", () => {
    expect(
      normalizeFinishOption(
        "Kynos / Mithril",
        ALINEA_LIBRARY,
      ),
    ).toBe("Kyknos / Mithril");
  });

  it("passes through when the library is empty", () => {
    expect(normalizeFinishOption("Kynos", [])).toBe("Kynos");
  });
});

describe("normalizeFinishOptions (list-level dedupe)", () => {
  it("collapses post-normalization duplicates (first-seen casing wins)", () => {
    const out = normalizeFinishOptions(
      ["Kynos", "Kyknos", "Grafite", "grafite", "Bianco"],
      ALINEA_LIBRARY,
    );
    expect(out).toEqual(["Kyknos", "Grafite", "Bianco Statuarietto"]);
  });

  it("preserves order of first appearance", () => {
    expect(
      normalizeFinishOptions(["Grafite", "Kynos", "Picasso Green"], ALINEA_LIBRARY),
    ).toEqual(["Grafite", "Kyknos", "Picasso Green"]);
  });

  it("returns a copy of the input when the library is empty", () => {
    const input = ["Kynos", "Grafite"];
    const out = normalizeFinishOptions(input, []);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("ignores empty strings", () => {
    expect(
      normalizeFinishOptions(["", "  ", "Kynos"], ALINEA_LIBRARY),
    ).toEqual(["Kyknos"]);
  });
});
