import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  loadStripeCreds,
  loadStripeTestCreds,
  type StripeCreds,
} from "./stripeCreds.ts";

export const STRIPE_API_VERSION = "2025-08-27.basil";

export type StripeHandle = {
  stripe: Stripe;
  creds: StripeCreds;
  /** true only when the resolved secret key carries a live prefix. */
  liveMode: boolean;
  /** "env" | "payment_settings" | "none" */
  source: StripeCreds["source"];
};

/**
 * Single initialization point for Stripe in the backend.
 *
 * `mode: "auto"`  — resolves through the credential priority chain
 *                   (env live → saved live → env test → saved test) and
 *                   falls back to test mode whenever no live key is present.
 * `mode: "test"`  — forces the test lane; throws when no test key exists.
 */
export async function getStripe(mode: "auto" | "test" = "auto"): Promise<StripeHandle> {
  const creds = mode === "test" ? await loadStripeTestCreds() : await loadStripeCreds();

  if (!creds || !creds.secretKey) {
    throw new Error(
      mode === "test"
        ? "No Stripe test keys available. Add them in Payment Settings → Test credentials."
        : "No Stripe keys configured. Add them in Payment Settings.",
    );
  }

  // Fail-safe: a key without a live prefix can never be reported as live.
  const liveMode = /^(sk|rk)_live_/.test(creds.secretKey);

  return {
    stripe: new Stripe(creds.secretKey, { apiVersion: STRIPE_API_VERSION }),
    creds: { ...creds, liveMode },
    liveMode,
    source: creds.source,
  };
}
