/**
 * E2E integration suite — checkout, FX locking and the async payment queue.
 *
 * Run with:  bun run test:e2e:checkout
 *
 * Every scenario is deterministic:
 *   • Stripe        — no real Checkout Session is created; the webhook is called
 *                     with a locally HMAC-signed, side-effect-free `invoice.paid`
 *                     event (unhandled by stripeEventProcessor = no downstream
 *                     orders, emails or POs are ever produced).
 *   • Twilio/Resend — never contacted from the browser. Partial-failure
 *                     behaviour is exercised by tests/harness/payment-alerts.harness.ts,
 *                     which runs the real `notifyDepositCleared` with a stubbed
 *                     fetch (Twilio forced to 500, Slack + Resend healthy).
 *   • FX            — external FX providers are hard-blocked via page.route and
 *                     asserted to have received zero requests.
 *
 * Scenarios that need credentials skip cleanly when the env vars are absent, so
 * a secret-less CI run stays green.
 *
 * Env (all optional):
 *   E2E_TRADE_EMAIL / E2E_TRADE_PASSWORD   verified trade designer (or admin)
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD   admin (queue status RPC + cleanup)
 *   E2E_TRADE_DESIGNER_SLUG                designer slug for the pricing check
 *   E2E_STRIPE_WEBHOOK_SECRET              whsec_… matching the deployed endpoint
 */

import { test, expect, request as pwRequest } from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  env,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  anonClient,
  signIn,
  plantSession,
  stripeSignature,
  syntheticInvoicePaidEvent,
  type SignedInSession,
} from "./support/e2eEnv";

const TRADE_EMAIL = env("E2E_TRADE_EMAIL") ?? env("E2E_ADMIN_EMAIL");
const TRADE_PASSWORD = env("E2E_TRADE_PASSWORD") ?? env("E2E_ADMIN_PASSWORD");
const ADMIN_EMAIL = env("E2E_ADMIN_EMAIL");
const ADMIN_PASSWORD = env("E2E_ADMIN_PASSWORD");
const DESIGNER_SLUG = env("E2E_TRADE_DESIGNER_SLUG") ?? "robicara";
const WEBHOOK_SECRET = env("E2E_STRIPE_WEBHOOK_SECRET");

const haveSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const haveTrade = Boolean(haveSupabase && TRADE_EMAIL && TRADE_PASSWORD);
const haveAdmin = Boolean(haveSupabase && ADMIN_EMAIL && ADMIN_PASSWORD);

/** Hosts that must never be hit from the browser for FX. */
const FX_PROVIDER_GLOBS = [
  "**://api.frankfurter.app/**",
  "**://*.frankfurter.app/**",
  "**://open.er-api.com/**",
  "**://api.exchangerate.host/**",
  "**://api.exchangerate-api.com/**",
];

