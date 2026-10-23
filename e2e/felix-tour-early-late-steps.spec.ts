import { test, expect, type Page } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

// Steps 1–12 and 19–23: for every step verify the card copy, the published
// step → sidebar attribute, the "find it later" reference, and the spotlight.
// Steps 13–18 are covered by felix-board-presentation-steps.spec.ts.

type StepExpectation = {
  title: string;
  /** Unique dialogue fragment rendered by the step. */
  copy: string;
  /** data-felix-tour-sidebar value published on <html>. */
  anchor: string;
  /** Case-insensitive fragment of the "Find it later" line. */
  ref: RegExp;
  url?: RegExp;
};

const seed = async (page: Page, progress: number | null) => {
  await page.goto("/");
  await page.evaluate(([key, value, saved]) => {
    localStorage.setItem(key, value);
    localStorage.removeItem("felix_dashboard_tour_seen_v1");
    if (saved === null) localStorage.removeItem("felix_tour_progress_v1");
    else localStorage.setItem("felix_tour_progress_v1", String(saved));
    localStorage.setItem("trade_quick_tour_done", "1");
    localStorage.removeItem("trade_quick_tour_step");
  }, [storageKey, session, progress] as const);
  await page.goto("/trade");
};

const expectStep = async (page: Page, s: StepExpectation) => {
  const card = page.getByRole("dialog").filter({ hasText: s.title });
  await expect(card).toHaveCSS("opacity", "1", { timeout: 60000 });
  if (s.url) await expect(page).toHaveURL(s.url);
  await expect(page.locator("html")).toHaveAttribute("data-felix-tour-sidebar", s.anchor);
  await expect(page.locator("[data-felix-sidebar-ref]")).toContainText(s.ref);
  await expect(card).toContainText(s.copy);
  await expect(page.locator("[data-felix-spotlight]")).toBeVisible();
  return card;
};

