import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowLeft, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { duration, processingRate, providerStatus, type StripeMetrics } from '@/lib/stripeMetrics';

const chartConfig = {
  received: { label: 'Live receipts', color: 'hsl(var(--info))' },
  processed: { label: 'Processed', color: 'hsl(var(--success))' },
  failed: { label: 'Processing failures', color: 'hsl(var(--destructive))' },
  signature_errors: { label: 'Signature errors · mode unverified', color: 'hsl(var(--warning))' },
  ack_ms: { label: 'Acknowledgement (ms)', color: 'hsl(var(--info))' },
  processing_ms: { label: 'Receipt → processed (ms)', color: 'hsl(var(--success))' },
  delivery_ms: { label: 'Stripe creation → receipt (ms)', color: 'hsl(var(--warning))' },
  missing_live_events: { label: 'Undelivered live events', color: 'hsl(var(--destructive))' },
};
const utc = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
function Stat({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <div className="border-l border-border pl-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-2 font-display text-2xl text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}
export default function TradeAdminStripeMetrics() {
  const { user, isAdmin, isSuperAdmin, rolesLoaded } = useAuth();
  const [days, setDays] = useState(7);
  const enabled = !!user && rolesLoaded && (isAdmin || isSuperAdmin);
  const query = useQuery({
    queryKey: ['admin-stripe-metrics', days, user?.id], enabled, refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stripe_metrics', { _days: days });
      if (error) throw error;
      return data as unknown as StripeMetrics;
    },
  });
  const data = query.data;
  const rate = data ? processingRate(data.totals.received, data.totals.processed) : null;
  const tick = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', ...(days === 1 ? { hour: '2-digit' } : { day: '2-digit', month: 'short' }) });
  const provider = data?.provider_latest;
  const healthy = provider?.available && provider.missing_live_events === 0 && Date.now() - Date.parse(provider.checked_at) <= 20 * 60000;
  return <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6">
    <Helmet><title>Stripe Monitoring — Maison Affluency</title><meta name="description" content="Private Stripe delivery and processing monitoring." /><meta name="robots" content="noindex, nofollow" /></Helmet>
    {!rolesLoaded ? <p className="text-muted-foreground">Checking access…</p> : !enabled ? <p className="text-destructive">Administrator access required.</p> : <>
      <Link to="/trade/admin-dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Admin dashboard</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="font-display text-3xl text-foreground">Stripe Monitoring</h1><p className="mt-2 text-sm text-muted-foreground">Live events · All times UTC</p></div>
        <div className="flex items-center gap-3"><Tabs value={String(days)} onValueChange={v => setDays(Number(v))}><TabsList><TabsTrigger value="1">24 hours</TabsTrigger><TabsTrigger value="7">7 days</TabsTrigger><TabsTrigger value="30">30 days</TabsTrigger></TabsList></Tabs>
          <Button variant="outline" size="icon" aria-label="Refresh Stripe metrics" title="Refresh Stripe metrics" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /></Button></div>
      </header>
      {query.isError ? <div role="alert" className="border-l-2 border-destructive pl-4 text-destructive">Stripe metrics could not be loaded. <Button variant="link" onClick={() => query.refetch()}>Retry</Button></div> : !data ? <p className="text-muted-foreground">Loading Stripe metrics…</p> : <>
        <section className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
          <div className="flex items-center gap-3"><Activity className={`h-5 w-5 ${healthy ? 'text-foreground' : 'text-destructive'}`} /><div><p className="font-medium text-foreground">{providerStatus(provider ?? null, Date.now())}</p><p className="mt-1 text-xs text-muted-foreground">{provider ? `Stripe checked ${utc(provider.checked_at)} UTC · ${provider.available ? provider.missing_live_events : '—'} missing live deliveries` : 'Provider history begins with the next scheduled check'}</p></div></div>
          <Link to="/trade/admin/queue" className="text-sm text-foreground underline underline-offset-4">Open event queue</Link>
        </section>
        <div className="grid grid-cols-2 gap-y-6 lg:grid-cols-4">
          <Stat title="Live receipts processed" value={rate === null ? '—' : `${rate.toFixed(1)}%`} detail={`${data.totals.processed} / ${data.totals.received} received events`} />
          <Stat title="Signature errors" value={String(data.signature_errors)} detail="Rejected requests · live/test unverified" />
          <Stat title="Processing delay · P95" value={duration(data.totals.p95_processing_ms)} detail={`Average ${duration(data.totals.processing_ms)}`} />
          <Stat title="Awaiting processing" value={String(data.totals.pending)} detail={`${data.totals.failed} failed · average ACK ${duration(data.totals.ack_ms)}`} />
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="min-w-0"><h2 className="mb-4 font-display text-lg">Live receipts & processing</h2><ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto"><BarChart data={data.series}><CartesianGrid vertical={false} /><XAxis dataKey="at" tickFormatter={tick} minTickGap={25} /><YAxis allowDecimals={false} width={40} /><ChartTooltip content={<ChartTooltipContent labelFormatter={utc} />} /><Bar dataKey="received" fill="var(--color-received)" /><Bar dataKey="processed" fill="var(--color-processed)" /><Bar dataKey="failed" fill="var(--color-failed)" /></BarChart></ChartContainer></section>
          <section className="min-w-0"><h2 className="mb-4 font-display text-lg">Signature errors · mode unverified</h2><ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto"><BarChart data={data.series}><CartesianGrid vertical={false} /><XAxis dataKey="at" tickFormatter={tick} minTickGap={25} /><YAxis allowDecimals={false} width={40} /><ChartTooltip content={<ChartTooltipContent labelFormatter={utc} />} /><Bar dataKey="signature_errors" fill="var(--color-signature_errors)" /></BarChart></ChartContainer></section>
          <section className="min-w-0"><h2 className="mb-1 font-display text-lg">Average delays</h2><p className="mb-4 text-xs text-muted-foreground">Receipt → processed · Acknowledgement · Stripe creation → receipt</p><ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto"><LineChart data={data.series}><CartesianGrid vertical={false} /><XAxis dataKey="at" tickFormatter={tick} minTickGap={25} /><YAxis yAxisId="processing" tickFormatter={v => duration(Number(v))} width={65} /><YAxis yAxisId="delivery" orientation="right" tickFormatter={v => duration(Number(v))} width={65} /><ChartTooltip content={<ChartTooltipContent labelFormatter={utc} />} />{(['processing_ms', 'ack_ms', 'delivery_ms'] as const).map(key => <Line key={key} yAxisId={key === 'delivery_ms' ? 'delivery' : 'processing'} type="monotone" dataKey={key} stroke={`var(--color-${key})`} dot={false} connectNulls={false} />)}</LineChart></ChartContainer></section>
          <section className="min-w-0"><h2 className="mb-1 font-display text-lg">Undelivered live events</h2><p className="mb-4 text-xs text-muted-foreground">Provider checks every 10 minutes · Unavailable checks are gaps</p>{data.provider_history.length ? <ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto"><LineChart data={data.provider_history.map(c => ({ ...c, missing_live_events: c.available ? c.missing_live_events : null }))}><CartesianGrid vertical={false} /><XAxis dataKey="checked_at" tickFormatter={tick} minTickGap={25} /><YAxis width={40} allowDecimals={false} /><ChartTooltip content={<ChartTooltipContent labelFormatter={utc} />} /><Line dataKey="missing_live_events" stroke="var(--color-missing_live_events)" connectNulls={false} dot /></LineChart></ChartContainer> : <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No provider history yet</div>}</section>
        </div>
        <section><h2 className="mb-4 font-display text-lg">Recent live events</h2><div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{['Received (UTC)', 'Event', 'Status', 'Attempts', 'ACK', 'Processing', 'Delivery delay'].map(x => <th className="px-3 py-3 font-medium" key={x}>{x}</th>)}</tr></thead><tbody>{data.recent.map(e => <tr className="border-b border-border" key={e.event_id}><td className="px-3 py-3">{utc(e.created_at)}</td><td className="px-3 py-3"><p>{e.event_type}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{e.event_id}</p></td><td className={`px-3 py-3 ${e.status === 'failed' ? 'text-destructive' : 'text-foreground'}`}>{e.status}</td><td className="px-3 py-3">{e.attempts}</td><td className="px-3 py-3">{duration(e.ack_ms)}</td><td className="px-3 py-3">{duration(e.processing_ms)}</td><td className="px-3 py-3">{duration(e.delivery_ms)}</td></tr>)}</tbody></table></div>{!data.recent.length && <p className="py-6 text-sm text-muted-foreground">No live events in this period.</p>}</section>
        <p className="text-xs text-muted-foreground">Updated {utc(data.checked_at)} UTC · Receipt metrics exclude test events. Delivery delay includes Stripe retries.</p>
      </>}
    </>}
  </div>;
}