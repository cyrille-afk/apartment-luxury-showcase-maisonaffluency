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