// ───────────────────────────────────────────────────────────────────────────
// 1. Trade authentication & CDN cache bypass
// ───────────────────────────────────────────────────────────────────────────
test.describe("1 · Trade auth & cache bypass", () => {
  test.skip(!haveSupabase, "VITE_SUPABASE_URL / PUBLISHABLE_KEY required.");

  test("anonymous catalog responses are CDN-cacheable", async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${SUPABASE_URL}/functions/v1/catalog-manifest`, {
      headers: { apikey: SUPABASE_ANON_KEY! },
    });
    expect(res.status()).toBe(200);

    const cacheControl = res.headers()["cache-control"] ?? "";
    expect(cacheControl).toContain("s-maxage=3600");
    expect(cacheControl).toContain("stale-while-revalidate=86400");
    expect(cacheControl).not.toContain("no-store");
    await ctx.dispose();
  });

  // Skipped before any browser is launched when credentials are absent.
  test.describe(() => {
    test.skip(!haveTrade, "Set E2E_TRADE_EMAIL / E2E_TRADE_PASSWORD to run.");

  test("authenticated trade requests are never cached and show trade pricing", async ({ page }) => {
    const session = await signIn(TRADE_EMAIL!, TRADE_PASSWORD!);

    // --- header assertion: same endpoint, now with a user JWT ---
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${SUPABASE_URL}/functions/v1/catalog-manifest`, {
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
    expect(res.status()).toBe(200);
    const cacheControl = (res.headers()["cache-control"] ?? "").replace(/\s+/g, "");
    expect(cacheControl).toContain("no-store");
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("s-maxage");
    await ctx.dispose();

    // --- UI assertion: designer markup pricing is rendered for this user ---
    await plantSession(page, session);
    await page.goto(`/trade/designers/${DESIGNER_SLUG}`, { waitUntil: "domcontentloaded" });

    // The Retail/Trade toggle only renders for trade users or admins.
    const toggle = page.getByRole("button", { name: /^(Trade|Retail)$/ }).first();
    await expect(toggle).toBeVisible({ timeout: 30_000 });
    if ((await toggle.innerText()).trim() === "Trade") {
      await toggle.click(); // switch into trade-price mode
    }

    // Tier discount badge, e.g. "SILVER –10%".
    await expect(page.locator("text=/–\\s?\\d{1,2}%/").first()).toBeVisible({ timeout: 20_000 });
  });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Server-side FX & database rate locking
// ───────────────────────────────────────────────────────────────────────────
test.describe("2 · FX locked from the database snapshot", () => {
  test.skip(!haveTrade, "Set E2E_TRADE_EMAIL / E2E_TRADE_PASSWORD to run.");

  test("changing quote currency stamps the currency_rates value, with no client FX calls", async ({ page }) => {
    const session = await signIn(TRADE_EMAIL!, TRADE_PASSWORD!);
    const sb = session.client;

    // Authoritative snapshot straight from the database.
    const { data: rateRow, error: rateErr } = await sb
      .from("currency_rates")
      .select("base_currency, quote_currency, rate, fetched_at")
      .eq("base_currency", "EUR")
      .eq("quote_currency", "HKD")
      .maybeSingle();
    expect(rateErr).toBeNull();
    expect(rateRow, "currency_rates must hold an EUR→HKD snapshot").toBeTruthy();
    const dbRate = Number(rateRow!.rate);
    expect(dbRate).toBeGreaterThan(0);

    // Scratch quote owned by the signed-in user (studio_id NULL ⇒ owner RLS).
    const { data: quote, error: insErr } = await sb
      .from("trade_quotes")
      .insert({
        user_id: session.userId,
        client_name: `E2E FX Lock ${Date.now()}`,
        currency: "EUR",
        status: "draft",
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();
    const quoteId = quote!.id as string;

    const fxCalls: string[] = [];
    for (const glob of FX_PROVIDER_GLOBS) {
      await page.route(glob, (route) => {
        fxCalls.push(route.request().url());
        return route.abort();
      });
    }

    try {
      await plantSession(page, session);
      await page.goto(`/trade/quotes/${quoteId}`, { waitUntil: "domcontentloaded" });

      await page.getByTestId("quote-currency-trigger").click();
      await page.getByTestId("quote-currency-option-HKD").click();

      // Poll the row until the lock lands.
      await expect
        .poll(
          async () => {
            const { data } = await sb
              .from("trade_quotes")
              .select("currency, exchange_rate_at_creation, exchange_rate_base_currency")
              .eq("id", quoteId)
              .maybeSingle();
            return data?.exchange_rate_at_creation ?? null;
          },
          { timeout: 30_000, message: "quote never recorded a locked exchange rate" },
        )
        .not.toBeNull();

      const { data: locked } = await sb
        .from("trade_quotes")
        .select("currency, exchange_rate_at_creation, exchange_rate_base_currency, exchange_rate_locked_at")
        .eq("id", quoteId)
        .single();

      expect(locked!.currency).toBe("HKD");
      expect(locked!.exchange_rate_base_currency).toBe("EUR");
      expect(locked!.exchange_rate_locked_at).toBeTruthy();
      // Must match the DB snapshot exactly — no client-side provider fallback.
      expect(Number(locked!.exchange_rate_at_creation)).toBeCloseTo(dbRate, 6);
      expect(fxCalls, `browser called an external FX provider: ${fxCalls.join(", ")}`).toHaveLength(0);
    } finally {
      await sb.from("trade_quotes").delete().eq("id", quoteId);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. Asynchronous, idempotent Stripe webhook ingestion
// ───────────────────────────────────────────────────────────────────────────
test.describe("3 · Stripe webhook ingestion", () => {
  test.skip(!WEBHOOK_SECRET || !haveSupabase, "Set E2E_STRIPE_WEBHOOK_SECRET to run.");

  test("returns 200 in under 2s and de-duplicates a replayed event id", async () => {
    const eventId = `evt_e2e_${Date.now()}`;
    const payload = JSON.stringify(syntheticInvoicePaidEvent(eventId));
    const headers = {
      "Content-Type": "application/json",
      "Stripe-Signature": stripeSignature(payload, WEBHOOK_SECRET!),
    };
    const url = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
    const ctx = await pwRequest.newContext();

    try {
      // --- first delivery: instant acknowledgement ---
      const t0 = Date.now();
      const first = await ctx.post(url, { headers, data: payload });
      const elapsed = Date.now() - t0;
      expect(first.status()).toBe(200);
      expect(elapsed, `webhook ack took ${elapsed}ms`).toBeLessThan(2000);
      const firstBody = await first.json();
      expect(firstBody.queued).toBe(true);

      // --- replay: still 200, but ignored ---
      const second = await ctx.post(url, { headers, data: payload });
      expect(second.status()).toBe(200);
      const secondBody = await second.json();
      expect(secondBody.duplicate).toBe(true);
      expect(secondBody.queued).toBeFalsy();

      // Exactly one queue row exists for this event id.
      if (haveAdmin) {
        const admin = await signIn(ADMIN_EMAIL!, ADMIN_PASSWORD!);
        const { data: rows } = await admin.client
          .from("webhook_events")
          .select("id, status, attempts, event_type")
          .eq("event_id", eventId);
        expect(rows, "queue must contain exactly one row for the replayed event").toHaveLength(1);
        expect(rows![0].event_type).toBe("invoice.paid");
      }
    } finally {
      await ctx.dispose();
      await cleanupEvent(eventId);
    }
  });

  test("rejects an unsigned or tampered payload", async () => {
    const payload = JSON.stringify(syntheticInvoicePaidEvent(`evt_e2e_bad_${Date.now()}`));
    const ctx = await pwRequest.newContext();
    const res = await ctx.post(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
      headers: { "Content-Type": "application/json", "Stripe-Signature": "t=1,v1=deadbeef" },
      data: payload,
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    await ctx.dispose();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. Background workers, partial failure & self-terminating polling
// ───────────────────────────────────────────────────────────────────────────
test.describe("4 · Background workers & retry flow", () => {
  test("queued event is drained and the retry cron disarms itself", async () => {
    test.skip(!WEBHOOK_SECRET || !haveAdmin, "Set E2E_STRIPE_WEBHOOK_SECRET + admin creds to run.");

    const eventId = `evt_e2e_drain_${Date.now()}`;
    const payload = JSON.stringify(syntheticInvoicePaidEvent(eventId));
    const ctx = await pwRequest.newContext();
    const admin = await signIn(ADMIN_EMAIL!, ADMIN_PASSWORD!);

    try {
      const res = await ctx.post(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": stripeSignature(payload, WEBHOOK_SECRET!),
        },
        data: payload,
      });
      expect(res.status()).toBe(200);

      // The worker is woken by pg_net; the row must leave `pending`.
      await expect
        .poll(
          async () => {
            const { data } = await admin.client
              .from("webhook_events")
              .select("status")
              .eq("event_id", eventId)
              .maybeSingle();
            return data?.status ?? null;
          },
          { timeout: 90_000, intervals: [1000], message: "queued event was never picked up" },
        )
        .toMatch(/processing|processed/);

      await expect
        .poll(
          async () => {
            const { data } = await admin.client
              .from("webhook_events")
              .select("status")
              .eq("event_id", eventId)
              .maybeSingle();
            return data?.status ?? null;
          },
          { timeout: 120_000, intervals: [2000], message: "queued event never reached a terminal state" },
        )
        .toBe("processed");

      // Once the queue is empty, the safety poller unschedules itself.
      await expect
        .poll(
          async () => {
            const { data } = await admin.client.rpc("webhook_queue_status");
            return data as { has_work: boolean; cron_armed: boolean } | null;
          },
          { timeout: 120_000, intervals: [5000], message: "retry cron never disarmed after the queue drained" },
        )
        .toMatchObject({ has_work: false, cron_armed: false });
    } finally {
      await ctx.dispose();
      await cleanupEvent(eventId);
    }
  });

  test("Twilio outage does not block Slack/Resend and is logged for retry", () => {
    // Runs the real notifyDepositCleared with a stubbed fetch (see harness header).
    const raw = execFileSync(
      "deno",
      ["run", "-A", "--config", "tests/harness/deno.json", "tests/harness/payment-alerts.harness.ts"],
      { encoding: "utf8", timeout: 120_000 },
    );
    const line = raw.trim().split("\n").filter(Boolean).pop()!;
    const out = JSON.parse(line) as {
      slack: { attempted: boolean; ok: boolean; body: string | null };
      twilio: { attempted: boolean; ok: boolean; status: number | null; recipients: string[] };
      emails: Array<{ recipient: string; template: string; idempotencyKey: string }>;
      alertLog: Array<{ channel: string; status: string; error: string | null }>;
      unexpectedFetches: string[];
      threw: string | null;
    };

    // A downstream outage must never take the alert path down.
    expect(out.threw).toBeNull();
    expect(out.unexpectedFetches, "an unmocked external call leaked").toHaveLength(0);

    // Slack succeeded.
    expect(out.slack.attempted).toBe(true);
    expect(out.slack.ok).toBe(true);
    expect(out.slack.body).toContain("DEPOSIT CLEARED");

    // Resend (send-transactional-email) succeeded for every internal recipient,
    // with a stable idempotency key so a queue retry cannot double-send.
    expect(out.emails.length).toBeGreaterThanOrEqual(2);
    for (const mail of out.emails) {
      expect(mail.template).toBe("deposit-cleared-internal");
      expect(mail.idempotencyKey).toContain("cs_e2e_harness_session");
    }

    // Twilio failed, was broadcast to every directory number, and was recorded.
    expect(out.twilio.attempted).toBe(true);
    expect(out.twilio.ok).toBe(false);
    expect(out.twilio.status).toBe(500);
    expect(out.twilio.recipients.length).toBeGreaterThanOrEqual(2);
    const failure = out.alertLog.find((a) => a.channel === "twilio_whatsapp");
    expect(failure, "the failed channel must be logged").toBeTruthy();
    expect(failure!.status).toBe("failed");
    expect(failure!.error).toContain("500");
  });

  test("failed events are released with exponential backoff until max attempts", () => {
    const raw = execFileSync(
      "deno",
      ["run", "-A", "--config", "tests/harness/deno.json", "tests/harness/queue-retry.harness.ts"],
      { encoding: "utf8", timeout: 120_000 },
    );
    const out = JSON.parse(raw.trim().split("\n").pop()!) as {
      maxAttempts: number;
      schedule: Array<{ attempts: number; status: string; delaySeconds: number; exhausted: boolean; lastError: string }>;
    };

    const delays = out.schedule.map((s) => s.delaySeconds);
    expect(delays).toEqual([60, 300, 1800, 7200, 7200]); // strictly increasing backoff
    for (const step of out.schedule.slice(0, 4)) {
      expect(step.status).toBe("pending"); // released back to the queue, never dropped
      expect(step.exhausted).toBe(false);
      expect(step.lastError).toContain("Twilio");
    }
    const last = out.schedule.at(-1)!;
    expect(last.attempts).toBe(out.maxAttempts);
    expect(last.status).toBe("failed"); // parked for manual review, not retried forever
  });
});

/** Remove a synthetic queue row so reruns stay clean. */
async function cleanupEvent(eventId: string) {
  if (!haveAdmin) return;
  try {
    const admin = await signIn(ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await admin.client.from("webhook_events").delete().eq("event_id", eventId);
  } catch {
    /* best effort */
  }
}

// Keeps the unused-import checker honest when only some scenarios run.
export type { SignedInSession };
void anonClient;
