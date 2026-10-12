import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { attributedDesignerPicksQueryOptions, designerQueryOptions } from "@/hooks/useDesigner";
import { creditsDesigner } from "./designerCollaboration";

describe("Collaborative designer portfolio", () => {
  it("keeps Emma's profile inaccessible to public visitors while Trade-only", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    try {
      expect(await client.fetchQuery(designerQueryOptions("emma-donnersberg"))).toBeNull();
    } finally {
      client.clear();
    }
  });
  it("matches exact collaborators without adding similarly named designers", () => {
    const pick = { edition: "Michel Amar x Emma Donnersberg" };
    expect(creditsDesigner(pick, "Emma Donnersberg")).toBe(true);
    expect(creditsDesigner(pick, "Michel Amar")).toBe(true);
    expect(creditsDesigner(pick, "Emma")).toBe(false);
    expect(creditsDesigner({ edition: "Emma Donnersberg Edition" }, "Emma Donnersberg")).toBe(false);
    expect(creditsDesigner({ title: "Mushroom by Emma Donnersberg" }, "Emma Donnersberg")).toBe(true);
  });

  for (const publicOnly of [true]) {
    for (const title of ["Puzzle Console", "Puzzle Dining Table", "Canyon Console"]) {
      it(`includes ${title} in Emma's ${publicOnly ? "Public" : "Trade"} picks without changing ownership`, async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        try {
          const designer = {
            id: "eb7741a8-2b2c-4619-9746-37d2cfda0ec8", name: "Emma Donnersberg", slug: "emma-donnersberg",
            founder: null, display_name: null, specialty: "", biography: "", notable_works: "", philosophy: "",
            image_url: "", hero_image_url: null, hero_photo_credit: null, logo_url: null, source: "",
            links: [], biography_images: [], is_published: true, trade_only: true, sort_order: 0,
            new_in_order: null, collab_brands: null,
          };
          const picks = await client.fetchQuery(attributedDesignerPicksQueryOptions(designer, publicOnly));
          const matches = picks.filter((pick) => pick.title === title);
          expect(matches).toHaveLength(1);
          expect(matches[0].designer_id).toBe("27ec2534-5f58-4294-b2e7-5bacf8b796d6");
          expect(matches[0].designer_slug).toBe("michel-amar-studio");
          expect(matches[0].edition).toBe("Michel Amar x Emma Donnersberg");
          if (publicOnly) expect(matches[0].trade_price_cents).toBeNull();
        } finally {
          client.clear();
        }
      });
    }
  }
});