# Integration suite — `tests/checkout-flow.spec.ts`

Validates the money path: trade cache bypass, server-side FX locking, and the
asynchronous Stripe webhook queue.

```bash
bun run test:e2e:checkout                      # builds + previews the app
PW_BASE_URL=http://localhost:8080 bun run test:e2e:checkout   # reuse a running dev server
```

## Determinism

No test contacts a real external provider.

| Dependency | How it is neutralised |
|---|---|
| Stripe | Webhook called with a locally HMAC-signed `invoice.paid` event. That type is unhandled by `stripeEventProcessor`, so nothing downstream (orders, POs, emails) is created. No Checkout Session is opened. |
| Twilio / Resend / Slack | Never called from the browser. Partial-failure behaviour runs the **real** `notifyDepositCleared` inside `tests/harness/payment-alerts.harness.ts` with a stubbed `fetch` (Twilio forced to HTTP 500, Slack + Resend healthy) and a stubbed database client. |
| FX providers | All known provider hosts are `page.route`-blocked and asserted to have received zero requests. |
| Retry/backoff | Asserted against `supabase/functions/_shared/webhookQueueRetry.ts`, the same module the worker imports — not a copy of the schedule. |

## Environment variables (all optional — missing vars skip, never fail)

| Var | Enables |
|---|---|
| `E2E_TRADE_EMAIL` / `E2E_TRADE_PASSWORD` | authenticated cache-bypass + trade pricing + FX lock scenarios |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | queue-row assertions, `webhook_queue_status()` RPC, cleanup |
| `E2E_STRIPE_WEBHOOK_SECRET` | signed webhook ingestion + queue drain scenarios |
| `E2E_TRADE_DESIGNER_SLUG` | designer page used for the pricing check (default `robicara`) |

## What each scenario proves

1. **Cache bypass** — anonymous catalog responses carry `s-maxage=3600, stale-while-revalidate=86400`; the same endpoint with a user JWT returns `no-store, private` with no shared-cache directive, and the signed-in designer sees tier-discounted pricing.
2. **FX locking** — changing a quote's currency stamps `exchange_rate_at_creation` with the exact `currency_rates` snapshot (base `EUR`), with zero client-side FX provider calls. The scratch quote is deleted afterwards.
3. **Webhook ingestion** — first delivery acknowledges 200 in under 2s with `queued: true`; a replay of the same event id returns 200 with `duplicate: true` and leaves exactly one queue row. Tampered signatures are rejected.
4. **Workers** — the queued row moves `pending → processing → processed`, the self-terminating retry cron disarms once the queue is empty, a Twilio outage does not stop Slack/Resend and is written to `admin_alert_log`, and failures are released with 60s/5m/30m/2h backoff before being parked as `failed`.

---

# Live provider smoke suite — `tests/smoke/api-providers.spec.ts`

Un-mocked calls to the real third-party sandboxes, to catch payload/schema drift
that mocked suites can't see ("ghost assertions").

```bash
bun run test:smoke:providers
```

Isolated in its own Playwright project (`smoke-live`, testDir `tests/smoke`); it
starts no app server and is never touched by `test:e2e` / `test:e2e:checkout`.
Every test self-skips when its keys are missing, so offline commits and
secret-less CI stay green.

## Environment keys (staging)

| Var | Required for | Notes |
|---|---|---|
| `RESEND_TEST_API_KEY` | Resend ping | `re_…` test key |
| `RESEND_TEST_FROM` | optional | default `Maison Affluency <onboarding@resend.dev>` |
| `RESEND_TEST_TO` | optional | default `delivered@resend.dev` (Resend sandbox sink) |
| `STRIPE_TEST_SECRET_KEY` | Stripe signature test | `sk_test_…`, used for SDK signing utilities |
| `STRIPE_WEBHOOK_TEST_SECRET` | Stripe signature test | `whsec_…` of the **staging** endpoint |
| `SMOKE_WEBHOOK_URL` | optional | defaults to `<VITE_SUPABASE_URL>/functions/v1/stripe-webhook` |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | optional | enables the `webhook_events` queue-log assertion + cleanup |

## What it proves

1. **Resend** — a real checkout-receipt payload (from/to/subject/html/text/tags) is
   accepted by Resend's live API and returns a message id.
2. **Stripe** — a `invoice.paid` body signed with the real Stripe SDK
   (`stripe.webhooks.generateTestHeaderString`) is verified by our staging webhook,
   answers HTTP 200 in under 5s, registers one `webhook_events` row, and a tampered
   signature is rejected with 4xx.
