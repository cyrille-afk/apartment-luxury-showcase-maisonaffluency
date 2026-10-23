import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * The header TRADE link carries a "PRO" micro-capsule (mem://preferences/trade-pro-badge).
 * It must sit inline beside the word — never floating above it — and must not grow the
 * navbar's line box, so every desktop nav row keeps one shared vertical centre.
 * Guest state only: an approved trade partner sees "Trade Dashboard" with no capsule.
 */
test.use({ trace: "off", video: "off", reducedMotion: "reduce" });

type PillGeometry = {
  position: string;
  pillCentre: number;
  pillLeft: number;
  pillHeight: number;
  labelCentre: number;
  labelHeight: number;
  labelTextRight: number;
};

async function measurePill(button: Locator): Promise<PillGeometry | null> {
  return button.evaluate((root) => {
    const pill = Array.from(root.querySelectorAll("span")).find(
      (s) => s.textContent.trim() === "PRO" && s.getBoundingClientRect().width > 0,
    );
    if (!pill) return null;

    // Line box: the desktop link keeps its own underline span; the mobile accordion row
    // wraps label + capsule in a flex span.
    const line = (root.querySelector(".link-underline-grow") as HTMLElement | null) ?? pill.parentElement;
    if (!line) return null;

    // The label's own glyph box, so "beside the word" cannot be satisfied by the wrapper.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let labelNode: Text | null = null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? "").trim();
      if (text && text !== "PRO") {
        labelNode = node as Text;
        break;
      }
    }
    if (!labelNode) return null;
    const range = document.createRange();
    range.selectNode(labelNode);
    const labelGlyphs = range.getBoundingClientRect();
    const labelLine = line.getBoundingClientRect();
    const pillBox = pill.getBoundingClientRect();

    return {
      position: getComputedStyle(pill).position,
      pillCentre: (pillBox.top + pillBox.bottom) / 2,
      pillLeft: pillBox.left,
      pillHeight: pillBox.height,
      labelCentre: (labelLine.top + labelLine.bottom) / 2,
      labelHeight: labelLine.height,
      labelTextRight: labelGlyphs.right,
    };
  });
}

test.describe("TRADE link PRO capsule", () => {
  test("sits inline on the same line as the word, centred, on every nav row", async ({
    page,
  }) => {
    const width = page.viewportSize()?.width ?? 1280;
    await page.goto("/", { waitUntil: "domcontentloaded" });

    if (width < 768) {
      // Mobile drawer: the accordion row must carry the same inline capsule.
      await page.locator('button[aria-label="Toggle menu"]').first().click();
      const accordion = page
        .locator("button")
        .filter({ hasText: /^Trade\s*PRO$/ })
        .last();
      await expect(accordion).toBeVisible();
      await accordion.click();

      const geometry = await measurePill(accordion);
      expect(geometry).not.toBeNull();
      expect(geometry!.position).toBe("static");
      expect(geometry!.pillCentre).toBeCloseTo(geometry!.labelCentre, 0);
      expect(geometry!.pillLeft).toBeGreaterThanOrEqual(geometry!.labelTextRight - 0.5);
      expect(geometry!.pillHeight).toBeLessThanOrEqual(geometry!.labelHeight);
      return;
    }

    const trade = page.locator("[data-utility-trade]");
    await expect(trade).toBeVisible();

    const geometry = await measurePill(trade);
    expect(geometry).not.toBeNull();
    // No absolute-positioned capsule floating above the word.
    expect(geometry!.position).toBe("static");
    // Same line as the word, vertically centred with it.
    expect(geometry!.pillCentre).toBeCloseTo(geometry!.labelCentre, 0);
    expect(geometry!.pillLeft).toBeGreaterThanOrEqual(geometry!.labelTextRight - 0.5);
    // Capsule never taller than the word's line box, so the navbar rows stay balanced.
    expect(geometry!.pillHeight).toBeLessThanOrEqual(geometry!.labelHeight);

    // Line-height balance across the desktop navbar: the wordmark shares the TRADE link's
    // centre, and the primary category links share one centre of their own.
    const centres = await page.evaluate(() => {
      const centre = (el: Element) => {
        const box = el.getBoundingClientRect();
        return (box.top + box.bottom) / 2;
      };
      const word = Array.from(document.querySelectorAll("span")).find(
        (s) => s.textContent.trim() === "MAISON AFFLUENCY",
      );
      const rowLink = (label: string) =>
        Array.from(document.querySelectorAll("button, a")).find(
          (el) => el.textContent?.trim() === label,
        );
      const row = ["Our Gallery", "Designers", "Journal"]
        .map((label) => rowLink(label))
        .filter((el): el is Element => Boolean(el))
        .map(centre);
      return {
        wordmark: word ? centre(word) : null,
        row: row.length === 3 ? row : null,
        trade: centre(document.querySelector("[data-utility-trade]") as Element),
      };
    });

    expect(centres.wordmark).not.toBeNull();
    expect(centres.trade).toBeCloseTo(centres.wordmark!, 0);
    expect(centres.row).not.toBeNull();
    const [first, second, third] = centres.row!;
    expect(second).toBeCloseTo(first, 0);
    expect(third).toBeCloseTo(first, 0);
  });
});
