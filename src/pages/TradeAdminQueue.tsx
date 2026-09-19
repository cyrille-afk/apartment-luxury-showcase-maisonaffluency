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
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

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

type Overview = {
  pending: number;
  processing: number;
  parked: number;
  processed_24h: number;
  cron_armed: boolean;
  has_work: boolean;
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
