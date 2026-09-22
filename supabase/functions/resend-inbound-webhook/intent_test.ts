import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  baseEmail,
  classifyReplyIntent,
  extractReplyText,
  normalizeEmail,
  studioSlug,
} from "../_shared/replyIntent.ts";
import { readSvixHeaders, signSvixPayload, verifySvixSignature } from "../_shared/svix.ts";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

Deno.test("accepts the affirmative phrases the workflow targets", () => {
  for (
    const reply of [
      "Yes",
      "Yes, please do.",
      "Sure — send it over.",
      "Please do, thank you",
      "Sounds good, we would love to see it.",
      "Go ahead and send the key.",
    ]
  ) {
    assertEquals(classifyReplyIntent(reply).intent, "positive", reply);
  }
});

Deno.test("never activates on negative, auto-reply or unclear replies", () => {
  for (
    const reply of [
      "No thanks, not interested.",
      "Please remove us from your list.",
      "Out of office until 3 October.",
      "Automatic reply: I am away.",
      "Who is this?",
      "",
    ]
  ) {
    assertEquals(classifyReplyIntent(reply).intent !== "positive", true, reply);
  }
});

Deno.test("ignores quoted copies of the original invitation", () => {
  const quoted = [
    "Who is handling this account?",
    "",
    "On Mon, 21 Sep 2026, Cyrille Delval wrote:",
    "> If you are open to it, please do let me know and I will send it over.",
    "> Yes, sounds good.",
  ].join("\n");
  assertEquals(classifyReplyIntent(quoted).intent, "unclear");
  assertEquals(extractReplyText(quoted).includes("sounds good"), false);
});

Deno.test("strips signatures before classifying", () => {
  const body = "Yes please.\n\nWarm regards,\nJane Ong\nNot interested in newsletters";
  assertEquals(classifyReplyIntent(body).intent, "positive");
});

Deno.test("normalises sender addresses", () => {
  assertEquals(normalizeEmail('"Jane Ong" <Jane@Studio.SG>'), "jane@studio.sg");
  assertEquals(baseEmail("reply+abc@studio.sg"), "reply@studio.sg");
  assertEquals(normalizeEmail("not-an-email"), "");
  assertEquals(studioSlug("MASSONE & ONG"), "massone-and-ong");
});

function requestWith(headersInit: Record<string, string>) {
  return new Request("https://example.com/webhook", { method: "POST", headers: headersInit });
}

Deno.test("verifies a correctly signed payload", async () => {
  const body = JSON.stringify({ type: "email.received" });
  const id = "msg_1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signSvixPayload({ secret: SECRET, id, timestamp, rawBody: body });
  const headers = readSvixHeaders(
    requestWith({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature }),
  );
  const result = await verifySvixSignature({ secret: SECRET, rawBody: body, headers });
  assertEquals(result.ok, true);
});

Deno.test("rejects a tampered body, a wrong secret and a stale timestamp", async () => {
  const body = JSON.stringify({ type: "email.received" });
  const id = "msg_2";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signSvixPayload({ secret: SECRET, id, timestamp, rawBody: body });
  const headers = readSvixHeaders(
    requestWith({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature }),
  );

  const tampered = await verifySvixSignature({
    secret: SECRET,
    rawBody: body + " ",
    headers,
  });
  assertEquals(tampered.ok, false);

  const wrongSecret = await verifySvixSignature({
    secret: "whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    rawBody: body,
    headers,
  });
  assertEquals(wrongSecret.ok, false);

  const stale = await verifySvixSignature({
    secret: SECRET,
    rawBody: body,
    headers,
    now: Date.now() + 20 * 60 * 1000,
  });
  assertEquals(stale.ok, false);

  const missing = await verifySvixSignature({
    secret: SECRET,
    rawBody: body,
    headers: { id: null, timestamp: null, signature: null },
  });
  assertEquals(missing.ok, false);
});
