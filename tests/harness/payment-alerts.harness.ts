/**
 * Deterministic harness for the downstream notification fan-out.
 *
 * Runs the REAL `notifyDepositCleared` from
 * supabase/functions/_shared/paymentAlerts.ts with every external dependency
 * stubbed, so the E2E suite can assert partial-failure behaviour without
 * touching Slack, Twilio or Resend:
 *
 *   TWILIO  -> forced network failure (connector gateway returns 500)
 *   SLACK   -> success
 *   RESEND  -> success (send-transactional-email invocations are recorded)
 *
 * Prints a single JSON line on stdout, consumed by tests/checkout-flow.spec.ts.
 *
 * Usage: deno run -A tests/harness/payment-alerts.harness.ts
 */

// ---------------------------------------------------------------- env stubs
Deno.env.set("SLACK_PAYMENTS_WEBHOOK_URL", "https://hooks.slack.invalid/services/E2E");
Deno.env.set("TWILIO_WHATSAPP_FROM", "whatsapp:+10000000000");
Deno.env.set("TWILIO_API_KEY", "e2e-twilio-key");
Deno.env.set("LOVABLE_API_KEY", "e2e-lovable-key");
Deno.env.set("ADMIN_WHATSAPP_TO", "+6591393850,+6598564147");
// Deliberately unset so getAdminWhatsAppRecipients falls back to the env list
// instead of reaching for the real database.
Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

interface ChannelLog {
  slack: { attempted: boolean; ok: boolean; body: string | null };
  twilio: { attempted: boolean; ok: boolean; status: number | null; recipients: string[] };
  emails: Array<{ recipient: string; template: string; idempotencyKey: string }>;
  alertLog: Array<{ channel: string; event: string; status: string; error: string | null }>;
  unexpectedFetches: string[];
}

const log: ChannelLog = {
  slack: { attempted: false, ok: false, body: null },
  twilio: { attempted: false, ok: false, status: null, recipients: [] },
  emails: [],
  alertLog: [],
  unexpectedFetches: [],
};

// -------------------------------------------------------------- fetch stub
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  // Slack / Teams outgoing webhook — succeeds.
  if (url.includes("hooks.slack.invalid")) {
    log.slack.attempted = true;
    log.slack.ok = true;
    log.slack.body = typeof init?.body === "string" ? init.body : null;
    return new Response("ok", { status: 200 });
  }

  // Twilio WhatsApp via the connector gateway — forced outage.
  if (url.includes("connector-gateway.lovable.dev/twilio")) {
    log.twilio.attempted = true;
    log.twilio.status = 500;
    const params = init?.body instanceof URLSearchParams ? init.body : null;
    const to = params?.get("To");
    if (to) log.twilio.recipients.push(to);
    return new Response("Twilio upstream unavailable (E2E forced failure)", { status: 500 });
  }

  // Anything else would mean a real external call leaked into the test.
  log.unexpectedFetches.push(url);
  return new Response("blocked by harness", { status: 599 });
}) as typeof fetch;

// ----------------------------------------------------------- supabase stub
type Row = Record<string, unknown>;

function result(data: unknown) {
  const payload = { data, error: null };
  const chain: Record<string, unknown> = {
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error: null }),
    single: () => Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(payload).then(resolve),
  };
  return chain;
}

const fakeSupabase = {
  from(table: string) {
    return {
      select: () => {
        if (table === "trade_quotes") {
          return result({
            client_name: "AGNI Limited",
            currency: "HKD",
            ship_to_email: "info@agnihk.com",
            client_id: null,
          });
        }
        if (table === "trade_quote_items") {
          return result([{ product_id: "prod-erato", quantity: 2 }]);
        }
        if (table === "designer_curator_picks") {
          return result([{ id: "prod-erato", title: "Erato Wall Light", designer_name: "Robicara" }]);
        }
        return result([]);
      },
      insert: (row: Row) => {
        if (table === "admin_alert_log") {
          log.alertLog.push({
            channel: String(row.channel),
            event: String(row.event),
            status: String(row.status),
            error: (row.error as string | null) ?? null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      update: () => result(null),
    };
  },
  functions: {
    invoke: (name: string, opts: { body?: Record<string, unknown> }) => {
      // Resend path — the transactional email function succeeds.
      if (name === "send-transactional-email") {
        const body = opts?.body ?? {};
        log.emails.push({
          recipient: String(body.recipientEmail),
          template: String(body.templateName),
          idempotencyKey: String(body.idempotencyKey),
        });
        return Promise.resolve({ data: { ok: true }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  },
};

// ------------------------------------------------------------------- run
const { notifyDepositCleared } = await import("../../supabase/functions/_shared/paymentAlerts.ts");

let threw: string | null = null;
try {
  // deno-lint-ignore no-explicit-any
  await notifyDepositCleared(fakeSupabase as any, {
    quoteId: "f05c2a2d-527f-41af-b7ae-efe2e820ce6e",
    paymentKind: "deposit",
    amountCents: 18_540_719,
    currency: "HKD",
    payerEmail: "info@agnihk.com",
    sessionId: "cs_e2e_harness_session",
    isLive: false,
  });
} catch (e) {
  threw = e instanceof Error ? e.message : String(e);
}

globalThis.fetch = realFetch;
console.log(JSON.stringify({ ...log, threw }));
