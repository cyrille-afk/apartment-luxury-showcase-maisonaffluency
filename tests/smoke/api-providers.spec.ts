/**
 * LIVE provider smoke tests — un-mocked calls to third-party sandboxes.
 *
 * Purpose: catch "ghost assertions" — payload shapes or signature schemes that
 * silently drift from the providers' real API contracts while our mocked suites
 * keep passing.
 *
 * Isolated from every other Playwright project:
 *   bun run test:smoke:providers          (project `smoke-live`, testDir ./tests/smoke)
 *
 * The whole file self-skips when its env vars are absent, so offline commits,
 * local mocked runs and secret-less CI stay green.
 *
 * Env:
 *   RESEND_TEST_API_KEY          re_… test key (Resend sandbox)
 *   RESEND_TEST_FROM             verified sender, default `onboarding@resend.dev`
 *   RESEND_TEST_TO               sandbox target, default `delivered@resend.dev`
 *   STRIPE_TEST_SECRET_KEY       sk_test_… (Stripe testmode SDK utilities)
 *   STRIPE_WEBHOOK_TEST_SECRET   whsec_… matching the STAGING webhook endpoint
 *   SMOKE_WEBHOOK_URL            override; defaults to <SUPABASE_URL>/functions/v1/stripe-webhook
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD   optional — enables the queue-log assertion
 */

import { test, expect, request as pwRequest } from "@playwright/test";
import Stripe from "stripe";
import { Resend } from "resend";
import { env, SUPABASE_URL, signIn } from "../support/e2eEnv";

// ---------------------------------------------------------------- env guards
const RESEND_KEY = env("RESEND_TEST_API_KEY");
const RESEND_FROM = env("RESEND_TEST_FROM") ?? "Maison Affluency <onboarding@resend.dev>";
const RESEND_TO = env("RESEND_TEST_TO") ?? "delivered@resend.dev";

