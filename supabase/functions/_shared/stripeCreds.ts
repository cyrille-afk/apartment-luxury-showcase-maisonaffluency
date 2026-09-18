import { createClient } from "npm:@supabase/supabase-js@2.57.2";

export type StripeCreds = {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  liveMode: boolean;
  /** Where the credentials came from: environment secrets or Payment Settings. */
  source: "env" | "payment_settings" | "none";
};

const env = (name: string) => (Deno.env.get(name) ?? "").trim();

/** A key is live only when it carries a Stripe live prefix. Anything else is test. */
export function isLiveKey(key: string) {
  return /^(sk|rk|pk)_live_/.test(key.trim());
}

/**
 * Stripe credentials taken from environment secrets.
 *
 * Reads STRIPE_SECRET_KEY and STRIPE_PUBLIC_KEY (STRIPE_PUBLISHABLE_KEY is
 * accepted as an alias). The mode is derived from the secret key prefix:
 * `sk_live_`/`rk_live_` => live, anything else (including an empty key)
 * => test. Test mode is therefore always the default; live mode only ever
 * engages when production keys are explicitly provided.
 */
export function getEnvStripeCreds(): StripeCreds {
  const secretKey = env("STRIPE_SECRET_KEY");
  const publishableKey = env("STRIPE_PUBLIC_KEY") || env("STRIPE_PUBLISHABLE_KEY");
  const live = isLiveKey(secretKey);
  return {
    secretKey,
    publishableKey,
    webhookSecret: live
      ? env("STRIPE_WEBHOOK_SECRET") || env("STRIPE_LIVE_WEBHOOK_SECRET")
      : env("STRIPE_TEST_WEBHOOK_SECRET") || env("STRIPE_WEBHOOK_SECRET"),
    liveMode: live,
    source: secretKey ? "env" : "none",
  };
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

/**
 * Loads the Stripe credentials this project should charge with.
 *
 * Resolution order:
 *  1. Environment live keys (STRIPE_SECRET_KEY starting with sk_live_/rk_live_).
 *  2. Production keys saved in Payment Settings while live mode is switched on.
 *  3. Environment test keys (STRIPE_SECRET_KEY starting with sk_test_).
 *  4. Test keys saved in Payment Settings.
 *
 * With no production keys anywhere, the result is test mode — never live.
 */
export async function loadStripeCreds(): Promise<StripeCreds> {
  const envCreds = getEnvStripeCreds();

  // 1. Environment production keys win outright.
  if (envCreds.liveMode && envCreds.secretKey) return envCreds;

  // 2. Production keys saved through the Payment Settings screen.
  try {
    const { data } = await adminClient()
      .from("payment_credentials")
      .select("live_publishable_key, live_secret_key, live_webhook_secret, live_mode")
      .eq("id", "live")
      .maybeSingle();

    if (data?.live_mode && data.live_secret_key) {
      return {
        secretKey: data.live_secret_key as string,
        webhookSecret: (data.live_webhook_secret as string) || envCreds.webhookSecret,
        publishableKey: (data.live_publishable_key as string) || envCreds.publishableKey,
        liveMode: true,
        source: "payment_settings",
      };
    }
  } catch (e) {
    console.error("[stripeCreds] live lookup failed, using environment secrets:", e);
  }

  // 3. Environment test keys.
  if (envCreds.secretKey) return envCreds;

  // 4. Test keys saved in Payment Settings.
  const saved = await loadStripeTestCreds();
  return saved ?? envCreds;
}

/**
 * Loads TEST-mode credentials: environment test keys first, then the test keys
 * saved in Payment Settings. Returns null when no test secret key exists.
 */
export async function loadStripeTestCreds(): Promise<StripeCreds | null> {
  const envCreds = getEnvStripeCreds();
  if (envCreds.secretKey && !envCreds.liveMode) return envCreds;

  try {
    const { data } = await adminClient()
      .from("payment_credentials")
      .select("test_publishable_key, test_secret_key, test_webhook_secret")
      .eq("id", "live")
      .maybeSingle();

    if (data?.test_secret_key) {
      return {
        secretKey: data.test_secret_key as string,
        webhookSecret: (data.test_webhook_secret as string) ?? "",
        publishableKey: (data.test_publishable_key as string) ?? "",
        liveMode: false,
        source: "payment_settings",
      };
    }
  } catch (e) {
    console.error("[stripeCreds] test creds lookup failed:", e);
  }
  return null;
}
