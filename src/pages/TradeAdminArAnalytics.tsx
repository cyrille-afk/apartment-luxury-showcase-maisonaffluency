import { Suspense } from 'react';
import { getRouteApi, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ArrowLeft, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from '@/lib/router-compat';
import { getArAnalytics } from '@/lib/arAnalytics.functions';
import { arDailySeries, fallbackRate, type ArSurface } from '@/lib/arAnalytics';

const api = getRouteApi('/trade/admin_/ar-analytics');
const surfaces: Record<ArSurface, string> = { all: 'All experiences', board: 'Moodboards', 'viewing-room': 'Private viewing rooms', product: 'Product viewers' };
const percentage = (n: number | null) => n === null ? '—' : `${n.toFixed(1)}%`;
const stamp = (s: string) => new Date(s).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function TradeAdminArAnalytics() {
  const { rolesLoaded, isAdmin, lookupFailed } = useAuth();
  if (!rolesLoaded) return <p className="text-muted-foreground">{lookupFailed ? 'Access could not be confirmed. Use the connection notice to retry.' : 'Checking access…'}</p>;
  if (!isAdmin) return <Navigate to="/trade" replace />;
  return <Suspense fallback={<p className="text-muted-foreground">Loading AR activity…</p>}><Dashboard /></Suspense>;
}

function Dashboard() {
  const fetchActivity = useServerFn(getArAnalytics);
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ['admin-ar-analytics'], queryFn: () => fetchActivity(), staleTime: Infinity }));
  const { surface = 'all' } = api.useSearch();
  const navigate = api.useNavigate();
  const totals = data.totals[surface];
  const series = arDailySeries(data, surface);
  return <main className="max-w-6xl space-y-8 pb-12">
    <Button variant="ghost" size="sm" asChild><Link to="/trade/admin-dashboard"><ArrowLeft className="h-4 w-4" />Admin dashboard</Link></Button>
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-xs uppercase text-muted-foreground">Maison Affluency · Client experience</p><h1 className="font-display text-3xl mt-2">AR Experience</h1><p className="text-xs text-muted-foreground mt-3">Published activity · Singapore time (UTC+8)</p></div>
      <label className="text-xs text-muted-foreground flex flex-col gap-2">Experience<select aria-label="AR experience" className="border border-border bg-background text-foreground rounded-md p-2 text-sm" value={surface} onChange={e => void navigate({ search: { surface: e.target.value as ArSurface } })}>{Object.entries(surfaces).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </header>
    <div className="border-y border-border py-4 text-xs text-muted-foreground space-y-2"><p>Activity snapshot · {stamp(data.from)} — {stamp(data.to)}</p><p>Captured {stamp(data.to)} · Not live; reload does not fetch newer activity.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[['Launch attempts', totals.launches], ['Confirmed opens', totals.opens], ['Fallback displays', totals.unsupported + totals.failed], ['Fallback rate', percentage(fallbackRate(totals))]].map(([label, value]) => <div key={label} className="border border-border rounded-md p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="font-display text-3xl mt-3">{value}</p></div>)}</div>
    {!totals.visits && <div role="status" className="flex items-start gap-3 border-l-2 border-border pl-4"><ScanLine className="h-5 w-5 shrink-0 text-muted-foreground"/><div><h2 className="font-display text-lg">No recorded AR activity in this snapshot</h2><p className="text-sm text-muted-foreground mt-1">The three AR events are registered, but none arrived from the published app during this period. Editor checks are not included.</p></div></div>}
    <section className="space-y-4"><h2 className="font-display text-xl">Launches & confirmed opens over time</h2><div className="h-64 w-full"><ResponsiveContainer><LineChart data={series}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line type="monotone" dataKey="launches" name="Launch attempts" stroke="hsl(var(--foreground))" strokeWidth={2}/><Line type="monotone" dataKey="opens" name="Confirmed opens" stroke="hsl(var(--gold))" strokeWidth={2}/></LineChart></ResponsiveContainer></div></section>
    <section className="space-y-4"><h2 className="font-display text-xl">Fallback rate over time</h2><p className="text-xs text-muted-foreground">Visits with any fallback ÷ visits with a launch, open or fallback. Unsupported devices are included, even when no launch was possible. No activity = no rate, not 0%.</p><div className="h-56 w-full"><ResponsiveContainer><LineChart data={series}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis domain={[0,100]} unit="%"/><Tooltip formatter={value => `${Number(value).toFixed(1)}%`}/><Line dataKey="fallbackRate" name="Fallback rate" stroke="hsl(var(--destructive))" strokeWidth={2} connectNulls={false}/></LineChart></ResponsiveContainer></div></section>
    <section className="space-y-4"><h2 className="font-display text-xl">Fallback reasons</h2><dl className="grid sm:grid-cols-2 gap-6 border-y border-border py-5"><div><dt className="text-sm text-muted-foreground">Device or browser unsupported</dt><dd className="font-display text-2xl mt-2">{totals.unsupported}</dd></div><div><dt className="text-sm text-muted-foreground">AR failed to open</dt><dd className="font-display text-2xl mt-2">{totals.failed}</dd></div></dl></section>
    <footer className="text-xs text-muted-foreground space-y-2 border-t border-border pt-5"><p>Confirmed opens require a WebXR session or native Quick Look interaction. Quick Look opens without that interaction cannot be confirmed; attempts are not proof of an open.</p><p>Rates count visits, not people. Daily and whole-period visit counts are independently deduplicated. Consent restrictions can reduce captured activity; known bots are excluded. First and last dates are partial days.</p></footer>
  </main>;
}