const STRIPE_KEY = env("STRIPE_TEST_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_TEST_SECRET");
const WEBHOOK_URL =
  env("SMOKE_WEBHOOK_URL") ?? (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/stripe-webhook` : undefined);

const ADMIN_EMAIL = env("E2E_ADMIN_EMAIL");
const ADMIN_PASSWORD = env("E2E_ADMIN_PASSWORD");

const haveResend = Boolean(RESEND_KEY?.startsWith("re_"));
const haveStripe = Boolean(STRIPE_KEY?.startsWith("sk_test_") && STRIPE_WEBHOOK_SECRET && WEBHOOK_URL);

/**
 * SMOKE_STRICT=1 (set by the scheduled contract workflow) turns a missing
 * credential into a hard failure instead of a silent skip. A skipped provider
 * contract check in CI is itself a ghost assertion.
 */
const STRICT = env("SMOKE_STRICT") === "1" || env("SMOKE_STRICT") === "true";

function requireOrSkip(have: boolean, reason: string) {
  if (have) return;
  if (STRICT) throw new Error(`SMOKE_STRICT: ${reason}`);
  test.skip(true, reason);
}

test.describe("Live provider smoke — Resend", () => {
  test.beforeAll(() => requireOrSkip(haveResend, "RESEND_TEST_API_KEY not set — live Resend smoke skipped."));
  test.skip(!haveResend && !STRICT, "RESEND_TEST_API_KEY not set — live Resend smoke skipped.");

  test("test-mode receipt is accepted and returns a message id", async () => {
    const resend = new Resend(RESEND_KEY!);
    const reference = `SMOKE-${Date.now()}`;

    // Same shape as our transactional checkout receipt: subject + html + reply_to + tags.
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM,
      to: [RESEND_TO],
      replyTo: "concierge@maisonaffluency.com",
      subject: `[SMOKE TEST] Payment received — ${reference}`,
      html: `<!doctype html><html><body style="font-family:Georgia,serif;background:#0f1f1c;color:#f5f1e8;padding:32px">
  <h1 style="font-size:20px;margin:0 0 16px">Maison Affluency</h1>
  <p>Deposit cleared for reference <strong>${reference}</strong>.</p>
  <table role="presentation" cellpadding="6" style="color:#f5f1e8">
    <tr><td>Amount</td><td><strong>HK$1,000.00</strong></td></tr>
    <tr><td>Item</td><td>Erato Wall Light</td></tr>
  </table>
  <p style="font-size:12px;opacity:.7">Automated API contract smoke test — no action required.</p>
</body></html>`,
      text: `Maison Affluency — deposit cleared for ${reference}. Amount HK$1,000.00.`,
      tags: [{ name: "category", value: "smoke_test" }],
    });

    expect(error, `Resend rejected our payload: ${JSON.stringify(error)}`).toBeNull();
    expect(data?.id, "Resend returned no message id").toBeTruthy();
    expect(data!.id).toMatch(/^[0-9a-f-]{20,}$/i);
  });
});

test.describe("Live provider smoke — Stripe signature & webhook ingestion", () => {
  test.beforeAll(() =>
    requireOrSkip(
      haveStripe,
      "STRIPE_TEST_SECRET_KEY / STRIPE_WEBHOOK_TEST_SECRET / webhook URL not set — live Stripe smoke skipped.",
    ),
  );
  test.skip(
    !haveStripe && !STRICT,
    "STRIPE_TEST_SECRET_KEY / STRIPE_WEBHOOK_TEST_SECRET / webhook URL not set — live Stripe smoke skipped.",
  );

  test("SDK-signed invoice.paid is verified by the staging endpoint and queued", async () => {
    const stripe = new Stripe(STRIPE_KEY!, { apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion });
    const eventId = `evt_smoke_${Date.now()}`;

    const payload = JSON.stringify({
      id: eventId,
      object: "event",
      api_version: "2025-08-27.basil",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "invoice.paid",
      data: {
        object: {
          id: `in_smoke_${Date.now()}`,
          object: "invoice",
          currency: "hkd",
          amount_paid: 1000,
          metadata: { smoke: "api-providers.spec" },
        },
      },
    });

    // Real SDK signing — not a hand-rolled HMAC. If Stripe changes its scheme,
    // this is where we find out.
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: STRIPE_WEBHOOK_SECRET!,
    });

    // Sanity: the SDK's own verifier accepts what we just produced.
    const constructed = stripe.webhooks.constructEvent(payload, header, STRIPE_WEBHOOK_SECRET!);
    expect(constructed.id).toBe(eventId);

    const api = await pwRequest.newContext();
    const started = Date.now();
    const res = await api.post(WEBHOOK_URL!, {
      headers: { "content-type": "application/json", "stripe-signature": header },
      data: payload,
    });
    const elapsed = Date.now() - started;
    const body = await res.text();

    expect(res.status(), `webhook rejected signed payload: ${body}`).toBe(200);
    expect(elapsed, "webhook must acknowledge fast (async queue)").toBeLessThan(5000);

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      /* non-JSON body is still a pass if status is 200 */
    }
    expect(parsed.error, `webhook reported an error: ${body}`).toBeFalsy();

    // Tampered signature must be rejected — proves verification is really on.
    const bad = await api.post(WEBHOOK_URL!, {
      headers: { "content-type": "application/json", "stripe-signature": `${header}0` },
      data: payload,
    });
    expect(bad.status(), "tampered signature was accepted").toBeGreaterThanOrEqual(400);

    // Optional: confirm the event landed in the queue log.
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      const admin = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const { data: rows } = await admin.client
        .from("webhook_events")
        .select("id,event_id,status")
        .eq("event_id", eventId);
      expect(rows?.length, "signed event was not registered in webhook_events").toBe(1);
      await admin.client.from("webhook_events").delete().eq("event_id", eventId);
    }

    await api.dispose();
  });
});
