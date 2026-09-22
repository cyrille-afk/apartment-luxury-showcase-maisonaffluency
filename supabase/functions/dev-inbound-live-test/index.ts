// Admin-only harness: fires a REAL, signed email.received event at the live
// resend-inbound-webhook endpoint so the production path can be verified
// end to end without waiting for an actual inbound email.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { signSvixPayload } from "../_shared/svix.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: claimsData, error: claimsError } = await admin.auth.getClaims(token);
  const userId = claimsData?.claims?.sub as string | undefined;
  if (claimsError || !userId) return json({ error: "unauthorized" }, 401);

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: { role: string }) =>
    r.role === "admin" || r.role === "super_admin"
  );
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const fromEmail = String(body.from ?? "").trim();
  const replyText = String(body.text ?? "Yes, please send it over.");
  const studioName = String(body.studio_name ?? "Maison Test Studio");
  if (!fromEmail) return json({ error: "from_required" }, 400);

  const payload = JSON.stringify({
    type: "email.received",
    data: {
      email_id: `live-test-${crypto.randomUUID()}`,
      from: fromEmail,
      to: ["replies@maisonaffluency.com"],
      subject: `Re: Priority trade access for ${studioName} / Maison Affluency`,
      message_id: `<live-test-${Date.now()}@maisonaffluency.com>`,
      text: replyText,
    },
  });

  const secret = Deno.env.get("RESEND_INBOUND_WEBHOOK_SECRET") ?? "";
  if (!secret) return json({ error: "missing_RESEND_INBOUND_WEBHOOK_SECRET" }, 500);

  const id = `msg_${crypto.randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signSvixPayload({ secret, id, timestamp, rawBody: payload });

  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/resend-inbound-webhook`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    },
    body: payload,
  });
  const text = await res.text();

  return json({ endpoint: url, status: res.status, response: text, svix_id: id });
});
