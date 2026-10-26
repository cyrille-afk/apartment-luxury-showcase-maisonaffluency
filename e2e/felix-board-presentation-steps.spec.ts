import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

// Steps 12–16: Studio Portfolio Management → board collaboration → branding →
// white-label → invite. Verifies the sidebar references name each feature's
// real navigation path, the required-action banner reads in line with the
// highlighted toggle, and the top-right Client Editorial Presentation switch
// stays outlined while the sidebar is hidden.
test("tour steps 12-16: sidebar refs, transition copy and presentation-mode highlight", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-only tour.");
  test.skip(!session || !storageKey, "Requires a managed Trade session.");
  if (!session || !storageKey) return;
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.removeItem("felix_dashboard_tour_seen_v1");
    localStorage.setItem("felix_tour_progress_v1", "9");
    localStorage.setItem("trade_quick_tour_done", "1");
    localStorage.removeItem("trade_quick_tour_step");
  }, [storageKey, session]);
  await page.goto("/trade");

  const pulsing = (anchor: string) =>
    page.locator(`[data-tour-sidebar-anchor="${anchor}"]`).evaluateAll(
      (nodes) => nodes.map((node) => getComputedStyle(node, "::after").animationName),
    );
  const sidebarRef = page.locator("[data-felix-sidebar-ref]");

  // Step 12 — Studio Portfolio Management: refs Projects & Interventions.
  const step12 = page.getByRole("dialog").filter({ hasText: "Studio Portfolio Management" });
  await expect(step12).toHaveCSS("opacity", "1", { timeout: 60000 });
  await expect(sidebarRef).toContainText(/Projects & Interventions → Projects/i);
  expect(await pulsing("projects")).toContain("sidebar-tour-pulse");
  expect(await pulsing("tools")).not.toContain("sidebar-tour-pulse");

  // Step 13 — The Transition to Collaboration: opens a project board and pins
  // the action banner in line with the toggle.
  await step12.getByRole("button", { name: "Next", exact: true }).click();
  const step13 = page.getByRole("dialog").filter({ hasText: "The Transition to Collaboration" });
  await expect(step13).toHaveCSS("opacity", "1", { timeout: 60000 });
  await expect(page).toHaveURL(/\/trade\/boards\//);
  await expect(step13).toContainText("We now open one of your project boards");
  await expect(step13).toContainText("Projects & Interventions → Projects");
  await expect(sidebarRef).toContainText(/Projects & Interventions → Projects/i);
  const banner = step13.getByRole("status").filter({ hasText: "Switch to Client View to unlock Next." });
  await expect(banner).toBeVisible();
  // The banner is pinned to the top of the card (right under the header, above
  // the dialogue), and the card's preferred placement keeps it roughly level
  // with the highlighted toggle row.
  const bannerBox = await banner.boundingBox();
  const cardBox = await step13.boundingBox();
  const toggleBox = await page.locator('[data-felix-target="client-view-toggle"]').boundingBox();
  expect(bannerBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(toggleBox).not.toBeNull();
  if (bannerBox && cardBox && toggleBox) {
    // Pinned: banner top sits within the card's header band, above the dialogue.
    expect(bannerBox.y - cardBox.y).toBeLessThan(140);
    const dialogueBox = await step13.locator(".animate-fade-in").first().boundingBox();
    if (dialogueBox) expect(bannerBox.y + bannerBox.height).toBeLessThanOrEqual(dialogueBox.y + 4);
    // Roughly in line with the toggle row (the collision solver may adjust).
    const bannerCenter = bannerBox.y + bannerBox.height / 2;
    const toggleCenter = toggleBox.y + toggleBox.height / 2;
    expect(Math.abs(bannerCenter - toggleCenter)).toBeLessThan(320);
  }

  // Flipping the board switch advances straight to Step 14.
  await page.locator('[aria-label="Toggle client editorial presentation"]').first().click();
  const step14 = page.getByRole("dialog").filter({ hasText: "Unlocking Client Portal Branding" });
  await expect(step14).toHaveCSS("opacity", "1", { timeout: 60000 });
  await expect(step14).toContainText("Client Editorial Presentation");
  await expect(step14).toContainText("top right");

  // The top-right switch keeps its own outline while the sidebar is hidden.
  const headerToggle = page.locator('[data-felix-target="header-presentation-toggle"]');
  await expect(headerToggle).toContainText(/Client Editorial Presentation/i);
  const secondaryRing = page.locator("[data-felix-spotlight-secondary]");
  await expect(secondaryRing).toBeVisible();
  const ringBox = await secondaryRing.boundingBox();
  const headerBox = await headerToggle.boundingBox();
  expect(ringBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  if (ringBox && headerBox) {
    expect(Math.abs(ringBox.x - headerBox.x)).toBeLessThanOrEqual(12);
    expect(Math.abs(ringBox.y - headerBox.y)).toBeLessThanOrEqual(12);
    expect(Math.abs(ringBox.width - headerBox.width)).toBeLessThanOrEqual(24);
    expect(Math.abs(ringBox.height - headerBox.height)).toBeLessThanOrEqual(24);
  }

  // Step 15 — Turn on studio branding: outline persists; banner pinned on top.
  await step14.getByRole("button", { name: "Next", exact: true }).click();
  const step15 = page.getByRole("dialog").filter({ hasText: "Turn on studio branding" });
  await expect(step15).toHaveCSS("opacity", "1", { timeout: 60000 });
  await expect(secondaryRing).toBeVisible();
  // The action banner only renders while the step is incomplete; if studio
  // branding is already on, Next is immediately enabled and no banner shows.
  const next15 = step15.getByRole("button", { name: "Next", exact: true });
  if (await next15.isDisabled()) {
    await expect(step15.getByRole("status").filter({ hasText: "Use studio branding only" })).toBeVisible();
    await page.locator("#hide-maison").click();
    await expect(next15).toBeEnabled();
  }
  await next15.click();

  // Step 16 — Activating the Viral Loop: outline still present.
  const step16 = page.getByRole("dialog").filter({ hasText: "Activating the Viral Loop" });
  await expect(step16).toHaveCSS("opacity", "1", { timeout: 60000 });
  await expect(secondaryRing).toBeVisible();

  // Cleanup: skipping clears every tour marker and both rings.
  await step16.getByRole("button", { name: "Skip tour", exact: true }).click();
  await expect(page.locator("html[data-felix-tour-step]")).toHaveCount(0);
  await expect(page.locator("html[data-felix-tour-sidebar]")).toHaveCount(0);
  await expect(page.locator("[data-felix-spotlight-secondary]")).toHaveCount(0);
  expect(errors).toEqual([]);
});