test("tour steps 1-12: sidebar references, copy and highlights", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-only tour.");
  test.skip(!session || !storageKey, "Requires a managed Trade session.");
  if (!session || !storageKey) return;
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page, null);

  // Step 1 — Welcome & Trade Tier Validation
  const step1 = await expectStep(page, {
    title: "Welcome & Trade Tier Validation",
    copy: "dedicated Curatorial Assistant",
    anchor: "dashboard",
    ref: /Dashboard/i,
  });
  await step1.getByRole("button", { name: "Next", exact: true }).click();

  // Step 2 — The Collection (gated: opening The Collection advances the tour)
  const step2 = page.getByRole("dialog").filter({ hasText: "Open The Collection to continue." });
  await expect(step2).toHaveCSS("opacity", "1", { timeout: 60000 });
  await expect(page.locator("html")).toHaveAttribute("data-felix-tour-sidebar", "collection");
  await expect(page.locator("[data-felix-sidebar-ref]")).toContainText(/The Collection/i);
  await expect(step2).toContainText("Interactive Gallery");
  await page.locator('[data-felix-target="nav-collection"]').first().click();

  // Step 3 — Transparent Project Margins
  const step3 = await expectStep(page, {
    title: "Transparent Project Margins",
    copy: "plan your project margins with clarity",
    anchor: "collection",
    ref: /The Collection/i,
    url: /\/trade\/the-collection/,
  });
  await step3.getByRole("button", { name: "Next", exact: true }).click();

  // Step 4 — Client Project Folders
  const step4 = await expectStep(page, {
    title: "Client Project Folders",
    copy: "isolated workspace",
    anchor: "projects",
    ref: /Projects & Interventions → Projects/i,
    url: /\/trade\/projects/,
  });
  await step4.getByRole("button", { name: "Next", exact: true }).click();

  // Step 5 — Real-Time Tier Tracking
  const step5 = await expectStep(page, {
    title: "Real-Time Tier Tracking",
    copy: "rolling 12-month confirmed project spend",
    anchor: "dashboard",
    ref: /Dashboard/i,
  });
  await step5.getByRole("button", { name: "Next", exact: true }).click();

  // Step 6 — Client-Safe Presentations (Next enables Client View and jumps on)
  const step6 = await expectStep(page, {
    title: "Client-Safe Presentations",
    copy: "client-facing presentation mode",
    anchor: "collection",
    ref: /The Collection/i,
    url: /\/trade\/the-collection/,
  });
  await step6.getByRole("button", { name: "Next", exact: true }).click();

  // Step 7 — Absolute Margin Protection (product page: no trade sidebar, the
  // in-card reference still names The Collection)
  const step7 = await expectStep(page, {
    title: "Absolute Margin Protection",
    copy: "safely hidden behind standard retail pricing",
    anchor: "collection",
    ref: /The Collection/i,
    url: /\/trade\/products\//,
  });
  await step7.getByRole("button", { name: "Next", exact: true }).click();

  // Step 8 — Professional Quote Generation
  const step8 = await expectStep(page, {
    title: "Professional Quote Generation",
    copy: "automated document compiler",
    anchor: "quotes",
    ref: /Quotes & Proformas/i,
    url: /\/trade\/quotes/,
  });
  await step8.getByRole("button", { name: "Next", exact: true }).click();

  // Step 9 — Direct Client Billing
  const step9 = await expectStep(page, {
    title: "Direct Client Billing",
    copy: "document controls for an existing quotation",
    anchor: "quotes",
    ref: /Quotes & Proformas/i,
  });
  await step9.getByRole("button", { name: "Next", exact: true }).click();

  // Step 10 — The Trade Tools Grid
  const step10 = await expectStep(page, {
    title: "The Trade Tools Grid",
    copy: "Material Library",
    anchor: "tools",
    ref: /Tools/i,
    url: /\/trade\/tools/,
  });
  await step10.getByRole("button", { name: "Next", exact: true }).click();

  // Step 11 — Account & Team Configurations
  const step11 = await expectStep(page, {
    title: "Account & Team Configurations",
    copy: "client-facing studio identity",
    anchor: "settings",
    ref: /Settings/i,
    url: /\/trade\/settings/,
  });
  await step11.getByRole("button", { name: "Next", exact: true }).click();

  // Step 12 — Studio Portfolio Management
  const step12 = await expectStep(page, {
    title: "Studio Portfolio Management",
    copy: "active project context",
    anchor: "dashboard",
    ref: /Dashboard/i,
  });
  await step12.getByRole("button", { name: "Skip tour", exact: true }).click();
  await expect(page.locator("html[data-felix-tour-step]")).toHaveCount(0);
  await expect(page.locator("html[data-felix-tour-sidebar]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("tour steps 19-23: sidebar references, copy and highlights", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-only tour.");
  test.skip(!session || !storageKey, "Requires a managed Trade session.");
  if (!session || !storageKey) return;
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page, 18);

  // Step 19 — Technical Design Assets
  const step19 = await expectStep(page, {
    title: "Technical Design Assets",
    copy: "technical sheets",
    anchor: "tools",
    ref: /Tools/i,
    url: /\/trade\/tools/,
  });
  await step19.getByRole("button", { name: "Next", exact: true }).click();

  // Step 20 — Priority Concierge Access
  const step20 = await expectStep(page, {
    title: "Priority Concierge Access",
    copy: "fresh shortlist",
    anchor: "concierge",
    ref: /Trade Concierge/i,
    url: /\/trade\/concierge/,
  });
  await step20.getByRole("button", { name: "Next", exact: true }).click();

  // Step 21 — Activate your AI design co-pilot
  const step21 = await expectStep(page, {
    title: "ACTIVATE YOUR AI DESIGN CO-PILOT",
    copy: "ChatGPT Extension Integration",
    anchor: "extension-sync",
    ref: /AI Extension Sync/i,
    url: /\/trade\/extension-sync/,
  });
  await step21.getByRole("button", { name: "Next", exact: true }).click();

  // Step 22 — Take your studio on site
  const step22 = await expectStep(page, {
    title: "TAKE YOUR STUDIO ON SITE",
    copy: "scan the QR code",
    anchor: "pwa",
    ref: /Mobile App Workspace/i,
  });
  await step22.getByRole("button", { name: "Next", exact: true }).click();

  // Step 23 — Found a bug or have an idea? (last step: Finish completes)
  const step23 = await expectStep(page, {
    title: "FOUND A BUG OR HAVE AN IDEA?",
    copy: "Log an entry",
    anchor: "beta-feedboard",
    ref: /Beta Feedboard/i,
    url: /\/trade\/beta-feedboard/,
  });
  await step23.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.locator("html[data-felix-tour-step]")).toHaveCount(0);
  await expect(page.locator("html[data-felix-tour-sidebar]")).toHaveCount(0);
  // A finished tour clears saved progress.
  const saved = await page.evaluate(() => localStorage.getItem("felix_tour_progress_v1"));
  expect(saved).toBeNull();
  expect(errors).toEqual([]);
});
