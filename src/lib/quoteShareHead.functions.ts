import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { SharedQuoteSnapshot } from "./quoteClientShare";
import { quoteAccessToken, quoteShareIdentity } from "./quoteSharePresentation";

export const getQuoteShareHead = createServerFn({ method: "GET" })
  .inputValidator((input: { segment: string }) => ({ token: quoteAccessToken(String(input?.segment ?? "")) }))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    if (!data.token) return quoteShareIdentity(null);
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Quote preview is temporarily unavailable.");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    // Existing RPC enforces hashed token, expiry and revocation. Never read Trade tables.
    const { data: snapshot, error } = await client.rpc("get_shared_quote", { _token: data.token });
    if (error) throw new Error("Quote preview is temporarily unavailable.");
    return quoteShareIdentity(snapshot as unknown as SharedQuoteSnapshot | null);
  });