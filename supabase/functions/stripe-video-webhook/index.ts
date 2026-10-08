// Stripe webhook: credits the buyer's video token balance on a paid Single Video Pass.
// Signature verified with STRIPE_WEBHOOK_SECRET; grant_video_pass is idempotent per
// checkout session, so this and the success-page "verify" call can never double-credit.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const PRICE_ID = "price_1UOQkpS0Atf7jTffktSusXq6";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ok = (b: unknown = { received: true }, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const sig = req.headers.get("stripe-signature");
  if (!secret) return ok({ error: "Webhook not configured" }, 500);
  if (!sig) return ok({ error: "Missing signature" }, 400);

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return ok({ error: "Invalid signature" }, 400);
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return ok();
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.metadata?.kind !== "video_pass") return ok({ ignored: "not a video pass" });
  if (s.payment_status !== "paid") return ok({ ignored: `payment ${s.payment_status}` });
  const userId = s.metadata?.user_id ?? "";
  if (!UUID.test(userId)) return ok({ error: "Missing user" }, 400);

  // Confirm the paid item really is the Video Pass price.
  const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 10 });
  const qty = items.data.filter((i) => i.price?.id === PRICE_ID).reduce((n, i) => n + (i.quantity ?? 0), 0);
  if (qty < 1) return ok({ ignored: "no video pass line" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db.rpc("grant_video_pass", { _session: s.id, _user: userId, _credits: qty });
  if (error) return ok({ error: error.message }, 500); // 500 → Stripe retries
  return ok({ received: true, newlyGranted: data === true });
});
