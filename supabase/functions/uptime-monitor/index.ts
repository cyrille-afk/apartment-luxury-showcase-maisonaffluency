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

// Checkout & payment backend functions. Each gets a harmless CORS preflight
// (no body, no auth, no side effects); a function that failed to start answers
// 5xx (BOOT_ERROR / WORKER_ERROR) or not at all. Anything below 500 = running.
const FUNCTIONS_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const PAYMENT_FUNCTIONS = [
  "create-cart-checkout", "create-payment-intent", "create-bank-transfer-intent",
  "create-proforma-order", "create-quote-payment", "guest-quote-checkout",
  "create-ffe-checkout", "create-adhoc-payment-link", "verify-adhoc-payment",
  "refresh-shipping-quote", "request-wire-transfer", "get-order-by-session",
  "mark-order-paid", "stripe-webhook", "stripe-config", "stripe-connect-onboard",
  "notify-payment-alerts", "send-client-quote-payment",
];

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function checkFunction(name: string): Promise<CheckResult> {
  const started = Date.now();
  const path = `fn:${name}`;
  const label = `Checkout function: ${name}`;
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
      method: "OPTIONS",
      headers: { Origin: BASE, "Access-Control-Request-Method": "POST" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = (await res.text()).slice(0, 200);
    const ok = res.status < 500;
    return { path, label, ok, status: res.status, error: ok ? undefined : `HTTP ${res.status} ${body}`, durationMs: Date.now() - started };
  } catch (e) {
    return { path, label, ok: false, status: null, error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - started };
  }
}

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
  // Optional extra function names (authenticated callers only) — used to prove
  // the alert path with a deliberately broken probe function.
  let extra: string[] = [];
  try {
    const b = await req.json();
    if (Array.isArray(b?.probeFunctions)) {
      extra = b.probeFunctions.filter((n: unknown) => typeof n === "string" && /^[a-z0-9-]{1,64}$/.test(n)).slice(0, 5);
    }
  } catch { /* empty body from cron */ }
  results.push(...await Promise.all([...PAYMENT_FUNCTIONS, ...extra].map(checkFunction)));

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
      `<tr><td style="padding:8px 12px;border:1px solid #ddd;">${esc(r.label)}</td>` +
      `<td style="padding:8px 12px;border:1px solid #ddd;">${esc(r.path.startsWith("fn:") ? "backend function" : BASE + r.path)}</td>` +
      `<td style="padding:8px 12px;border:1px solid #ddd;">${esc(r.error ?? "unknown")}</td></tr>`
    ).join("");
    const html = `
      <div style="font-family:Georgia,serif;color:#1a1a1a;max-width:640px;">
        <h2 style="color:#8B1E1E;">Uptime alert — ${newlyDown.length} item${newlyDown.length > 1 ? "s" : ""} down${newlyDown.some((r) => r.path.startsWith("fn:")) ? " (checkout / payments affected)" : ""}</h2>
        <p>The public uptime monitor detected ${FAIL_THRESHOLD} consecutive failures (checked ${checkedAt}):</p>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
          <tr style="background:#f5f2ec;"><th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Page</th><th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">URL</th><th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Error</th></tr>
          ${rows}
        </table>
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#555;">You will receive one recovery email per page once it loads again. Checks run every 5 minutes.</p>
      </div>`;
    for (const to of ADMIN_EMAILS) {
      await sendLovableEmail({
        to,
        subject: `[Uptime] ${newlyDown.some((r) => r.path.startsWith("fn:")) ? "CHECKOUT DOWN: " : ""}${newlyDown.map((r) => r.label).join(", ")} not working — maisonaffluency.com`,
        html,
        label: "uptime-alert",
      }, supabase);
    }
  }

  for (const r of recovered) {
    const html = `
      <div style="font-family:Georgia,serif;color:#1a1a1a;max-width:640px;">
        <h2 style="color:#1A535C;">Recovered — ${esc(r.label)} is working again</h2>
        <p style="font-family:Arial,sans-serif;font-size:14px;">${esc(r.path.startsWith("fn:") ? r.label : BASE + r.path)} responded with HTTP ${r.status} in ${r.durationMs}ms (checked ${checkedAt}).</p>
      </div>`;
    for (const to of ADMIN_EMAILS) {
      await sendLovableEmail({
        to,
        subject: `[Uptime] Recovered: ${r.label} — maisonaffluency.com`,
        html,
        label: "uptime-recovery",
      }, supabase);
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
