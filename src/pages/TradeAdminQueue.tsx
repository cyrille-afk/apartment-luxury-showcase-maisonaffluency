/**
 * Operations control centre for the asynchronous event queue
 * (`public.webhook_events`). Admin-only: every read and the force-retry action
 * go through SECURITY DEFINER RPCs that gate on `has_role`.
 */
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, ShieldAlert, Activity, Wifi, WifiOff, HeartPulse } from "lucide-react";
import { useRealtimeTables, useRealtimeConnected } from "@/contexts/RealtimeMultiplexerContext";

type ParkedRow = {
  id: string;
  created_at: string;
  updated_at: string;
  event_id: string;
  event_type: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  payload: unknown;
};

type AckLatency = {
  samples: number | null;
  avg_ms: number | null;
  p95_ms: number | null;
  max_ms: number | null;
  over_2s: number | null;
};

type RecentEvent = {
  id: string;
  event_id: string;
  event_type: string;
  status: string;
  attempts: number;
  ack_ms: number | null;
  created_at: string;
  processed_at: string | null;
};

type WorkerHealth = {
  last_start_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  boot_ok: boolean;
};

type PendingAge = {
  oldest_pending_age_seconds: number | null;
  oldest_pending_event_id: string | null;
  stalled_over_10m: number | null;
};

type Overview = {
  pending: number;
  processing: number;
  parked: number;
  processed_24h: number;
  cron_armed: boolean;
  has_work: boolean;
  ack_latency: AckLatency | null;
  recent: RecentEvent[] | null;
  worker_health: WorkerHealth | null;
  pending_age: PendingAge | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-500/40 text-amber-600",
  processing: "border-sky-500/40 text-sky-600 animate-pulse",
  processed: "border-emerald-500/40 text-emerald-600",
  failed: "border-destructive/40 text-destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  processed: "Succeeded",
  failed: "Parked",
};

/** Best-effort classification of the downstream service that blew up. */
function classifyFailedService(error: string | null): string {
  const msg = (error ?? "").toLowerCase();
  const table: Array<[RegExp, string]> = [
    [/twilio|whatsapp/, "Twilio / WhatsApp"],
    [/resend|transactional-email|email queue/, "Resend / Email"],
    [/slack/, "Slack"],
    [/purchase[- _]?order|dispatch-designer/, "Supplier PO Dispatch"],
    [/pdf|pdf-lib|fontkit/, "PDF Generator"],
    [/stripe/, "Stripe API"],
    [/storage|bucket|signed url/, "Storage"],
    [/supabase|postgres|pgrst|row-level security/, "Database"],
  ];
  for (const [re, label] of table) if (re.test(msg)) return label;
  return "Queue Worker (unclassified)";
}

function payloadContext(payload: unknown): { reference: string | null; client: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = (payload as any)?.data?.object ?? {};
  const meta = obj?.metadata ?? {};
  const reference: string | null =
    meta.quote_id ?? meta.quoteId ?? meta.order_id ?? meta.shop_order_id ?? obj?.id ?? null;
  const client: string =
    meta.client_name ||
    obj?.customer_details?.name ||
    obj?.customer_details?.email ||
    obj?.receipt_email ||
    meta.client_email ||
    "Unknown client";
  return { reference, client };
}

