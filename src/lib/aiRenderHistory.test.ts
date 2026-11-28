import { describe, expect, it } from "vitest";
import {
  buildImageStudioHref,
  extractRestorePayload,
  parseRenderMetadata,
  filterRenderHistoryByScope,
  resolveComparePair,
  toggleCompareSelection,
  type AiRenderHistoryEntry,
} from "./aiRenderHistory";

const makeEntry = (overrides: Partial<AiRenderHistoryEntry> = {}): AiRenderHistoryEntry => ({
  id: "11111111-1111-4111-8111-111111111111",
  created_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  project_id: "f6068253-c046-44f6-a29d-2efe2fedfb31",
  project_name: "Cipriani Miami",
  proposal_id: null,
  request_id: null,
  source_image_url: "https://example.com/plan.png",
  result_image_url: "https://example.com/render-1.png",
  mode: "elevation_to_axo",
  style_preset: "Photorealistic",
  style_prompt: "photorealistic architectural rendering",
  quality_tier: "premium",
  prompt_note: "Warm evening lighting",
  kind: "generation",
  metadata: {
    activeBrief: { roomType: "Living Room" },
    overlayImages: ["https://example.com/sofa.png"],
    lightingStrength: 65,
    text: "Rendered in photorealistic mode",
  },
  created_at: "2026-11-25T01:00:00.000Z",
  ...overrides,
});

describe("aiRenderHistory", () => {
  it("retains eye-level camera, shell and exact finish references on history restore", () => {
    const metadata = parseRenderMetadata({ proposalLayoutUrl: "https://example.com/plan.png", proposalDraft: { sourceKey: "room", view: "eye-level", camera: { position: { x: 20, y: 80 }, target: { x: 40, y: 20 } }, shellUrl: "https://example.com/shell.png", eyeLevelResult: "https://example.com/eye.png", products: [{ id: "table", product_name: "Praia da Granja", brand_name: "Man of Parts", image_url: "https://example.com/table.png", selected_finishes: [{ axis: "Tabletop", name: "Selected stone", image_url: "https://example.com/stone.png" }] }] } });
    expect(metadata.proposalDraft?.camera?.position).toEqual({ x: 20, y: 80 });
    expect(metadata.proposalDraft?.products[0]?.selected_finishes?.[0]?.name).toBe("Selected stone");
    expect(metadata.proposalDraft?.eyeLevelResult).toBe("https://example.com/eye.png");
    expect(metadata.proposalLayoutUrl).toBe("https://example.com/plan.png");
  });
  it("filters render history strictly by project, unassigned, or all", () => {
    const a = makeEntry({ id: "a", project_id: "f6068253-c046-44f6-a29d-2efe2fedfb31" });
    const b = makeEntry({ id: "b", project_id: "646c5957-65f0-4fc5-a41c-837fa5b83767", project_name: "37A" });
    const c = makeEntry({ id: "c", project_id: null, project_name: null });
    const list = [a, b, c];

    expect(filterRenderHistoryByScope(list, "all").map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(filterRenderHistoryByScope(list, "f6068253-c046-44f6-a29d-2efe2fedfb31").map((x) => x.id)).toEqual(["a"]);
    expect(filterRenderHistoryByScope(list, "unassigned").map((x) => x.id)).toEqual(["c"]);
  });

  it("toggles comparison selection up to two distinct renders and advances on a third", () => {
    let sel: string[] = [];
    sel = toggleCompareSelection(sel, "r1");
    expect(sel).toEqual(["r1"]);
    sel = toggleCompareSelection(sel, "r2");
    expect(sel).toEqual(["r1", "r2"]);
    sel = toggleCompareSelection(sel, "r3");
    expect(sel).toEqual(["r2", "r3"]);
    sel = toggleCompareSelection(sel, "r2");
    expect(sel).toEqual(["r3"]);
  });

  it("resolves a compare pair only when two distinct saved entries match", () => {
    const a = makeEntry({ id: "r1" });
    const b = makeEntry({ id: "r2" });
    expect(resolveComparePair([a, b], ["r1"])).toBeNull();
    expect(resolveComparePair([a, b], ["r1", "r1"])).toBeNull();
    expect(resolveComparePair([a, b], ["r1", "missing"])).toBeNull();
    const pair = resolveComparePair([a, b], ["r1", "r2"]);
    expect(pair?.[0].id).toBe("r1");
    expect(pair?.[1].id).toBe("r2");
  });

  it("restores full studio settings when reopening a historical render", () => {
    const entry = makeEntry({
      mode: "stylize",
      style_prompt: "watercolor prompt",
      quality_tier: "draft",
      source_image_url: "https://example.com/elevation.png",
      result_image_url: "https://example.com/axo.png",
    });
    const restored = extractRestorePayload(entry, "fallback-style");
    expect(restored.projectId).toBe("f6068253-c046-44f6-a29d-2efe2fedfb31");
    expect(restored.sourceImage).toBe("https://example.com/elevation.png");
    expect(restored.resultImageUrl).toBe("https://example.com/axo.png");
    expect(restored.mode).toBe("stylize");
    expect(restored.stylePrompt).toBe("watercolor prompt");
    expect(restored.qualityTier).toBe("draft");
    expect(restored.overlayImages).toEqual(["https://example.com/sofa.png"]);
    expect(restored.lightingStrength).toBe(65);
  });

  it("falls back safely when reopening an AI edit entry with a non-studio mode", () => {
    const entry = makeEntry({
      mode: "product_swap",
      style_prompt: null,
      source_image_url: null,
      metadata: {},
    });
    const restored = extractRestorePayload(entry, "default-style");
    expect(restored.mode).toBe("elevation_to_axo");
    expect(restored.stylePrompt).toBe("default-style");
    expect(restored.sourceImage).toBe(entry.result_image_url);
  });

  it("builds Image Studio links carrying valid project and proposal UUIDs while omitting sandbox", () => {
    expect(buildImageStudioHref({ projectId: "sandbox" })).toBe("/tools/ai-render-studio");
    expect(buildImageStudioHref({ projectId: "f6068253-c046-44f6-a29d-2efe2fedfb31" })).toBe(
      "/tools/ai-render-studio?project=f6068253-c046-44f6-a29d-2efe2fedfb31",
    );
    expect(
      buildImageStudioHref({
        proposalId: "11111111-1111-4111-8111-111111111111",
        projectId: "f6068253-c046-44f6-a29d-2efe2fedfb31",
      }),
    ).toBe(
      "/tools/ai-render-studio?proposalId=11111111-1111-4111-8111-111111111111&project=f6068253-c046-44f6-a29d-2efe2fedfb31",
    );
  });
});