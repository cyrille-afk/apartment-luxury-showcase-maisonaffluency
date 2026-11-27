import { describe, expect, it } from "vitest";
import { AI_RENDER_DRAFT_KEY, compactAiRenderDraft, compactSavedAiRenderDraft, saveAiRenderDraft } from "./aiRenderDraft";

const sourceImage = "https://example.com/residence-01.png";
const storedUrl = "https://example.com/render.png";
const inlineImage = `data:image/png;base64,${"A".repeat(4_000_000)}`;
const result = { imageUrl: inlineImage, storedUrl, mode: "section_to_axo", text: "Done" };

describe("AI Render Studio draft persistence", () => {
  it("restores an empty room with its exact furnished-render binding after refresh", () => {
    let saved = "";
    const emptyRoomUrl = "https://example.com/empty-room.png";
    saveAiRenderDraft({ setItem: (_key, value) => { saved = value; } },
      { sourceImage, result, emptyRoomUrl, emptyRoomSourceUrl: storedUrl });
    expect(JSON.parse(saved)).toMatchObject({ sourceImage, emptyRoomUrl, emptyRoomSourceUrl: storedUrl });
  });
  it("preserves the source through save/read while replacing duplicated image bytes with cloud links", () => {
    let saved = "";
    saveAiRenderDraft({ setItem: (key, value) => { expect(key).toBe(AI_RENDER_DRAFT_KEY); saved = value; } },
      { sourceImage, result, history: [result], mode: "section_to_axo" });
    expect(JSON.parse(saved)).toMatchObject({ sourceImage, result: { imageUrl: storedUrl }, history: [{ imageUrl: storedUrl }] });
    expect(saved.length).toBeLessThan(1000);
    expect(result.imageUrl).toBe(inlineImage);
  });

  it("omits session-only results and blob/data overlays without dropping the uploaded source", () => {
    const draft = compactAiRenderDraft({ sourceImage, result: { ...result, storedUrl: null },
      history: [{ ...result, storedUrl: null }], overlayImages: [inlineImage, "blob:temporary", storedUrl] });
    expect(draft).toMatchObject({ sourceImage, result: null, history: [], overlayImages: [storedUrl] });
  });

  it("compacts existing legacy drafts before cleanup, preserving bound briefs", () => {
    let saved = JSON.stringify({ sourceImage, activeBriefSourceUrl: sourceImage, activeBrief: { roomType: "Living Room" }, result, history: [result] });
    compactSavedAiRenderDraft({ getItem: () => saved, setItem: (_key, value) => { saved = value; } });
    expect(saved.length).toBeLessThan(1000);
    expect(JSON.parse(saved)).toMatchObject({ sourceImage, activeBriefSourceUrl: sourceImage, activeBrief: { roomType: "Living Room" } });
  });

  it("retains source/settings when quota requires dropping optional history", () => {
    let saved = "";
    saveAiRenderDraft({ setItem: (_key, value) => {
      if (JSON.parse(value).history.length) throw new DOMException("Full", "QuotaExceededError");
      saved = value;
    } }, { sourceImage, mode: "section_to_axo", result, history: [result] });
    expect(JSON.parse(saved)).toMatchObject({ sourceImage, mode: "section_to_axo", result: null, history: [] });
  });
});