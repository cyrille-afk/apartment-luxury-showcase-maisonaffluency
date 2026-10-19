import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface StudioRow {
  id: string; name: string; display_name: string | null; slug: string;
  billing_email: string | null; created_at: string; owner_name: string;
  owner_email: string | null; member_count: number;
}
interface Directory { studios: StudioRow[]; total: number; total_studios: number }

export default function TradeAdminStudios() {
  const { user, rolesLoaded, isAdmin, isSuperAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const enabled = Boolean(user && rolesLoaded && (isAdmin || isSuperAdmin));
  useEffect(() => {
    const timer = setTimeout(() => { setTerm(search.trim()); setOffset(0); }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ['admin-studios', user?.id, term, offset], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_studio_directory', { _search: term, _offset: offset });
      if (error) throw error;
      return data as unknown as Directory;
    },
  });
  const data = enabled ? query.data : undefined;
  return <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <Helmet><title>Studios Directory — Maison Affluency</title><meta name="description" content="Private administration directory of created studios." /><meta name="robots" content="noindex, nofollow" /></Helmet>
    {!rolesLoaded ? <p className="text-muted-foreground">Checking access…</p> : !enabled ? <p className="text-destructive">Administrator access required.</p> : <>
      <Link to="/trade/admin-dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Admin dashboard</Link>
      <header className="flex items-start justify-between gap-4"><div><h1 className="flex items-center gap-3 font-display text-3xl text-foreground"><Building2 className="h-6 w-6" />Studios</h1><p className="mt-2 text-sm text-muted-foreground">{data ? `${data.total_studios} created studios` : 'Studio directory'}</p></div>
        <Button variant="outline" size="icon" title="Refresh studios" aria-label="Refresh studios" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /></Button>
      </header>
      <div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9 pr-10" aria-label="Search studios" placeholder="Search studio, owner or email…" value={search} onChange={e => setSearch(e.target.value)} />{search && <Button className="absolute right-0 top-0" variant="ghost" size="icon" title="Clear search" aria-label="Clear studio search" onClick={() => setSearch('')}><X className="h-4 w-4" /></Button>}</div>
      {query.isError ? <div role="alert" className="text-destructive">Studios could not be loaded. <Button variant="link" onClick={() => query.refetch()}>Retry</Button></div> : !data || search.trim() !== term ? <p role="status" className="text-muted-foreground">Loading studios…</p> : <>
        <p aria-live="polite" className="text-sm text-muted-foreground">{data.total} {data.total === 1 ? 'studio' : 'studios'}{term ? ' found' : ''}</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-y border-border text-xs text-muted-foreground"><tr>{['Studio', 'Owner', 'Billing email', 'Members', 'Created (UTC)'].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{data.studios.map(studio => <tr key={studio.id} className="border-b border-border"><td className="px-4 py-4"><p className="font-medium text-foreground">{studio.name}</p>{studio.display_name && studio.display_name !== studio.name && <p className="mt-1 text-xs text-muted-foreground">{studio.display_name}</p>}</td><td className="px-4 py-4"><p>{studio.owner_name}</p><p className="mt-1 text-xs text-muted-foreground">{studio.owner_email || '—'}</p></td><td className="px-4 py-4 text-muted-foreground">{studio.billing_email || '—'}</td><td className="px-4 py-4">{studio.member_count}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{new Date(studio.created_at).toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>)}</tbody></table></div>
        {!data.total && <p className="py-8 text-center text-muted-foreground">{term ? 'No studios match your search.' : 'No studios have been created.'}</p>}
        {data.total > 50 && <div className="flex items-center justify-end gap-3"><span className="text-sm text-muted-foreground">{offset + 1}–{Math.min(offset + 50, data.total)} of {data.total}</span><Button variant="outline" size="icon" title="Previous page" aria-label="Previous studios page" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" title="Next page" aria-label="Next studios page" disabled={offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}><ChevronRight className="h-4 w-4" /></Button></div>}
      </>}
    </>}
  </div>;
}