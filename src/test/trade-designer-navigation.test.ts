import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

describe("trade designer navigation", () => {
  it("routes every trade product-page designer link to the canonical gallery", () => {
    const source = fs.readFileSync(path.join(projectRoot, "src/pages/TradeProductPage.tsx"), "utf8");

    expect(source.match(/`\/trade\/gallery\/\$\{designer\.slug\}`/g)).toHaveLength(3);
    expect(source).not.toContain("`/trade/designers/${designer.slug}`");
  });

  it("redirects the legacy trade designer route to the canonical gallery", () => {
    const source = fs.readFileSync(path.join(projectRoot, "src/App.tsx"), "utf8");

    expect(source).toContain('path="designers/:slug" element={<LegacyTradeDesignerRedirect />}');
    expect(source).toContain("`/trade/gallery/${slug}${search}`");
  });
});