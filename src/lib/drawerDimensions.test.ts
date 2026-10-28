import { describe, expect, it } from "vitest";
import {
  dimensionsFromVariantLabel,
  drawerDimensionsBody,
  formatDrawerDimensions,
} from "./drawerDimensions";

describe("formatDrawerDimensions", () => {
  it("renders the Saint Honoré model label with its dimensions", () => {
    expect(
      formatDrawerDimensions("Saint Honoré 280 | W 280 x D 160 x H 75 cm"),
    ).toBe("Saint Honoré 280: W 280 x D 160 x H 75 cm");
  });

  it("keeps pure dimension labels as-is", () => {
    expect(formatDrawerDimensions("W 240 x D 155 x H 75 cm")).toBe(
      "W 240 x D 155 x H 75 cm",
    );
  });

  it("falls back to product dimensions for non-dimensional labels", () => {
    expect(
      formatDrawerDimensions("Solid Oak", "W 240 x D 155 x H 75 cm"),
    ).toBe("W 240 x D 155 x H 75 cm");
  });

  it("returns null when nothing looks like a dimension", () => {
    expect(formatDrawerDimensions("Solid Oak", "Solid oak frame")).toBeNull();
    expect(formatDrawerDimensions(null, null)).toBeNull();
  });
});

describe("drawerDimensionsBody", () => {
  it("returns the dimensions portion after the model name", () => {
    expect(drawerDimensionsBody("Saint Honoré 280: W 280 x D 160 x H 75 cm")).toBe(
      "W 280 x D 160 x H 75 cm",
    );
    expect(drawerDimensionsBody("W 240 x D 155 x H 75 cm")).toBe(
      "W 240 x D 155 x H 75 cm",
    );
  });
});

describe("dimensionsFromVariantLabel", () => {
  it("finds the sized segment in a stored quote variant label", () => {
    expect(
      dimensionsFromVariantLabel(
        "COM - Customers Own Material · Solid Oak · Saint Honoré 280 | W 280 x D 160 x H 75 cm",
      ),
    ).toBe("Saint Honoré 280: W 280 x D 160 x H 75 cm");
  });

  it("falls back to product dimensions when no segment carries a size", () => {
    expect(
      dimensionsFromVariantLabel("Teddy Mohair · Solid Oak", "W 240 x D 155 x H 75 cm"),
    ).toBe("W 240 x D 155 x H 75 cm");
  });

  it("returns null without any dimension source", () => {
    expect(dimensionsFromVariantLabel("Teddy Mohair", null)).toBeNull();
  });
});
