// Public uptime monitor for www.maisonaffluency.com.
// Runs every 5 minutes via pg_cron. Fetches each key public page, expects
// HTTP 200 and a marker string in the HTML. After 2 consecutive failures
// on any page, emails the admins once; emails again when the page recovers.
// State lives in public.uptime_monitor_state (service-role only).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { sendLovableEmail } from "../_shared/lovableEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

const ADMIN_EMAILS = [
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];

const BASE = "https://www.maisonaffluency.com";
const PAGES: { path: string; label: string; marker: string }[] = [
  { path: "/", label: "Homepage", marker: "Maison Affluency" },
  { path: "/designers", label: "Designers directory", marker: "Designers" },
  { path: "/gallery", label: "Gallery", marker: "Gallery" },
  { path: "/trade-program", label: "Trade Program", marker: "Trade" },
];

const FAIL_THRESHOLD = 2; // consecutive failures before alerting
const FETCH_TIMEOUT_MS = 20000;

type CheckResult = {
  path: string;
  label: string;
  ok: boolean;
  status: number | null;
  error?: string;
  durationMs: number;
};

async function checkPage(p: { path: string; label: string; marker: string }): Promise<CheckResult> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(BASE + p.path, {
      signal: controller.signal,
      headers: { "User-Agent": "MA-UptimeMonitor/1.0" },
      redirect: "follow",
    });
    clearTimeout(timer);
    const body = await res.text();
    const ok = res.status === 200 && body.includes(p.marker);
    return {
      path: p.path,
      label: p.label,
      ok,
      status: res.status,
      error: ok ? undefined : (res.status !== 200 ? `HTTP ${res.status}` : `marker "${p.marker}" missing`),
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      path: p.path,
      label: p.label,
      ok: false,
      status: null,
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - started,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  const expectedCron = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const isCron = expectedCron && cronSecret === expectedCron;
  const isService = serviceKey && auth === `Bearer ${serviceKey}`;
  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const results: CheckResult[] = [];
  for (const p of PAGES) results.push(await checkPage(p));

  const newlyDown: CheckResult[] = [];
  const recovered: CheckResult[] = [];

  for (const r of results) {
    const { data: row } = await supabase
      .from("uptime_monitor_state")
      .select("consecutive_failures, alerted")
      .eq("path", r.path)
      .maybeSingle();

    const prevFailures = row?.consecutive_failures ?? 0;
    const wasAlerted = row?.alerted ?? false;
    const failures = r.ok ? 0 : prevFailures + 1;
    const shouldAlert = !r.ok && failures >= FAIL_THRESHOLD && !wasAlerted;
    const shouldRecover = r.ok && wasAlerted;

    await supabase.from("uptime_monitor_state").upsert({
      path: r.path,
      label: r.label,
      consecutive_failures: failures,
      alerted: shouldAlert ? true : shouldRecover ? false : wasAlerted,
      last_status: r.status,
      last_error: r.error ?? null,
      last_duration_ms: r.durationMs,
      last_checked_at: new Date().toISOString(),
    }, { onConflict: "path" });

    if (shouldAlert) newlyDown.push(r);
    if (shouldRecover) recovered.push(r);
  }

  const checkedAt = new Date().toUTCString();

  if (newlyDown.length > 0) {
    const rows = newlyDown.map((r) =>
      `<tr><td style="padding:8px 12px;border:1px solid #ddd;">${r.label}</td>` +
      `<td style="padding:8px 12px;border:1px solid #ddd;">${BASE}${r.path}</td>` +
      `<td style="padding:8px 12px;border:1px solid #ddd;">${r.error ?? "unknown"}</td></tr>`
    ).join("");
    const html = `
      <div style="font-family:Georgia,serif;color:#1a1a1a;max-width:640px;">
        <h2 style="color:#8B1E1E;">Uptime alert — ${newlyDown.length} page${newlyDown.length > 1 ? "s" : ""} not loading</h2>
        <p>The public uptime monitor detected ${FAIL_THRESHOLD} consecutive failures (checked ${checkedAt}):</p>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
          <tr style="background:#f5f2ec;"><th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Page</th><th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">URL</th><th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Error</th></tr>
          ${rows}
        </table>
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#555;">You will receive one recovery email per page once it loads again. Checks run every 5 minutes.</p>
      </div>`;
    for (const to of ADMIN_EMAILS) {
      await sendLovableEmail(supabase, {
        to,
        subject: `[Uptime] ${newlyDown.map((r) => r.label).join(", ")} not loading — maisonaffluency.com`,
        html,
        category: "uptime-alert",
      });
    }
  }

  for (const r of recovered) {
    const html = `
      <div style="font-family:Georgia,serif;color:#1a1a1a;max-width:640px;">
        <h2 style="color:#1A535C;">Recovered — ${r.label} is loading again</h2>
        <p style="font-family:Arial,sans-serif;font-size:14px;">${BASE}${r.path} responded with HTTP ${r.status} in ${r.durationMs}ms (checked ${checkedAt}).</p>
      </div>`;
    for (const to of ADMIN_EMAILS) {
      await sendLovableEmail(supabase, {
        to,
        subject: `[Uptime] Recovered: ${r.label} — maisonaffluency.com`,
        html,
        category: "uptime-recovery",
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
