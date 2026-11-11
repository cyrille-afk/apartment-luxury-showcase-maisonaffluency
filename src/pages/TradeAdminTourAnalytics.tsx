import { Suspense } from 'react';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { summarizeTourActivity, type TourActivity } from '@/lib/onboardingTourActivity';
import { FELIX_STEP_ORDER } from '@/components/trade/felixTourOrder';
const api = getRouteApi('/trade/admin_/tour-analytics');
export default function TradeAdminTourAnalytics() {
  const { rolesLoaded, isAdmin, lookupFailed } = useAuth();
  if (!rolesLoaded) return <p>{lookupFailed ? 'Access could not be confirmed. Use the connection notice to retry.' : 'Checking access…'}</p>;
  if (!isAdmin) return <Navigate to="/trade" replace />;
  return <Suspense fallback={<p className="text-muted-foreground">Loading tour activity…</p>}><Dashboard /></Suspense>;
}
function Dashboard() {
  const { days, environment, tour } = api.useSearch();
  const navigate = api.useNavigate();
  const query = useSuspenseQuery(queryOptions({ queryKey: ['admin-tour-activity', days, environment, tour], refetchInterval: 30000, queryFn: async () => {
    const { data, error } = await supabase.rpc('admin_onboarding_tour_activity', { _days: days, _environment: environment, _tour: tour });
    if (error) throw error;
    return data as unknown as TourActivity;
  }}));
  const ids = tour === 'felix' ? [...FELIX_STEP_ORDER] : [...new Set(query.data.runs.flatMap(r => r.viewed_steps))];
  const summary = summarizeTourActivity(query.data.runs, ids);
  const pct = (n: number | null) => n === null ? '—' : `${n.toFixed(1)}%`;
  return <main className="max-w-6xl space-y-8 pb-12">
    <header className="flex flex-wrap justify-between gap-4 items-end"><div><p className="text-xs uppercase text-muted-foreground">Admin · Trade Programme</p><h1 className="font-display text-3xl mt-2">Onboarding Tour Activity</h1><p className="text-xs text-muted-foreground mt-2">Singapore time · Updated {new Date(query.data.updated_at).toLocaleTimeString('en-SG', { timeZone: 'Asia/Singapore' })}</p></div><div className="flex flex-wrap gap-2 items-center">
      <select aria-label="Period" className="border border-border bg-background p-2 text-sm" value={days} onChange={e => void navigate({ search: prev => ({ ...prev, days: Number(e.target.value) as 7 | 30 | 90 }) })}>{[7,30,90].map(n => <option key={n} value={n}>{n} days</option>)}</select>
      <select aria-label="Traffic" className="border border-border bg-background p-2 text-sm" value={environment} onChange={e => void navigate({ search: prev => ({ ...prev, environment: e.target.value === 'preview' ? 'preview' : 'production' }) })}><option value="production">Published</option><option value="preview">Preview</option></select>
      <select aria-label="Tour" className="border border-border bg-background p-2 text-sm" value={tour} onChange={e => void navigate({ search: prev => ({ ...prev, tour: e.target.value === 'quick' ? 'quick' : 'felix' }) })}><option value="felix">Felix walkthrough</option><option value="quick">Quick tour</option></select>
      <Button variant="ghost" size="icon" aria-label="Refresh tour activity" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4"/></Button>
    </div></header>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[['Tour starts',summary.starts],['Completed',summary.completed],['Completion rate',pct(summary.completionRate)],['Replay rate',pct(summary.replayRate)]].map(([label,value]) => <div key={label} className="border border-border rounded-md p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="font-display text-3xl mt-3">{value}</p></div>)}</div>
    <p className="text-xs text-muted-foreground">{summary.replays} replay starts / {summary.starts} tour starts · {summary.pending} still open or recently active. Completion and replay rates use runs started in this period, not people.</p>
    <p className="text-xs text-muted-foreground">New consented activity only; earlier analytics are not backfilled. {query.data.started_at ? `Tracking since ${new Date(query.data.started_at).toLocaleString('en-SG', {timeZone:'Asia/Singapore'})}.` : 'No recorded tour activity for these filters yet.'} Published and preview activity are separate.</p>
    <section className="space-y-4"><h2 className="font-display text-xl">Starts & completions by start day</h2>{summary.starts ? <div className="h-64"><ResponsiveContainer><LineChart data={summary.days}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="day" tick={{fontSize:10}}/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line dataKey="starts" name="Starts" stroke="hsl(var(--foreground))"/><Line dataKey="completed" name="Completed" stroke="hsl(var(--gold))"/></LineChart></ResponsiveContainer></div> : <p className="text-sm text-muted-foreground">Awaiting tour starts.</p>}</section>
    <section className="space-y-4"><h2 className="font-display text-xl">Where tours stop</h2><p className="text-xs text-muted-foreground">Drop-offs are unfinished runs explicitly closed or inactive for 30 minutes, assigned to their last recorded step. Recently active runs stay pending; skipped steps are not assumed to have been viewed.</p>{summary.starts > 0 && <div className="h-72"><ResponsiveContainer><BarChart data={summary.steps}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" hide/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar dataKey="reached" name="Reached" fill="hsl(var(--foreground))"/><Bar dataKey="dropped" name="Stopped here" fill="hsl(var(--gold))"/></BarChart></ResponsiveContainer></div>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-3">Step</th><th className="text-right">Reached</th><th className="text-right">Stopped here</th><th className="text-right">Drop-off rate</th></tr></thead><tbody>{summary.steps.map((r,i) => <tr className="border-b border-border" key={r.id}><td className="py-3 pr-4">{i+1}. {r.label}</td><td className="text-right">{r.reached}</td><td className="text-right">{r.dropped}</td><td className="text-right">{pct(r.reached ? r.dropped/r.reached*100 : null)}</td></tr>)}</tbody></table></div></section>
  </main>;
}