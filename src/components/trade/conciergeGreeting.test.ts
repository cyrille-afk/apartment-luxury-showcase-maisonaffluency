import { describe, it, expect, beforeEach } from "vitest";
import {
  stageFromPath,
  greetingForContext,
  DEFAULT_GREETING,
  type Stage,
} from "./conciergeGreeting";

describe("stageFromPath", () => {
  const cases: Array<[string, Stage]> = [
    ["/trade/quotes/123", "Quote"],
    ["/trade/projects/abc/quote/9", "Quote"],
    ["/trade/mood-boards?project=x", "Tearsheet"],
    ["/trade/tearsheets/1", "Tearsheet"],
    ["/trade/boards/1", "Tearsheet"],
    ["/trade/orders/5", "Order"],
    ["/trade/order/5", "Order"],
    ["/trade/projects/abc", "Project"],
    ["/trade", "Discover"],
    ["/trade/dashboard", "Discover"],
  ];
  it.each(cases)("maps %s -> %s", (pathname, expected) => {
    expect(stageFromPath(pathname)).toBe(expected);
  });
});

describe("greetingForContext", () => {
  it("returns mood board opener on /trade/mood-boards", () => {
    const msg = greetingForContext("Tearsheet", "/trade/mood-boards?project=x");
    expect(msg).toMatch(/^Allow me to help you fine-tune your mood board/);
  });

  it("returns tearsheet opener on /trade/tearsheets", () => {
    const msg = greetingForContext("Tearsheet", "/trade/tearsheets/1");
    expect(msg).toMatch(/^Allow me to help you shape this tearsheet/);
  });

  it("returns tearsheet opener on /trade/boards", () => {
    const msg = greetingForContext("Tearsheet", "/trade/boards/1");
    expect(msg).toMatch(/^Allow me to help you shape this tearsheet/);
  });

  it("returns quote opener for Quote stage", () => {
    const msg = greetingForContext("Quote", "/trade/quotes/9");
    expect(msg).toMatch(/^Allow me to help you refine this quote/);
  });

  it("returns order opener for Order stage", () => {
    const msg = greetingForContext("Order", "/trade/orders/9");
    expect(msg).toMatch(/^Allow me to help you follow this order/);
  });

  it("returns project opener for Project stage", () => {
    const msg = greetingForContext("Project", "/trade/projects/abc");
    expect(msg).toMatch(/^Allow me to help you advance this project/);
  });

  it("falls back to discover greeting for Discover stage", () => {
    expect(greetingForContext("Discover", "/trade/dashboard")).toBe(DEFAULT_GREETING);
  });

  it("uses consistent 'Allow me to help' phrasing across all stages", () => {
    const samples: Array<[Stage, string]> = [
      ["Tearsheet", "/trade/mood-boards"],
      ["Tearsheet", "/trade/tearsheets/1"],
      ["Quote", "/trade/quotes/1"],
      ["Order", "/trade/orders/1"],
      ["Project", "/trade/projects/1"],
      ["Discover", "/trade/dashboard"],
    ];
    for (const [stage, path] of samples) {
      expect(greetingForContext(stage, path)).toMatch(/^Allow me to help/);
    }
  });

  it("composes correctly when stageFromPath feeds greetingForContext", () => {
    const path = "/trade/mood-boards?project=x";
    expect(greetingForContext(stageFromPath(path), path)).toMatch(/mood board/);
  });
});

import { TONES, toneSystemNote, type Tone } from "./conciergeGreeting";

describe("tone selector", () => {
  const path = "/trade/mood-boards";
  it("returns a distinct opener for each tone on the same intent", () => {
    const seen = new Set<string>();
    for (const t of TONES) {
      const msg = greetingForContext("Tearsheet", path, t.id);
      expect(msg).toBeTruthy();
      seen.add(msg);
    }
    expect(seen.size).toBe(TONES.length);
  });

  it("preserves intent (mentions mood board) across all tones", () => {
    for (const t of TONES) {
      expect(greetingForContext("Tearsheet", path, t.id).toLowerCase()).toMatch(/mood board|board/);
    }
  });

  it("emits a style note per tone for the model", () => {
    const tones: Tone[] = ["formal", "luxury", "concise", "designer"];
    for (const t of tones) {
      expect(toneSystemNote(t)).toMatch(/\[Style\]/);
    }
    expect(toneSystemNote("concise")).toMatch(/concise/i);
    expect(toneSystemNote("formal")).toMatch(/formal/i);
    expect(toneSystemNote("designer")).toMatch(/designer|peer/i);
    expect(toneSystemNote("luxury")).toMatch(/editorial|atelier/i);
  });

  it("falls back to default tone gracefully", () => {
    // @ts-expect-error invalid tone
    const msg = greetingForContext("Discover", "/trade", "nonsense");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });
});

import { LANGUAGES, loadLang, saveLang, tonesFor, type Lang } from "./conciergeGreeting";

describe("language selector", () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });

  it("returns an Indonesian greeting when lang=id", () => {
    const msg = greetingForContext("Tearsheet", "/trade/mood-boards", "luxury", "id");
    expect(msg).toMatch(/Izinkan saya/);
  });

  it("returns a Thai greeting when lang=th", () => {
    const msg = greetingForContext("Quote", "/trade/quotes/1", "luxury", "th");
    expect(msg).toMatch(/อนุญาต/);
  });

  it("returns a Simplified Chinese greeting when lang=zh", () => {
    const msg = greetingForContext("Order", "/trade/orders/1", "luxury", "zh");
    expect(msg).toMatch(/请允许/);
  });

  it("falls back to luxury in same language when tone unavailable", () => {
    // Indonesian only translates 'luxury'; concise should fall back to id+luxury
    const concise = greetingForContext("Tearsheet", "/trade/mood-boards", "concise", "id");
    const luxury = greetingForContext("Tearsheet", "/trade/mood-boards", "luxury", "id");
    expect(concise).toBe(luxury);
  });

  it("falls back to English when lang missing entirely", () => {
    // @ts-expect-error invalid lang
    const msg = greetingForContext("Discover", "/trade", "luxury", "ja");
    expect(msg).toMatch(/Allow me to help/);
  });

  it("persists and reloads lang via localStorage", () => {
    saveLang("id");
    expect(loadLang()).toBe("id");
  });

  it("exposes localized tone labels via tonesFor", () => {
    const id = tonesFor("id");
    expect(id.find((t) => t.id === "formal")?.label).toBe("Formal");
    const en = tonesFor("en");
    expect(en.find((t) => t.id === "formal")?.label).toBe("Formal");
  });

  it("toneSystemNote includes a Language directive", () => {
    const langs: Lang[] = ["en", "id", "th", "zh"];
    for (const l of langs) {
      const note = toneSystemNote("luxury", l);
      expect(note).toMatch(/^\[Language\]/);
      expect(note).toMatch(/\[Style\]/);
    }
  });

  it("ships the supported concierge languages", () => {
    expect(LANGUAGES.map((l) => l.id).sort()).toEqual(["en", "id", "th", "zh"]);
  });
});
