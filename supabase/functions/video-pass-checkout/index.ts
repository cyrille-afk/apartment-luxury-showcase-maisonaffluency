// €15 Single Video Pass. mode "create" → Stripe Checkout URL. mode "verify" → confirms
// the paid session belongs to the caller and grants 1 credit once (idempotent per session).
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { safeOrigin } from "../_shared/safeOrigin.ts";

const PRICE_ID = "price_1UOQkpS0Atf7jTffktSusXq6";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    const email = claims?.claims?.email as string | undefined;
    if (!userId) return json({ error: "Invalid session" }, 401);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const body = await req.json().catch(() => ({}));

    if (body?.mode === "verify") {
      const sid = String(body?.session_id || "");
      if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return json({ error: "Invalid session id" }, 400);
      const s = await stripe.checkout.sessions.retrieve(sid);
      if (s.metadata?.user_id !== userId || s.metadata?.kind !== "video_pass") return json({ error: "Not your purchase" }, 403);
      if (s.payment_status !== "paid") return json({ granted: false, status: s.payment_status });
      const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await db.rpc("grant_video_pass", { _session: sid, _user: userId, _credits: 1 });
      if (error) throw error;
      return json({ granted: true, newlyGranted: data === true });
    }

    let customer: string | undefined;
    if (email) {
      const c = await stripe.customers.list({ email, limit: 1 });
      customer = c.data[0]?.id;
    }
    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer, customer_email: customer ? undefined : email,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      metadata: { user_id: userId, kind: "video_pass" },
      success_url: `${origin}/trade/ai-layout?video_pass={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/trade/ai-layout`,
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Checkout failed" }, 500);
  }
});
