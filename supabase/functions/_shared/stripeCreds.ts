import { createClient } from "npm:@supabase/supabase-js@2.57.2";

export type StripeCreds = {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  liveMode: boolean;
};

/**
 * Loads the Stripe credentials for this project.
 *
 * Priority: the production credentials saved in `payment_credentials`
 * (Payment Settings screen, service-role only) when live mode is on,
 * otherwise the project environment secrets.
 */
export async function loadStripeCreds(): Promise<StripeCreds> {
  const env = {
    secretKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
    webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "",
    liveMode: false,
  };

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data } = await admin
      .from("payment_credentials")
      .select("live_publishable_key, live_secret_key, live_webhook_secret, live_mode")
      .eq("id", "live")
      .maybeSingle();

    if (data?.live_mode) {
      return {
        secretKey: (data.live_secret_key as string) || env.secretKey,
        webhookSecret: (data.live_webhook_secret as string) || env.webhookSecret,
        publishableKey: (data.live_publishable_key as string) || env.publishableKey,
        liveMode: true,
      };
    }
  } catch (e) {
    console.error("[stripeCreds] falling back to environment secrets:", e);
  }

  return env;
}
