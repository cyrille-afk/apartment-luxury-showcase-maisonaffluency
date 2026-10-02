import { describe, expect, it } from "vitest";
import { galleryAlternatives } from "./galleryAlternatives";

const item = (id: string, title: string, subcategory: string, brand_name = "Other", subtitle = "") => ({ id, title, category: "Décor", subcategory, brand_name, subtitle, image_url: "/photo.jpg" });

describe("gallery hotspot alternatives", () => {
  it("offers the wall artist's other Diasec works and then wall mirrors, not general décor", () => {
    const source = item("orsay", "Orsay Abstract", "Decorative Objects", "Steph GC", "Diasec on Aluminium");
    const picks = [source, item("vase", "Vase", "Decorative Objects"), item("miro", "Homage to Miro", "Decorative Objects", "Steph GC", "Diasec on Aluminium"), item("kiko", "Shadow Drawings Mirror", "Mirrors", "Kiko Lopez"), item("entrelacs", "Hublot Mirror", "Mirrors", "Entrelacs")];
    expect(galleryAlternatives("Orsay Abstract Diasec", source, picks).map((pick) => pick.id)).toEqual(["miro", "kiko", "entrelacs"]);
  });

  it("never suggests bar or counter stools for a low stool", () => {
    const source = item("x", "X Stool 1934", "Ottomans & Stools");
    const picks = [source, item("bar", "Byron Bar Stool", "Ottomans & Stools"), item("chair", "Circle Bar Chair with Armrests", "Ottomans & Stools"), item("low", "Clam Stool, 1944", "Ottomans & Stools"), item("counter", "Park Place Bar/Counter Stool", "Ottomans & Stools")];
    expect(galleryAlternatives("X Stool 1934", source, picks).map((pick) => pick.id)).toEqual(["low"]);
  });

  it("never suggests table lights for a floor lamp, even when the mapped source category is wrong", () => {
    const source = item("floor", "Vallauris Floor Lamp", "Table Lights");
    const picks = [source, item("table", "Boule Table Lamp", "Table Lights"), item("floor2", "Venus Floor Lamp", "Floor Lights"), item("bad", "Socle Table Lamp", "Floor Lights")];
    expect(galleryAlternatives("Custom Blue Glazed Vallauris Floor Lamp", source, picks).map((pick) => pick.id)).toEqual(["floor2"]);
  });
});