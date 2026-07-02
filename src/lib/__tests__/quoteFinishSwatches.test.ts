import { describe, expect, it } from "vitest";
import { findQuoteFinishSwatch, findQuoteFinishSwatches } from "../quoteFinishSwatches";

const alineas = [
  { fabric_id: "kyknos", name: "Kyknos", image_url: "kyknos.png", sort_order: 1 },
  { fabric_id: "travertino-silver", name: "Travertino Silver", image_url: "travertino-silver.png", sort_order: 7 },
  { fabric_id: "port", name: "Port Saint Laurent", image_url: "port.png", sort_order: 6 },
  { fabric_id: "rosso", name: "Rosso Lepanto", image_url: "rosso.png", sort_order: 8 },
];

describe("quote finish swatch resolution", () => {
  it("uses the clicked swatch label before the slash-joined price bundle", () => {
    const swatch = findQuoteFinishSwatch([
      "Port Saint Laurent",
      "Port Saint Laurent / Travertino Silver / Rosso Lepanto",
    ], alineas);

    expect(swatch?.name).toBe("Port Saint Laurent");
    expect(swatch?.image_url).toBe("port.png");
  });

  it("resolves reopened quote labels to the saved finish, not a neighbouring bundle finish", () => {
    const swatches = findQuoteFinishSwatches("Ø 160 × H 75 cm · Port Saint Laurent", alineas);

    expect(swatches).toHaveLength(1);
    expect(swatches[0].name).toBe("Port Saint Laurent");
  });
});