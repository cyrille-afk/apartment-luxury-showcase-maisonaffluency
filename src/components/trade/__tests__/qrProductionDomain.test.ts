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

  // Client-facing share links (quote share, guest payment) must never be built
  // from window.location.origin — the preview origin is useless to recipients.
  const SHARE_LINK_FILES = [
    "src/components/trade/ShareQuoteWithClient.tsx",
    "src/components/trade/GuestPayLinkCard.tsx",
  ];
  for (const file of SHARE_LINK_FILES) {
    describe(file, () => {
      const src = read(file);
      it("builds links from PRODUCTION_ORIGIN", () => {
        expect(src).toContain("PRODUCTION_ORIGIN");
      });
      it("never builds a link from window.location.origin", () => {
        expect(src).not.toMatch(/`\$\{window\.location\.origin\}/);
      });
    });
  }

  it("magic-link handoff builds /trade/launch on the production origin", () => {
    const src = read("supabase/functions/trade-mobile-magic-link/index.ts");
    expect(src).toMatch(/const PRODUCTION_ORIGIN = "https:\/\/maisonaffluency\.com"/);
    expect(src).toMatch(/new URL\("\/trade\/launch", PRODUCTION_ORIGIN\)/);
    // The CORS allowlist may name preview hosts; the URL builder itself must not.
    const start = src.indexOf("function buildHandoffUrl");
    const end = src.indexOf("\n}\n", start);
    const body = src.slice(start, end);
    expect(body.length).toBeGreaterThan(0);
    for (const pattern of FORBIDDEN) expect(body).not.toMatch(pattern);
  });
});

// Recipient-facing board links — the invitation email preview, the copy-share
// button and the rotated link — must be production-locked too: a client given a
// sandbox host (id-preview--*.lovable.app) has nothing to open.
const BOARD_LINK_FILES = [
  "src/components/trade/procurement/BoardInviteEmailPreview.tsx",
  "src/pages/TradeBoardBuilder.tsx",
  "src/pages/TradeBoards.tsx",
];

describe("Board share links are production-locked", () => {
  for (const file of BOARD_LINK_FILES) {
    describe(file, () => {
      const src = read(file);
      it("builds the link through absoluteUrl from @/config/site", () => {
        expect(src).toContain('from "@/config/site"');
        expect(src).toMatch(/absoluteUrl\(/);
      });
      for (const pattern of FORBIDDEN) {
        it(`never contains ${pattern}`, () => {
          expect(src).not.toMatch(pattern);
        });
      }
    });
  }

  it("sends the real board invitation on the production domain", () => {
    const src = read("supabase/functions/send-transactional-email/index.ts");
    const link = src.match(/link: `([^`]*shared\/board[^`]*)`/)?.[1] ?? "";
    expect(link).toBe("https://www.maisonaffluency.com/shared/board/${slug || token}");
  });
});
