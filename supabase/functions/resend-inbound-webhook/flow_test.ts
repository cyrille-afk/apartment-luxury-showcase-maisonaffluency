// End-to-end flow test for the Resend inbound webhook.
//
// Covers: (1) Svix signature verification on the real handler, and (2) that a
// signed sample "Yes" reply updates the matching studio lead record to
// portal_activated and queues exactly one portal key email.
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { signSvixPayload } from "../_shared/svix.ts";
import { createInboundHandler, type SendOutcome } from "./handler.ts";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const LEAD_ID = "3f2a1c6e-9b41-4d2f-8a7c-5e0b1d9c4a21";

type Row = Record<string, unknown>;

/** Minimal in-memory stand-in for the service-role Supabase client. */
function fakeClient(seedLead: Row) {
  const db = {
    acquisition_leads: [{ ...seedLead }] as Row[],
    acquisition_inbound_events: [] as Row[],
  };
  const calls = { rpc: [] as string[], claimResult: true as boolean };

  // deno-lint-ignore no-explicit-any
  const builder = (table: keyof typeof db): any => {
    let rows = db[table];
    let mode: "select" | "update" | "insert" = "select";
    let patch: Row = {};

    // deno-lint-ignore no-explicit-any
    const api: any = {
      select() {
        return api;
      },
      insert(values: Row) {
        mode = "insert";
        const dupe = table === "acquisition_inbound_events" &&
          db[table].some((r) => r.provider_event_id === values.provider_event_id);
        if (dupe) {
          api._error = { code: "23505", message: "duplicate key" };
        } else {
          const row = { id: `${table}-${db[table].length + 1}`, ...values };
          db[table].push(row);
          rows = [row];
        }
        return api;
      },
      update(values: Row) {
        mode = "update";
        patch = values;
        return api;
      },
      eq(column: string, value: unknown) {
        const matched = db[table].filter((r) => r[column] === value);
        if (mode === "update") {
          for (const row of matched) Object.assign(row, patch);
          return Promise.resolve({ data: matched, error: null });
        }
        rows = matched;
        return api;
      },
      or(filter: string) {
        const email = filter.match(/business_email\.ilike\.([^,]+)/)?.[1] ?? "";
        rows = db[table].filter((r) =>
          r.business_email === email ||
          (r.outbound_recipients as string[] | undefined)?.includes(email) ||
          (r.executive_emails as string[] | undefined)?.includes(email)
        );
        return api;
      },
      limit() {
        return Promise.resolve({ data: rows, error: null });
      },
      maybeSingle() {
        if (api._error) return Promise.resolve({ data: null, error: api._error });
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      _error: null as { code: string; message: string } | null,
    };
    return api;
  };

  return {
    db,
    calls,
    from: (table: keyof typeof db) => builder(table),
    rpc: (name: string) => {
      calls.rpc.push(name);
      return Promise.resolve({ data: calls.claimResult, error: null });
    },
  };
}

function seedLead(): Row {
  return {
    id: LEAD_ID,
    studio_name: "WeCraft Studio",
    founder_name: "Jane Ong",
    business_email: "hello@wecraft.sg",
    executive_emails: [],
    outbound_recipients: ["hello@wecraft.sg"],
    campaign_status: "outbound_sent",
    portal_key_sent_at: null,
  };
}

async function signedRequest(body: string, opts?: { secret?: string; tamper?: boolean }) {
  const id = `msg_${crypto.randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signSvixPayload({
    secret: opts?.secret ?? SECRET,
    id,
    timestamp,
    rawBody: body,
  });
  return new Request("https://example.com/functions/v1/resend-inbound-webhook", {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
      "Content-Type": "application/json",
    },
    body: opts?.tamper ? body + " " : body,
  });
}

function eventBody(text: string) {
  return JSON.stringify({
    type: "email.received",
    data: {
      email_id: "em_123",
      from: '"Jane Ong" <hello@wecraft.sg>',
      to: ["replies@maisonaffluency.com"],
      subject: "Re: Priority trade access for WeCraft Studio / Maison Affluency",
      message_id: "<reply-1@wecraft.sg>",
    },
    _reply: text,
  });
}

function buildHandler(client: ReturnType<typeof fakeClient>, replyText: string) {
  const sent: Record<string, unknown>[] = [];
  const handler = createInboundHandler({
    getSecret: () => SECRET,
    getClient: () => client,
    fetchReply: () => Promise.resolve({ text: replyText, headers: {} }),
    sendEmail: (payload) => {
      sent.push(payload);
      return Promise.resolve({ queued: ["queued"], suppressed: [], failed: [] } as SendOutcome);
    },
  });
  return { handler, sent };
}

Deno.test("rejects an unsigned request", async () => {
  const client = fakeClient(seedLead());
  const { handler } = buildHandler(client, "Yes please");
  const res = await handler(
    new Request("https://example.com/webhook", { method: "POST", body: eventBody("Yes") }),
  );
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error, "invalid_signature");
  assertEquals(client.db.acquisition_leads[0].campaign_status, "outbound_sent");
});

Deno.test("rejects a tampered body and a wrong signing secret", async () => {
  const client = fakeClient(seedLead());
  const { handler } = buildHandler(client, "Yes please");

  const tampered = await handler(await signedRequest(eventBody("Yes"), { tamper: true }));
  assertEquals(tampered.status, 401);

  const wrongSecret = await handler(
    await signedRequest(eventBody("Yes"), {
      secret: "whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    }),
  );
  assertEquals(wrongSecret.status, 401);
  assertEquals(client.db.acquisition_leads[0].campaign_status, "outbound_sent");
});

Deno.test("a signed 'Yes' reply activates the matching studio record", async () => {
  const client = fakeClient(seedLead());
  const { handler, sent } = buildHandler(client, "Yes, please send the key over.");

  const res = await handler(await signedRequest(eventBody("Yes")));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    matched: true,
    intent: "positive",
    sent: true,
    lead_id: LEAD_ID,
  });

  const lead = client.db.acquisition_leads[0];
  assertEquals(lead.campaign_status, "portal_activated");
  assertExists(lead.portal_key_sent_at);
  assertExists(lead.portal_activated_at);
  assertEquals(lead.email_error, null);
  assertEquals(client.calls.rpc, ["claim_acquisition_reply"]);

  assertEquals(sent.length, 1);
  assertEquals(sent[0].to, "hello@wecraft.sg");
  assertEquals(sent[0].idempotencyKey, `acquisition-portal-key-${LEAD_ID}`);
  assertEquals(
    String(sent[0].html).includes(`/trade/activate?token=${LEAD_ID}`),
    true,
  );

  // The delivery is written to the inbound ledger for audit.
  assertEquals(client.db.acquisition_inbound_events.length, 1);
  assertEquals(client.db.acquisition_inbound_events[0].action, "portal_key_sent");
});

Deno.test("a duplicate delivery never sends a second key", async () => {
  const client = fakeClient(seedLead());
  const { handler, sent } = buildHandler(client, "Yes, please send the key over.");

  const body = eventBody("Yes");
  const id = "msg_fixed";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signSvixPayload({ secret: SECRET, id, timestamp, rawBody: body });
  const make = () =>
    new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature },
      body,
    });

  await handler(make());
  const second = await handler(make());
  assertEquals(await second.json(), { duplicate: true });
  assertEquals(sent.length, 1);
});

Deno.test("a signed negative reply records intent without activating", async () => {
  const client = fakeClient(seedLead());
  const { handler, sent } = buildHandler(client, "No thanks, not interested.");

  const res = await handler(await signedRequest(eventBody("No")));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).intent, "negative");

  const lead = client.db.acquisition_leads[0];
  assertEquals(lead.campaign_status, "outbound_sent");
  assertEquals(lead.reply_intent, "negative");
  assertEquals(lead.reply_sender_email, "hello@wecraft.sg");
  assertEquals(sent.length, 0);
});

Deno.test("an unknown sender never touches a studio record", async () => {
  const client = fakeClient(seedLead());
  const { handler, sent } = buildHandler(client, "Yes please");

  const body = JSON.stringify({
    type: "email.received",
    data: {
      email_id: "em_999",
      from: "stranger@example.com",
      to: ["replies@maisonaffluency.com"],
      subject: "Hello",
      message_id: "<x@example.com>",
    },
  });
  const res = await handler(await signedRequest(body));
  assertEquals(await res.json(), { matched: false, reason: "no_match" });
  assertEquals(client.db.acquisition_leads[0].campaign_status, "outbound_sent");
  assertEquals(sent.length, 0);
});
