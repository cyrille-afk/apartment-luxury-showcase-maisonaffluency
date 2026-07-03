import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for the Generative-UI skeleton flow on the concierge panel.
 *
 * We stub `window.fetch` for the concierge SSE endpoint so we can drive the
 * exact frame ordering the browser sees — the real edge function can't be
 * coerced into emitting `tool_start` on demand, and we want deterministic
 * timing between frames so React actually paints the intermediate skeleton
 * state instead of batching it away.
 *
 * Two scenarios are exercised:
 *   1. success — `tool_start` → delay → `proposal`. The skeleton must appear,
 *      then be replaced by the real tearsheet card at the correct moment.
 *   2. blocked — `tool_start` → delay → `proposal_blocked`. The skeleton
 *      must appear, then be cleared on `onDone` with NO tearsheet card ever
 *      being rendered.
 *
 * The public `/concierge` route auto-mounts <AIConcierge surface="public" />
 * and doesn't require auth, so it's the right entry point for this test.
 */

type Scenario = "success" | "blocked" | "blocked_palette";

async function installConciergeStub(page: Page) {
  await page.addInitScript(() => {
    const url = new URL(window.location.href);
    const scenario = url.searchParams.get("__pw_mock") as
      | "success"
      | "blocked"
      | "blocked_palette"
      | null;
    if (!scenario) return;

    const enc = new TextEncoder();
    const originalFetch = window.fetch.bind(window);

    const frames: Record<
      "success" | "blocked" | "blocked_palette",
      Array<string | { delayMs: number }>
    > = {
      success: [
        `event: request_id\ndata: ${JSON.stringify({ request_id: "pw-req" })}\n\n`,
        `event: tool_start\ndata: ${JSON.stringify({
          tool: "propose_tearsheet",
          tool_call_id: "tc-pw",
          index: 0,
          request_id: "pw-req",
        })}\n\n`,
        { delayMs: 400 },
        `event: proposal\ndata: ${JSON.stringify({
          tool: "propose_tearsheet",
          tool_call_id: "tc-pw",
          args: { title: "E2E Board", pick_ids: ["p1"], note: null },
          preview: [
            {
              id: "p1",
              title: "E2E Piece",
              image_url: null,
              materials: null,
              category: null,
              designer_name: null,
            },
          ],
          requirements_validation: { ok: true, coverage: [], violations: [] },
        })}\n\n`,
        `data: [DONE]\n\n`,
      ],
      blocked: [
        `event: request_id\ndata: ${JSON.stringify({ request_id: "pw-req" })}\n\n`,
        `event: tool_start\ndata: ${JSON.stringify({
          tool: "propose_tearsheet",
          tool_call_id: "tc-pw",
          index: 0,
          request_id: "pw-req",
        })}\n\n`,
        { delayMs: 400 },
        `event: proposal_blocked\ndata: ${JSON.stringify({
          request_id: "pw-req",
          tool: "propose_tearsheet",
          tool_call_id: "tc-pw",
          reason: "requirements_violation",
          coverage: [],
          violations: [{ slot: "seating", required_qty: 2, delivered_qty: 0, reason: "qty_shortfall" }],
        })}\n\n`,
        `data: [DONE]\n\n`,
      ],
      // Same shape as `blocked`, but the violation is a `palette_mismatch`
      // — the hard-constraint check the Inspector now runs when the requirements
      // extractor captured a `materials` / `style` palette. The client-side
      // contract is identical (no `proposal` frame → skeleton must clear on
      // `onDone` and no card must ever render), so this scenario pins that the
      // UI treats the palette failure the same way it treats slot shortfalls.
      blocked_palette: [
        `event: request_id\ndata: ${JSON.stringify({ request_id: "pw-req" })}\n\n`,
        `event: tool_start\ndata: ${JSON.stringify({
          tool: "propose_tearsheet",
          tool_call_id: "tc-pw",
          index: 0,
          request_id: "pw-req",
        })}\n\n`,
        { delayMs: 400 },
        `event: proposal_blocked\ndata: ${JSON.stringify({
          request_id: "pw-req",
          tool: "propose_tearsheet",
          tool_call_id: "tc-pw",
          reason: "requirements_violation",
          coverage: [],
          violations: [
            {
              kind: "palette_mismatch",
              requested: ["oak", "brass"],
              offending_ids: ["p1", "p2"],
              offending_titles: ["Walnut lounge chair", "Marble console"],
            },
          ],
        })}\n\n`,
        `data: [DONE]\n\n`,
      ],
    };

    (window as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const target =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (!/functions\/v1\/(trade-concierge|concierge-public-stream)\b/.test(target)) {
        return originalFetch(input as any, init);
      }
      const chosen = frames[scenario];
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const step of chosen) {
            if (typeof step === "object" && "delayMs" in step) {
              await new Promise((r) => setTimeout(r, step.delayMs));
              continue;
            }
            controller.enqueue(enc.encode(step));
            // Small gap between frames so the reader loop yields to React
            // and paints the intermediate skeleton state before we push the
            // final proposal / blocked frame.
            await new Promise((r) => setTimeout(r, 30));
          }
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    };
  });
}

