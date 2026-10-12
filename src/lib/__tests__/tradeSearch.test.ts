import { describe, expect, it } from "vitest";
import { searchMatches } from "../tradeSearch";
import type { TradeProduct } from "@/lib/tradeProducts";

const base: TradeProduct = {
  id: "tp-1",
  brand_name: "CC-Tapis Edition - Cristián Mohaded",
  product_name: "Fuga Scene 1",
  category: "Rugs",
  tags: ["fuga collection"],
  edition: "CC-Tapis Edition",
  materials: "100% Himalayan wool",
  image_url: null,
};

const make = (over: Partial<TradeProduct>): TradeProduct => ({ ...base, ...over });

describe("searchMatches — Trade Gallery search", () => {
  it("matches by title", () => {
    expect(searchMatches(make({}), "fuga scene")).toBe(true);
  });

  it("matches by designer", () => {
    expect(searchMatches(make({}), "mohaded")).toBe(true);
  });

  it("matches by collection/edition", () => {
    expect(searchMatches(make({}), "cc-tapis")).toBe(true);
    expect(searchMatches(make({}), "fuga collection")).toBe(true);
  });

  it("requires every token to match (AND semantics)", () => {
    expect(searchMatches(make({}), "fuga scene")).toBe(true);
    expect(searchMatches(make({}), "fuga sofa")).toBe(false);
  });

  it("is order-independent across fields", () => {
    expect(searchMatches(make({}), "scene cristian")).toBe(true);
  });

  it("does not cross-match unrelated products", () => {
    expect(searchMatches(make({}), "mushroom")).toBe(false);
  });

  it("empty query matches everything", () => {
    expect(searchMatches(make({}), "")).toBe(true);
    expect(searchMatches(make({}), "   ")).toBe(true);
  });

  it("matches materials and description text", () => {
    expect(searchMatches(make({}), "wool")).toBe(true);
    expect(searchMatches(make({ product_name: "Solare", materials_description: "Travertine side table" }), "travertine")).toBe(true);
  });

  it("matches credited re-edition house", () => {
    expect(searchMatches(make({ reedition_by: "Ecart" }), "ecart")).toBe(true);
  });
});
