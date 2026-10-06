import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function communicationFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return communicationFiles(path);
    return /\.(tsx?|txt|html|md|js|py)$/.test(path) ? [path] : [];
  });
}

describe("live communication addresses", () => {
  it("does not use legacy concierge, trade or Cyrille contact addresses", () => {
    const legacy = new RegExp("(?:concierge|trade|cyrille)@" + "myaffluency\\.com", "i");
    const invalid = ["src", "supabase/functions", "public", "scripts"]
      .flatMap(communicationFiles)
      .filter((file) => legacy.test(readFileSync(file, "utf8")));
    expect(invalid).toEqual([]);
  });

  it("publishes the live concierge and trade contacts", () => {
    const contact = readFileSync("src/components/ContactInquiry.tsx", "utf8");
    expect(contact).toContain("mailto:concierge@maisonaffluency.com");
    expect(contact).toContain("mailto:trade@maisonaffluency.com");
  });
});