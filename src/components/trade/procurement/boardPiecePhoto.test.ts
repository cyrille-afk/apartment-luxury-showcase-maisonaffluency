import { expect, it } from "vitest";
import { boardPiecePhoto } from "./boardPiecePhoto";

it("keeps Ibo's approved catalogue shape instead of a finish-only round-table photo", () => {
  const catalogue = "https://res.cloudinary.com/dif1oamtj/image/upload/v1781002991/Ibo-1_2200x2200_mun3m4.jpg";
  const roundWalnut = "https://res.cloudinary.com/dif1oamtj/image/upload/v1776933706/Ibo-7_kawujv.jpg";
  expect(boardPiecePhoto("fd8c2682-d8a1-48fe-b110-d22209cbcce7", catalogue, roundWalnut)).toBe(catalogue);
});

it("does not substitute an unidentified Ibo shape when the catalogue photo is missing", () => {
  expect(boardPiecePhoto("fd8c2682-d8a1-48fe-b110-d22209cbcce7", null, "round-walnut.jpg")).toBeNull();
});

it("preserves other pieces' selected finish photos", () => {
  expect(boardPiecePhoto("another-piece", "catalogue.jpg", "finish.jpg")).toBe("finish.jpg");
});