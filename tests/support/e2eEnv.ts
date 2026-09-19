/**
 * Shared helpers for the integration suite (tests/*.spec.ts).
 *
 * Deliberately dependency-free: reads .env directly so CI without secrets can
 * still load the file and let each spec skip cleanly.
 */
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

function loadDotEnv(path = ".env"): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/i);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

const envFile = loadDotEnv();
export const env = (key: string): string | undefined => process.env[key] ?? envFile[key];

export const SUPABASE_URL = env("VITE_SUPABASE_URL");
export const SUPABASE_ANON_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface SignedInSession {
  client: SupabaseClient;
  accessToken: string;
  refreshToken: string;
  userId: string;
  raw: Record<string, unknown>;
}

/** Sign in with password and return a client already carrying the session. */
export async function signIn(email: string, password: string): Promise<SignedInSession> {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`[e2e] sign-in failed for ${email}: ${error?.message ?? "no session"}`);
  }
  const s = data.session;
  return {
    client,
    accessToken: s.access_token,
    refreshToken: s.refresh_token,
    userId: s.user.id,
    raw: {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      expires_in: s.expires_in,
      token_type: "bearer",
      user: s.user,
    },
  };
}

/** Plant a Supabase session in the SPA so it boots authenticated. */
export async function plantSession(page: Page, session: SignedInSession, bootPath = "/trade/login") {
  const projectRef = new URL(SUPABASE_URL!).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  await page.goto(bootPath, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [storageKey, JSON.stringify(session.raw)],
  );
}

/**
 * Build a Stripe-compatible `Stripe-Signature` header.
 * Mirrors Stripe's scheme: `t=<unix>,v1=HMAC_SHA256(secret, "<t>.<payload>")`.
 */
export function stripeSignature(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

/** A minimal, side-effect-free Stripe event (`invoice.paid` is a no-op for our processor). */
export function syntheticInvoicePaidEvent(eventId: string) {
  return {
    id: eventId,
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type: "invoice.paid",
    data: {
      object: {
        id: `in_e2e_${Date.now()}`,
        object: "invoice",
        currency: "hkd",
        amount_paid: 1000,
        metadata: { e2e: "checkout-flow-spec" },
      },
    },
  };
}
