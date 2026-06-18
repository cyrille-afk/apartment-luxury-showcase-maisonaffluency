// End-to-end test for the notify-sample-request edge function.
//
// Requires three env vars (set them in `.env` or your shell):
//   VITE_SUPABASE_URL              — already in .env
//   VITE_SUPABASE_PUBLISHABLE_KEY  — already in .env
//   E2E_USER_ACCESS_TOKEN          — an authenticated JWT for an admin trade user
//
// The test is skipped (not failed) when E2E_USER_ACCESS_TOKEN is missing,
// so CI without credentials stays green.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const ACCESS_TOKEN = Deno.env.get("E2E_USER_ACCESS_TOKEN");

const TEST_PRODUCT_ID = "a99767c2-08d4-4437-87cf-a0cfdceabebd"; // Toshiro Table Lamp / Made In Kira

Deno.test({
  name: "notify-sample-request: insert → invoke → email enqueued with product context",
  ignore: !ACCESS_TOKEN,
  async fn() {
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve current user id from the JWT.
    const { data: userData, error: userErr } = await supabase.auth.getUser(ACCESS_TOKEN!);
    assertEquals(userErr, null, `auth.getUser failed: ${userErr?.message}`);
    const userId = userData.user!.id;

    // 1. Insert a sample request as the authenticated user.
    const { data: inserted, error: insertErr } = await supabase
      .from("trade_sample_requests")
      .insert({
        user_id: userId,
        product_id: TEST_PRODUCT_ID,
        product_name: "Toshiro Table Lamp",
        brand_name: "Made In Kira",
        client_name: "E2E Test Client",
        project_name: "E2E Test Project",
        shipping_address: "1 Test Street",
        shipping_city: "London",
        shipping_country: "United Kingdom",
        return_by: "2026-07-15",
        notes: "Automated E2E verification",
        status: "requested",
      })
      .select("id")
      .single();

    assertEquals(insertErr, null, `insert failed: ${insertErr?.message}`);
    const requestId = inserted!.id as string;

    try {
      // 2. Invoke the edge function.
      const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/notify-sample-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({ requestId }),
      });
      const invokeBody = await invokeRes.json();
      assertEquals(invokeRes.status, 200, `function returned ${invokeRes.status}: ${JSON.stringify(invokeBody)}`);
      assertEquals(invokeBody.success, true);

      // 3. Verify email_send_log rows were enqueued for this request.
      //    Caller must be an admin for RLS to allow this read.
      const messageIdPrefix = `sample-request-${requestId}`;
      const { data: logRows, error: logErr } = await supabase
        .from("email_send_log")
        .select("message_id, template_name, recipient_email, status, error_message")
        .like("message_id", `${messageIdPrefix}%`);

      assertEquals(logErr, null, `email_send_log read failed: ${logErr?.message}`);
      assert(
        (logRows?.length ?? 0) >= 1,
        `expected at least one email_send_log row for ${messageIdPrefix}, got ${logRows?.length ?? 0}`,
      );

      for (const row of logRows!) {
        assertEquals(row.template_name, "sample-request");
        assert(
          ["pending", "sent"].includes(row.status as string),
          `unexpected status ${row.status} (error: ${row.error_message ?? "none"})`,
        );
        assert(
          typeof row.recipient_email === "string" && (row.recipient_email as string).includes("@"),
          `invalid recipient_email ${row.recipient_email}`,
        );
      }
    } finally {
      // 4. Cleanup the test sample request (best-effort).
      await supabase.from("trade_sample_requests").delete().eq("id", requestId);
    }
  },
});

Deno.test("notify-sample-request: rejects requests without Authorization", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notify-sample-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ requestId: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401, `expected 401, got ${res.status}: ${JSON.stringify(body)}`);
});
