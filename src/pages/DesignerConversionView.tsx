import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { designerConversionRanking, type searchOutcomes, type refinementOutcomes } from '@/lib/directoryActivity';

type Props = {
  searches?: ReturnType<typeof searchOutcomes>;
  refinements?: ReturnType<typeof refinementOutcomes>;
  names: Record<string, string>;
  loading: boolean;
  failed: boolean;
  retry: () => void;
};

export default function DesignerConversionView({ searches, refinements, names, loading, failed, retry }: Props) {
  const [scope, setScope] = useState('all');
  if (loading) return <p className="text-sm text-muted-foreground">Loading designer conversions…</p>;
  if (failed) return <p className="text-sm text-destructive">Designer conversions could not be loaded. <Button variant="link" onClick={retry}>Try again</Button></p>;
  const searched = scope === 'all' ? searches?.searched ?? 0 : refinements?.refined ?? 0;
  const destinations = scope === 'all' ? searches?.destinations ?? [] : refinements?.journeys.flatMap(journey => journey.refined && journey.view ? [journey.view] : []) ?? [];
  const ranked = designerConversionRanking(destinations, names, searched);
  const reached = ranked.reduce((sum, row) => sum + row.views, 0);
  return <section aria-label="Designer conversion comparison" className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="font-display text-xl">Designer profile conversion</h2>
      <select aria-label="Conversion search scope" value={scope} onChange={event => setScope(event.target.value)} className="border border-border bg-background text-foreground p-2 text-xs">
        <option value="all">All searches</option><option value="refined">Refined searches</option>
      </select>
    </header>
    <p className="text-sm text-muted-foreground">{searched.toLocaleString()} {scope === 'all' ? 'searched' : 'refined'} directory openings · {reached.toLocaleString()} reached a profile</p>
    <p className="text-xs text-muted-foreground">Conversion = openings that selected this designer ÷ all {scope === 'all' ? 'searched' : 'refined'} openings. Selection share = this designer’s share of successful openings. Each opening counts once, at its first committed profile view. These are search-to-profile rates, not rates per card shown or evidence of confirmed relevance. Earlier unlinked activity is excluded.</p>
    {ranked.length ? <>
      <div className="h-80" aria-label="Top ten designer conversion rates"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={ranked.slice(0, 10)} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" hide /><YAxis domain={[0, 100]} unit="%" />
          <Tooltip formatter={value => `${Number(value).toFixed(1)}%`} labelFormatter={(_, payload) => payload[0]?.payload.name ?? ''} />
          <Bar name="Search-to-profile conversion" dataKey="conversionRate" fill="hsl(var(--primary))" maxBarSize={64} />
        </BarChart>
      </ResponsiveContainer></div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-3 text-left font-normal">Designer · most selected first</th><th className="py-3 px-4 text-right font-normal">Profile opens</th><th className="py-3 px-4 text-right font-normal">Conversion</th><th className="py-3 text-right font-normal">Selection share</th></tr></thead>
        <tbody>{ranked.map(row => <tr key={row.slug} className="border-b border-border"><td className="py-3 pr-4">{row.name}</td><td className="py-3 px-4 text-right tabular-nums">{row.views.toLocaleString()}</td><td className="py-3 px-4 text-right tabular-nums">{row.conversionRate == null ? '—' : `${row.conversionRate.toFixed(1)}%`}</td><td className="py-3 text-right tabular-nums">{row.selectionShare == null ? '—' : `${row.selectionShare.toFixed(1)}%`}</td></tr>)}</tbody>
      </table></div>
    </> : <p className="text-sm text-muted-foreground">No linked designer selections recorded for these filters.</p>}
  </section>;
}