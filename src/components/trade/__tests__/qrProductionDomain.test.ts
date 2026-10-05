import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROD = "https://maisonaffluency.com";
const FORBIDDEN = [
  /window\.location\.origin/,
  /location\.origin/,
  /lovable\.(dev|app)/i,
  /lovableproject\.com/i,
  /id-preview--/i,
  /localhost/i,
  /127\.0\.0\.1/,
];

const QR_FILES = [
  "src/components/trade/PwaInstall.tsx",
  "src/components/trade/MobileHandoffWidget.tsx",
  "src/components/trade/InstallNativeAppCard.tsx",
  "src/components/trade/MobileContinuityBanner.tsx",
  "src/components/trade/SyncToMobileButton.tsx",
  "supabase/functions/trade-mobile-magic-link/index.ts",
];

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Trade dashboard QR codes are production-locked", () => {
  for (const file of QR_FILES) {
    describe(file, () => {
      const src = read(file);
      it("references the production domain", () => {
        expect(src).toContain(PROD);
      });
      for (const pattern of FORBIDDEN) {
        it(`never contains ${pattern}`, () => {
          expect(src).not.toMatch(pattern);
        });
      }
    });
  }

  it("magic-link handoff builds /trade/launch on the production origin", () => {
    const src = read("supabase/functions/trade-mobile-magic-link/index.ts");
    expect(src).toMatch(/const PRODUCTION_ORIGIN = "https:\/\/maisonaffluency\.com"/);
    expect(src).toMatch(/new URL\("\/trade\/launch", PRODUCTION_ORIGIN\)/);
  });
});
