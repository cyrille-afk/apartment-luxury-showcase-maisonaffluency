import { describe, expect, it } from "vitest";
import { toOgImage } from "@/lib/ogImage";

describe("toOgImage", () => {
  it("routes third-party photos through Cloudinary at 1200×630 JPEG", () => {
    expect(toOgImage("https://cdn.moooi.com/a.jpg")).toBe(
      "https://res.cloudinary.com/dif1oamtj/image/fetch/w_1200,h_630,c_fill,q_auto:good,f_jpg/https://cdn.moooi.com/a.jpg",
    );
  });
  it("encodes third-party photo links that carry parameters", () => {
    expect(toOgImage("https://x.com/i?q=1&s")).toContain("f_jpg/https%3A%2F%2Fx.com%2Fi%3Fq%3D1%26s");
  });
});
