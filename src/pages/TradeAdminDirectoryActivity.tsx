import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { dismissalRate, designerViewRanking, type DesignerView, type DirectoryActivity } from '@/lib/directoryActivity';

export default function TradeAdminDirectoryActivity() {
  const { isAdmin, rolesLoaded, lookupFailed } = useAuth();
  const [days, setDays] = useState(30);
  const [environment, setEnvironment] = useState('production');
  const [surface, setSurface] = useState('all');
  const [selectedDesigner, setSelectedDesigner] = useState('all');
  const query = useQuery({
    queryKey: ['directory-activity', days, environment, surface], enabled: rolesLoaded && isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_directory_activity', { _days: days, _environment: environment, _surface: surface });
      if (error) throw error;
      return data as unknown as DirectoryActivity;
    },
  });
  const designerQuery = useQuery({
    queryKey: ['directory-designer-views', days, environment, surface, query.data?.updated_at], enabled: rolesLoaded && isAdmin && !!query.data,
    queryFn: async () => {
      const firstDay = query.data?.days[0]?.day;
      if (!firstDay) return { ranking: [], views: [] as DesignerView[] };
      const since = `${firstDay}T00:00:00+08:00`;
      const views: DesignerView[] = [];
      for (let offset = 0; ; offset += 1000) {
        let request = supabase.from('directory_activity_events').select('id, designer_slug, occurred_at').eq('kind', 'profile').eq('environment', environment).gte('occurred_at', since).order('occurred_at').order('id').range(offset, offset + 999);
        if (surface !== 'all') request = request.eq('surface', surface);
        const { data, error } = await request;
        if (error) throw error;
        for (const row of data ?? []) if (row.designer_slug) views.push({ designer_slug: row.designer_slug, occurred_at: row.occurred_at });
        if (!data || data.length < 1000) break;
      }
      const slugs = [...new Set(views.map(row => row.designer_slug))];
      const names: Record<string, string> = {};
      for (let offset = 0; offset < slugs.length; offset += 100) {
        const { data, error } = await supabase.from('designers').select('slug, name').in('slug', slugs.slice(offset, offset + 100));
        if (error) throw error;
        for (const row of data ?? []) names[row.slug] = row.name;
      }
      return { ranking: designerViewRanking(views, names), views };
    },
  });
  if (!rolesLoaded) return <p className="text-muted-foreground">{lookupFailed ? 'Access could not be confirmed. Retry from the connection notice.' : 'Checking access…'}</p>;
  if (!isAdmin) return <Navigate to="/trade" replace />;
  const rows = query.data?.days ?? [];
  const totals = rows.reduce((sum, row) => ({ searches: sum.searches + row.searches, letters: sum.letters + row.letters, profiles: sum.profiles + row.profiles, opens: sum.opens + row.opens, dismissed: sum.dismissed + row.dismissed }), { searches: 0, letters: 0, profiles: 0, opens: 0, dismissed: 0 });
  const rate = dismissalRate(totals.opens, totals.dismissed);
  const chartRows = rows.map(row => ({ ...row, date: row.day.slice(5), rate: dismissalRate(row.opens, row.dismissed) }));
  const designerRows = designerQuery.data?.ranking ?? [];
  const designerDaily = rows.map(row => ({ date: row.day.slice(5), views: (designerQuery.data?.views ?? []).filter(view => (selectedDesigner === 'all' || view.designer_slug === selectedDesigner) && new Date(new Date(view.occurred_at).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) === row.day).length }));
  return <div className="max-w-6xl space-y-8 pb-12">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-display text-2xl text-foreground">Directory Activity</h1><p className="mt-2 text-xs text-muted-foreground">Singapore time · {query.data?.updated_at ? `Updated ${new Date(query.data.updated_at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}` : 'Awaiting activity'}</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground">Period <select aria-label="Period" className="ml-2 bg-background text-foreground border border-border p-2" value={days} onChange={e => setDays(Number(e.target.value))}>{[7,30,90].map(n => <option key={n} value={n}>{n} days</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Traffic <select aria-label="Traffic" className="ml-2 bg-background text-foreground border border-border p-2" value={environment} onChange={e => setEnvironment(e.target.value)}><option value="production">Published</option><option value="preview">Preview</option></select></label>
        <select aria-label="Device" className="bg-background text-foreground border border-border p-2 text-xs" value={surface} onChange={e => setSurface(e.target.value)}><option value="all">All devices</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select>
        <Button variant="ghost" size="icon" title="Refresh activity" aria-label="Refresh activity" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
    </header>
    {query.isError ? <div className="text-destructive text-sm">Activity could not be loaded. <Button variant="link" onClick={() => void query.refetch()}>Try again</Button></div> : query.isLoading ? <p className="text-muted-foreground">Loading activity…</p> : <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["Search edits", totals.searches.toLocaleString()], ["A–Z selections", totals.letters.toLocaleString()], ["Profile views", totals.profiles.toLocaleString()], ["Modal dismissal rate", rate === null ? '—' : `${rate.toFixed(1)}%`]].map(([label,value]) => <div key={label} className="border border-border rounded-md p-5 bg-card"><p className="text-xs text-muted-foreground">{label}</p><p className="font-display text-3xl text-foreground mt-3">{value}</p></div>)}
      </div>
      <p className="text-xs text-muted-foreground">{query.data?.started_at ? `Ongoing tracking since ${new Date(query.data.started_at).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' })}.` : 'No consented activity recorded for this traffic source yet.'} Historical searches are not reconstructed. Search edits count nonempty input changes, not unique searches.</p>
      <section className="space-y-4" aria-label="Designer profile views">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg">Designers being viewed</h2><select aria-label="Designer view trend" className="bg-background text-foreground border border-border p-2 text-xs max-w-full" value={selectedDesigner} onChange={e => setSelectedDesigner(e.target.value)}><option value="all">All designers</option>{designerRows.map(row => <option key={row.slug} value={row.slug}>{row.name}</option>)}</select></div>
        {designerQuery.isError ? <p className="text-sm text-destructive">Designer views could not be loaded. <Button variant="link" onClick={() => void designerQuery.refetch()}>Try again</Button></p> : designerQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading designer views…</p> : designerRows.length ? <>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-3 text-left font-normal">Designer</th><th className="py-3 text-right font-normal">Profile views</th><th className="py-3 text-right font-normal">Last viewed · Singapore</th></tr></thead><tbody>{designerRows.map(row => <tr key={row.slug} className="border-b border-border"><td className="py-3 pr-4"><Button variant="link" className="h-auto p-0 text-left whitespace-normal" onClick={() => setSelectedDesigner(row.slug)}>{row.name}</Button></td><td className="py-3 text-right tabular-nums">{row.views.toLocaleString()}</td><td className="py-3 pl-4 text-right text-xs text-muted-foreground whitespace-nowrap">{new Date(row.lastViewed).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</td></tr>)}</tbody></table></div>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={designerDaily}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="date"/><YAxis allowDecimals={false}/><Tooltip/><Line name={designerRows.find(row => row.slug === selectedDesigner)?.name ?? 'All designer views'} dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }}/></LineChart></ResponsiveContainer></div>
        </> : <p className="text-sm text-muted-foreground">No designer profile views recorded for these filters.</p>}
      </section>
      <section className="space-y-4"><h2 className="font-display text-lg">Daily directory activity</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line name="Search edits" dataKey="searches" stroke="hsl(var(--foreground))" dot={false}/><Line name="A–Z selections" dataKey="letters" stroke="hsl(var(--gold))" dot={false}/><Line name="Profile views" dataKey="profiles" stroke="hsl(var(--primary))" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></section>
      <section className="space-y-4"><h2 className="font-display text-lg">Modal dismissal rate</h2><p className="text-xs text-muted-foreground">{totals.dismissed} dismissed / {totals.opens} openings · matched to each opening’s day; navigation is not a dismissal.</p><div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="date"/><YAxis domain={[0,100]} unit="%"/><Tooltip/><Line name="Dismissal %" dataKey="rate" stroke="hsl(var(--gold))" strokeWidth={2} connectNulls={false} dot={{ r: 3 }}/></LineChart></ResponsiveContainer></div></section>
      <div className="grid md:grid-cols-2 gap-8"><section><h2 className="font-display text-lg mb-4">Selected initials</h2>{query.data?.letters.length ? query.data.letters.map(row => <div key={row.letter} className="flex justify-between py-2 border-b border-border text-sm"><span>{row.letter}</span><span>{row.count}</span></div>) : <p className="text-sm text-muted-foreground">No A–Z selections recorded.</p>}</section><section><h2 className="font-display text-lg mb-4">Dismissal reasons</h2>{query.data?.reasons.length ? query.data.reasons.map(row => <div key={row.reason} className="flex justify-between py-2 border-b border-border text-sm"><span>{{escape:'Escape',outside:'Outside click',close_button:'Close button'}[row.reason] ?? row.reason}</span><span>{row.count}</span></div>) : <p className="text-sm text-muted-foreground">No dismissals recorded.</p>}</section></div>
    </>}
  </div>;
}