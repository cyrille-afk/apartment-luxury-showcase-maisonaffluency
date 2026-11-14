// €15 Single Video Pass. Creates Stripe Checkout only. The signature-verified
// Stripe webhook grants credits; clients read their recorded purchase through RLS.
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
    const body = await req.json().catch(() => ({}));
    if (body?.mode !== "create") return json({ error: "Unsupported checkout mode" }, 400);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
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
