import { describe, expect, it } from "vitest";
import { getDesignerOpenGraph } from "../designerOpenGraph";
import emmaHero from "@/assets/og/emma-donnersberg-hero-og.jpg.asset.json";

describe("designer share image contract", () => {
  it("uses a real absolute www-hosted JPEG asset, not the homepage", () => {
    const meta = getDesignerOpenGraph({ slug: "emma-donnersberg", name: "Emma Donnersberg", description: "", heroImage: "https://example.com/portrait.png" });
    const image = new URL(meta.image);
    expect(image.origin).toBe("https://www.maisonaffluency.com");
    expect(image.pathname).toBe(emmaHero.url);
    expect(image.pathname.endsWith(".jpg")).toBe(true);
    expect(meta.imageType).toBe("image/jpeg");
  });

  it("keeps Emma's actual uploaded JPEG below the WhatsApp payload limit", () => {
    expect(emmaHero.size).toBeGreaterThan(0);
    expect(emmaHero.size).toBeLessThan(300000);
    expect(emmaHero.content_type).toBe("image/jpeg");
  });

  it("resolves other designers from their active hero without leaking Emma's asset", () => {
    const meta = getDesignerOpenGraph({ slug: "other-designer", name: "Other Designer", description: "", heroImage: "https://res.cloudinary.com/example/image/upload/v1/room.jpg" });
    expect(meta.image).toContain("/w_1200,h_630,c_fill,q_auto:best,f_jpg/");
    expect(meta.url).toBe("https://www.maisonaffluency.com/designers/other-designer");
    expect(meta.image).not.toBe(getDesignerOpenGraph({ slug: "emma-donnersberg", name: "Emma Donnersberg", description: "" }).image);
  });
});