function MetricCard({
  label,
  value,
  critical,
  loading,
}: {
  label: string;
  value: number | undefined;
  critical?: boolean;
  loading: boolean;
}) {
  return (
    <Card
      className={`p-5 ${
        critical && (value ?? 0) > 0
          ? "border-destructive/50 bg-destructive/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {critical && (value ?? 0) > 0 && (
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
        )}
        {label}
      </div>
      <div
        className={`mt-3 font-serif text-3xl ${
          critical && (value ?? 0) > 0 ? "text-destructive" : "text-foreground"
        }`}
      >
        {loading ? "—" : (value ?? 0)}
      </div>
    </Card>
  );
}

export default function TradeAdminQueue() {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState<string | null>(null);

  const enabled = !!user && isAdmin;
  const realtimeConnected = useRealtimeConnected();

  // Live status transitions (pending -> processing -> processed) arrive through
  // the shared realtime channel, so the panel repaints without waiting for a poll.
  useRealtimeTables(
    "webhook_events",
    () => {
      queryClient.invalidateQueries({ queryKey: ["admin-queue-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-queue-parked"] });
    },
    enabled,
  );

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["admin-queue-overview"],
    enabled,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_queue_overview");
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  const { data: parked, isLoading: parkedLoading } = useQuery({
    queryKey: ["admin-queue-parked"],
    enabled,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_events")
        .select("id, created_at, updated_at, event_id, event_type, attempts, max_attempts, last_error, payload")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ParkedRow[];
    },
  });

  const forceRetry = async (row: ParkedRow) => {
    setRetrying(row.id);
    try {
      const { error } = await supabase.rpc("admin_requeue_webhook_event", { p_id: row.id });
      if (error) throw error;
      toast.success("Job re-entered the active queue", {
        description: `${row.event_type} — retry counter reset, worker woken.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-queue-parked"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-queue-overview"] }),
      ]);
    } catch (e) {
      toast.error("Force retry failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setRetrying(null);
    }
  };

  if (loading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!enabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <h1 className="font-serif text-2xl">403 — Forbidden</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The event queue control centre is restricted to internal administrators and operations
          staff.
        </p>
        <Link to="/trade" className="text-sm underline underline-offset-4">
          Return to the Trade Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Helmet>
        <title>Event Queue Control — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Link
        to="/trade/admin-dashboard"
        className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Admin dashboard
      </Link>

      <div className="mb-8">
        <h1 className="font-serif text-3xl">Event Queue Control</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Asynchronous payment and fulfilment jobs. Parked jobs have exhausted their automatic
          retry pool and require manual review.
          {overview?.cron_armed ? " Safety timer armed." : " Safety timer idle."}
        </p>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Pending" value={overview?.pending} loading={overviewLoading} />
        <MetricCard label="Processing" value={overview?.processing} loading={overviewLoading} />
        <MetricCard label="Parked for review" value={overview?.parked} critical loading={overviewLoading} />
        <MetricCard label="Succeeded (24h)" value={overview?.processed_24h} loading={overviewLoading} />
      </div>

      {(() => {
        const h = overview?.worker_health ?? null;
        const age = overview?.pending_age ?? null;
        const oldestMinutes = Math.floor((age?.oldest_pending_age_seconds ?? 0) / 60);
        const lastSuccessMinutes = h?.last_success_at
          ? Math.floor((Date.now() - new Date(h.last_success_at).getTime()) / 60000)
          : null;
        const bootFailed = h ? h.boot_ok === false : false;
        const stalled = oldestMinutes >= 15;
        const failing = (h?.consecutive_failures ?? 0) >= 3;
        const unhealthy = bootFailed || stalled || failing;

        return (
          <>
            <div className="mb-4 flex items-center gap-2">
              <HeartPulse className={`h-4 w-4 ${unhealthy ? "text-destructive" : "text-emerald-600"}`} />
              <h2 className="font-serif text-xl">Worker health</h2>
              <Badge
                variant="outline"
                className={unhealthy ? "border-destructive/40 text-destructive animate-pulse" : "border-emerald-500/40 text-emerald-600"}
              >
                {unhealthy ? "Attention required" : "Healthy"}
              </Badge>
            </div>

            <Card className={`mb-10 p-5 ${unhealthy ? "border-destructive/40" : ""}`}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Startup check</div>
                  <div className={`mt-2 font-serif text-2xl ${bootFailed ? "text-destructive" : "text-emerald-600"}`}>
                    {h == null ? "—" : bootFailed ? "Failed" : "OK"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last successful run</div>
                  <div className="mt-2 font-serif text-2xl">
                    {lastSuccessMinutes == null ? "—" : `${lastSuccessMinutes} min ago`}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Oldest pending</div>
                  <div className={`mt-2 font-serif text-2xl ${stalled ? "text-destructive" : ""}`}>
                    {age?.oldest_pending_age_seconds ? `${oldestMinutes} min` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Consecutive failures</div>
                  <div className={`mt-2 font-serif text-2xl ${failing ? "text-destructive" : ""}`}>
                    {h?.consecutive_failures ?? 0}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {h?.last_error
                  ? `Last error: ${h.last_error.slice(0, 220)}`
                  : "The watchdog probes the worker every 10 minutes and alerts operations if the startup check fails or an event waits longer than 15 minutes."}
                {(age?.stalled_over_10m ?? 0) > 0
                  ? ` ${age?.stalled_over_10m} event(s) queued for over 10 minutes.`
                  : ""}
              </p>
            </Card>
          </>
        );
      })()}

      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-serif text-xl">Stripe acknowledgement speed (24h)</h2>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {realtimeConnected ? (
            <><Wifi className="h-3.5 w-3.5 text-emerald-600" /> Live</>
          ) : (
            <><WifiOff className="h-3.5 w-3.5" /> Reconnecting</>
          )}
        </span>
      </div>

      <Card className="mb-10 p-5">
        {(() => {
          const l = overview?.ack_latency;
          const breach = (l?.over_2s ?? 0) > 0;
          return (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Average", l?.avg_ms],
                  ["P95", l?.p95_ms],
                  ["Slowest", l?.max_ms],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
                    <div className="mt-2 font-serif text-2xl">
                      {value == null ? "—" : `${value} ms`}
                    </div>
                  </div>
                ))}
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Over 2s</div>
                  <div className={`mt-2 font-serif text-2xl ${breach ? "text-destructive" : "text-emerald-600"}`}>
                    {l?.over_2s ?? 0}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {l?.samples
                  ? `${l.samples} live webhook${l.samples === 1 ? "" : "s"} measured. ${
                      breach
                        ? "One or more acknowledgements exceeded the 2 second Stripe SLA."
                        : "Every acknowledgement returned HTTP 200 within the 2 second Stripe SLA."
                    }`
                  : "No webhooks received in the last 24 hours."}
              </p>
            </>
          );
        })()}
      </Card>

      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-serif text-xl">Live event stream</h2>
      </div>

      <Card className="mb-10 overflow-hidden">
        {!overview?.recent?.length ? (
          <div className="p-8 text-sm text-muted-foreground">No events recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-3 font-normal">Received</th>
                  <th className="px-4 py-3 font-normal">Event</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Ack speed</th>
                  <th className="px-4 py-3 font-normal">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {overview.recent.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.event_type}</div>
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">{row.event_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={STATUS_STYLES[row.status] ?? ""}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 ${(row.ack_ms ?? 0) > 2000 ? "text-destructive" : ""}`}>
                      {row.ack_ms == null ? "—" : `${row.ack_ms} ms`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h2 className="font-serif text-xl">Parked jobs</h2>
      </div>

      <Card className="overflow-hidden">
        {parkedLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading parked jobs…</div>
        ) : !parked?.length ? (
          <div className="p-8 text-sm text-muted-foreground">
            No parked jobs. Every queued event has been processed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-3 font-normal">Timestamp</th>
                  <th className="px-4 py-3 font-normal">Reference</th>
                  <th className="px-4 py-3 font-normal">Client</th>
                  <th className="px-4 py-3 font-normal">Failing service</th>
                  <th className="px-4 py-3 font-normal">Error</th>
                  <th className="px-4 py-3 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {parked.map((row) => {
                  const { reference, client } = payloadContext(row.payload);
                  const service = classifyFailedService(row.last_error);
                  return (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                        {new Date(row.updated_at || row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs">{reference ?? row.event_id}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{row.event_type}</div>
                      </td>
                      <td className="px-4 py-4">{client}</td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          {service}
                        </Badge>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.attempts}/{row.max_attempts} attempts
                        </div>
                      </td>
                      <td className="max-w-[360px] px-4 py-4 text-xs text-muted-foreground">
                        {row.last_error ?? "No error message recorded"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => forceRetry(row)}
                          disabled={retrying === row.id}
                        >
                          {retrying === row.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          )}
                          Force Retry
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