async function openConciergeAndSend(page: Page, prompt: string) {
  // The `/concierge` page auto-opens the panel ~600ms after mount. If for any
  // reason it hasn't opened yet, clicking the visible CTA also works — do
  // both so the test isn't racy against the auto-open timeout.
  const openCta = page.getByRole("button", { name: /Speak with the Concierge/i });
  if (await openCta.isVisible().catch(() => false)) {
    await openCta.click().catch(() => {});
  }
  // The Send button is the only reliable, unique concierge-composer marker
  // (the page also contains a hidden ContactInquiry <textarea>, which would
  // otherwise be matched by a plain `page.locator('textarea')`).
  const send = page.getByRole("button", { name: "Send", exact: true });
  await expect(send).toBeVisible({ timeout: 15_000 });
  const composer = send.locator("xpath=preceding::textarea[1]");
  await expect(composer).toBeVisible();
  await composer.fill(prompt);
  await send.click();
}

test.describe("AI concierge — Generative UI skeleton", () => {
  test.beforeEach(async ({ page }) => {
    await installConciergeStub(page);
  });

  test("renders the skeleton, then swaps it for the real tearsheet card", async ({ page }) => {
    await page.goto("/concierge?__pw_mock=success");
    await openConciergeAndSend(page, "propose a small tearsheet for a Milan pied-à-terre");

    // 1. Skeleton is the FIRST thing the user sees — before the proposal frame arrives.
    const skeleton = page.getByRole("status", { name: /Curating a tearsheet/i });
    await expect(skeleton).toBeVisible({ timeout: 5_000 });

    // 2. The real card takes its place once the proposal frame arrives.
    await expect(
      page.getByText("✦ Concierge proposes a new tearsheet", { exact: false }),
    ).toBeVisible({ timeout: 5_000 });

    // 3. Skeleton is fully removed — no double-render.
    await expect(skeleton).toHaveCount(0);

    // 4. Requirements badge (ok) rides along on the card.
    await expect(page.getByText(/Matches brief/i)).toBeVisible();
  });

  test("clears the skeleton and renders NO card when the server emits proposal_blocked", async ({ page }) => {
    await page.goto("/concierge?__pw_mock=blocked");
    await openConciergeAndSend(page, "propose something that will not satisfy the brief");

    // 1. Skeleton still appears (the model DID start streaming a tool call).
    const skeleton = page.getByRole("status", { name: /Curating a tearsheet/i });
    await expect(skeleton).toBeVisible({ timeout: 5_000 });

    // 2. Skeleton is removed on `onDone` because the proposal never arrived
    //    (Inspector fail-closed swallowed the card).
    await expect(skeleton).toHaveCount(0, { timeout: 5_000 });

    // 3. No tearsheet card ever rendered — validates that the pending
    //    placeholder was not accidentally promoted to a real card.
    await expect(
      page.getByText("✦ Concierge proposes a new tearsheet", { exact: false }),
    ).toHaveCount(0);
  });
});
