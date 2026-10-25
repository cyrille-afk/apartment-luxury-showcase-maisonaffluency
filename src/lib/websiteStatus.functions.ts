import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const getWebsiteStatus = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) return { services: [], incidents: [], error: true, now: Date.now() };
  try {
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers, signal: AbortSignal.timeout(10000) });
      } },
    });
    const [services, incidents] = await Promise.all([
      client.from("website_status").select("path,available,checked_at"),
      client.from("website_status_incidents").select("id,path,started_at,resolved_at")
        .gte("started_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .order("started_at", { ascending: false }).limit(100),
    ]);
    if (services.error || incidents.error) throw new Error("Status read unavailable");
    return { services: services.data, incidents: incidents.data, error: false, now: Date.now() };
  } catch {
    return { services: [], incidents: [], error: true, now: Date.now() };
  }
});