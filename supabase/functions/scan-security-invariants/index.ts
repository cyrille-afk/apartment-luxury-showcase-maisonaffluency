// Scheduled hard-invariant security scan.
//
// Every few hours, this function inspects the live database for known
// critical security regressions (anon access to trade pricing, public
// tables without RLS, new SECURITY DEFINER functions callable by anon,
// etc.) and emails admins on each new violation. Dedupe / cooldown via
// the existing `security_alert_state` table.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

const ADMIN_EMAILS = ["cyrille@maisonaffluency.com"];
const ALERT_COOLDOWN_MIN = 6 * 60; // 6h between repeat alerts for same invariant

type Violation = {
  key: string;
  severity: "critical" | "high" | "warn";
  title: string;
  detail: string; // plain text shown in email body
  rows?: Record<string, unknown>[];
};

async function runChecks(supabase: ReturnType<typeof createClient>): Promise<Violation[]> {
  const v: Violation[] = [];

  // Helper to run an ad-hoc query via the SQL function we install below.
  async function q<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const { data, error } = await supabase.rpc("scan_sec_query", { _sql: sql });
    if (error) throw new Error(`${error.message} :: ${sql}`);
    return (data as T[]) ?? [];
  }

  // 1) Trade pricing columns must NOT be readable by anon.
  const pricingExposed = await q(`
    select table_name, column_name
    from information_schema.column_privileges
    where grantee = 'anon'
      and privilege_type = 'SELECT'
      and table_schema = 'public'
      and (
        (table_name = 'designer_curator_picks' and column_name in ('trade_price_cents','price_per_sqm_cents'))
        or (table_name = 'trade_product_pricing')
        or (table_name = 'featured_studios' and column_name = 'contact_email')
      )
  `);
  if (pricingExposed.length > 0) {
    v.push({
      key: "anon_sees_trade_pricing",
      severity: "critical",
      title: "Trade pricing readable by anonymous users",
      detail: `Anonymous role has SELECT on columns it must never read.`,
      rows: pricingExposed,
    });
  }

  // 2) Every table in `public` must have RLS enabled.
  const rlsOff = await q(`
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false
    order by c.relname
  `);
  if (rlsOff.length > 0) {
    v.push({
      key: "public_table_rls_off",
      severity: "critical",
      title: `Public table(s) without RLS: ${rlsOff.length}`,
      detail: "RLS is disabled on one or more public-schema tables.",
      rows: rlsOff,
    });
  }

  // 3) Tables with RLS enabled and an anon SELECT grant but ZERO policies
  //    (would silently leak nothing today, but is a footgun — flag it).
  const rlsNoPolicyButGranted = await q(`
    with anon_grants as (
      select table_name
      from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public' and privilege_type = 'SELECT'
    ),
    no_policy as (
      select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relrowsecurity = true
        and not exists (
          select 1 from pg_policy p where p.polrelid = c.oid
        )
    )
    select np.table_name from no_policy np join anon_grants ag using (table_name)
  `);
  if (rlsNoPolicyButGranted.length > 0) {
    v.push({
      key: "rls_enabled_no_policy_anon_granted",
      severity: "high",
      title: "Anon grant on RLS-enabled tables with NO policies",
      detail: "These tables grant anon SELECT but have no RLS policies — review.",
      rows: rlsNoPolicyButGranted,
    });
  }

  // 4) SECURITY DEFINER functions callable by anon — baseline diff.
  const secDefAnon = await q<{ fn: string }>(`
    select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and has_function_privilege('anon', p.oid, 'EXECUTE')
    order by 1
  `);
  const currentSet = new Set(secDefAnon.map((r) => r.fn));

  const { data: baselineRow } = await supabase
    .from("security_alert_state")
    .select("payload")
    .eq("id", "sec_def_anon_baseline")
    .maybeSingle();

  const baseline: string[] = Array.isArray((baselineRow?.payload as any)?.fns)
    ? ((baselineRow!.payload as any).fns as string[])
    : [];

  if (baseline.length === 0) {
    // First run — capture baseline, don't alert.
    await supabase.from("security_alert_state").upsert({
      id: "sec_def_anon_baseline",
      last_alerted_at: new Date().toISOString(),
      payload: { fns: Array.from(currentSet).sort() },
    });
  } else {
    const baselineSet = new Set(baseline);
    const added = [...currentSet].filter((f) => !baselineSet.has(f));
    if (added.length > 0) {
      v.push({
        key: "new_sec_def_callable_by_anon",
        severity: "critical",
        title: `New SECURITY DEFINER function(s) callable by anon: ${added.length}`,
        detail: "Review whether these should really be executable without authentication.",
        rows: added.map((fn) => ({ fn })),
      });
    }
  }

  return v;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization") ?? "";
  const expectedCron = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isCron = !!(expectedCron && cronSecret === expectedCron);
  const isService = !!(serviceKey && auth === `Bearer ${serviceKey}`);
  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  let violations: Violation[];
  try {
    violations = await runChecks(supabase);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const sent: string[] = [];
  const skipped: string[] = [];

  if (violations.length > 0) {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const cutoff = new Date(Date.now() - ALERT_COOLDOWN_MIN * 60_000).toISOString();
    for (const t of violations) {
      const { data: state } = await supabase
        .from("security_alert_state")
        .select("last_alerted_at, payload")
        .eq("id", t.key)
        .maybeSingle();
      if (state?.last_alerted_at && state.last_alerted_at > cutoff) {
        skipped.push(t.key);
        continue;
      }

      const rowsHtml = (t.rows ?? []).slice(0, 25)
        .map((r) => `<tr>${Object.values(r).map((c) => `<td style="padding:4px 10px;font-family:ui-monospace,monospace;font-size:12px;color:#1a1a1a;border-bottom:1px solid #eee;">${String(c)}</td>`).join("")}</tr>`)
        .join("");

      const badge = t.severity === "critical" ? "#b91c1c" : t.severity === "high" ? "#b45309" : "#475569";
      const html = `
        <div style="font-family:Georgia,serif;max-width:680px;margin:0 auto;padding:32px;background:#faf9f7;">
          <div style="display:inline-block;background:${badge};color:#fff;padding:4px 10px;border-radius:3px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">${t.severity}</div>
          <h2 style="font-size:20px;color:#1a1a1a;margin:12px 0 6px;">${t.title}</h2>
          <p style="color:#444;margin:0 0 18px;">${t.detail}</p>
          ${rowsHtml ? `<table style="border-collapse:collapse;background:#fff;border:1px solid #e8e5e0;border-radius:4px;width:100%;"><tbody>${rowsHtml}</tbody></table>` : ""}
          <p style="font-size:11px;color:#999;margin-top:20px;">Maison Affluency • automated invariant scan • ${new Date().toUTCString()}</p>
        </div>`;

      await Promise.allSettled(
        ADMIN_EMAILS.map((to) =>
          resend.emails.send({
            from: "Maison Affluency <noreply@notify.www.maisonaffluency.com>",
            to,
            subject: `[Security ${t.severity.toUpperCase()}] ${t.title}`,
            html,
          })
        ),
      );
      await supabase.from("security_alert_state").upsert({
        id: t.key,
        last_alerted_at: new Date().toISOString(),
        payload: { title: t.title, severity: t.severity, sample: t.rows?.slice(0, 5) ?? [] },
      });
      sent.push(t.key);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      checks_run: 4,
      violations: violations.map((v) => ({ key: v.key, severity: v.severity, count: v.rows?.length ?? 0 })),
      alerts_sent: sent,
      alerts_skipped_cooldown: skipped,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
