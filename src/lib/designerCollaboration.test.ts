import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { attributedDesignerPicksQueryOptions, designerQueryOptions } from "@/hooks/useDesigner";
import { creditsDesigner } from "./designerCollaboration";

describe("Collaborative designer portfolio", () => {
  it("matches exact collaborators without adding similarly named designers", () => {
    const pick = { edition: "Michel Amar x Emma Donnersberg" };
    expect(creditsDesigner(pick, "Emma Donnersberg")).toBe(true);
    expect(creditsDesigner(pick, "Michel Amar")).toBe(true);
    expect(creditsDesigner(pick, "Emma")).toBe(false);
    expect(creditsDesigner({ edition: "Emma Donnersberg Edition" }, "Emma Donnersberg")).toBe(false);
    expect(creditsDesigner({ title: "Mushroom by Emma Donnersberg" }, "Emma Donnersberg")).toBe(true);
  });

  for (const publicOnly of [true, false]) {
    for (const title of ["Puzzle Console", "Puzzle Dining Table", "Canyon Console"]) {
      it(`includes ${title} in Emma's ${publicOnly ? "Public" : "Trade"} picks without changing ownership`, async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        try {
          const designer = await client.fetchQuery(designerQueryOptions("emma-donnersberg"));
          expect(designer).not.toBeNull();
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