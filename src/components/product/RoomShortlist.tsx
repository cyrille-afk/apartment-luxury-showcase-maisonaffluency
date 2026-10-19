import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Check, Link2, Trash2, X, FolderOpen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ROOM_LABELS, type RoomSlug } from '@/lib/roomCategories';
import { roomShortlistDraftKey, shortlistItems, toggleShortlistItem, type RoomShortlistItem } from '@/lib/roomShortlist';
import { resolvePublicUrlsByPickIds } from '@/lib/comparatorCatalogue';

const Context = createContext<{ items: RoomShortlistItem[]; toggle: (item: RoomShortlistItem) => void; open: () => void } | null>(null);

export function RoomShortlistProvider({ room, children }: { room: RoomSlug; children: ReactNode }) {
  const { user } = useAuth();
  return <RoomShortlistState key={roomShortlistDraftKey(room, user?.id)} room={room}>{children}</RoomShortlistState>;
}

function RoomShortlistState({ room, children }: { room: RoomSlug; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const key = roomShortlistDraftKey(room, user?.id);
  const [items, setItems] = useState<RoomShortlistItem[]>(() => {
    try { return shortlistItems(JSON.parse(localStorage.getItem(key) || (user ? localStorage.getItem(roomShortlistDraftKey(room)) : null) || '[]')); } catch { return []; }
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(items)); } catch { toast.error('This device could not preserve your shortlist.'); } }, [items, key]);
  const saved = useQuery({
    queryKey: ['room-shortlists', user?.id, room], enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('comparator_shortlists').select('id,name,items,share_token,created_at').eq('user_id', user.id).eq('room_slug', room).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const copy = async (token: string) => {
    const url = `${window.location.origin}/shortlist/${token}`;
    setShareUrl(url);
    try { await navigator.clipboard.writeText(url); toast.success('Shortlist link copied'); } catch { toast.info('Your share link is ready below'); }
  };
  const save = async (share: boolean) => {
    if (!user || !items.length || busy) return;
    setBusy(true);
    try {
      const urls = await resolvePublicUrlsByPickIds(items.map(p => p.id).filter(id => /^[0-9a-f-]{36}$/i.test(id)));
      const snapshot = shortlistItems(items).map(item => ({ ...item, public_url: urls.get(item.id) || item.public_url || null }));
      const { data, error } = await supabase.from('comparator_shortlists').insert({ user_id: user.id, room_slug: room, name: name.trim() || `${ROOM_LABELS[room]} shortlist`, items: snapshot }).select('share_token').single();
      if (error) throw error;
      await saved.refetch();
      toast.success('Shortlist saved');
      if (share) await copy(data.share_token);
    } catch { toast.error('Could not save your shortlist. Your selection is still here.'); } finally { setBusy(false); }
  };
  const removeSaved = async (id: string) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('comparator_shortlists').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setConfirmDelete(null); setShareUrl(''); await saved.refetch(); toast.success('Shortlist deleted');
    } catch { toast.error('Could not delete your shortlist'); } finally { setBusy(false); }
  };
  return <Context.Provider value={{ items, toggle: item => { setItems(prev => toggleShortlistItem(prev, item)); setShareUrl(''); }, open: () => setOpen(true) }}>
    {children}
    <Sheet open={open} onOpenChange={setOpen}><SheetContent className="flex w-full flex-col sm:max-w-xl">
      <SheetHeader className="pr-8"><SheetTitle className="font-display text-2xl">{ROOM_LABELS[room]} shortlist</SheetTitle><SheetDescription>{items.length} {items.length === 1 ? 'piece' : 'pieces'}</SheetDescription></SheetHeader>
      <div className="mt-5 flex-1 overflow-y-auto">
        {items.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No pieces selected.</p> : <ul className="divide-y divide-border">{items.map(item => <li key={item.id} className="flex items-center gap-4 py-4">
          {item.image_url && <img src={item.image_url} alt={item.product_name} className="size-20 shrink-0 bg-muted object-contain" />}
          <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{item.brand_name}</p><p className="mt-1 font-display text-lg break-words">{item.product_name}</p><p className="mt-1 text-xs text-muted-foreground">Price upon Request</p></div>
          <Button variant="ghost" size="icon" aria-label={`Remove ${item.product_name} from shortlist`} onClick={() => { setItems(prev => prev.filter(p => p.id !== item.id)); setShareUrl(''); }}><X className="size-4" /></Button>
        </li>)}</ul>}
        <div className="space-y-3 border-t border-border pt-5">
          <label htmlFor="room-shortlist-name" className="text-sm">Shortlist name</label><Input id="room-shortlist-name" value={name} maxLength={150} onChange={e => setName(e.target.value)} placeholder={`${ROOM_LABELS[room]} shortlist`} />
          {user ? <div className="flex flex-wrap gap-2"><Button disabled={!items.length || busy} onClick={() => void save(false)}><Bookmark className="mr-2 size-4" />{busy ? 'Saving…' : 'Save shortlist'}</Button><Button variant="outline" disabled={!items.length || busy} onClick={() => void save(true)}><Link2 className="mr-2 size-4" />Save & share</Button></div> : <Button asChild><Link to={`/trade/login?next=${encodeURIComponent(location.pathname + location.search)}`}>Sign in to save & share</Link></Button>}
          {shareUrl && <div><label htmlFor="room-shortlist-link" className="text-xs text-muted-foreground">Share link</label><Input id="room-shortlist-link" readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} /><a href={shareUrl} className="mt-2 inline-block text-sm underline">Open shared shortlist</a></div>}
        </div>
        {user && <section className="mt-8 border-t border-border pt-5"><h3 className="font-display text-xl">Saved shortlists</h3>
          {saved.isLoading ? <p role="status" className="mt-3 text-sm text-muted-foreground">Loading…</p> : saved.isError ? <Button variant="link" onClick={() => void saved.refetch()}>Retry loading shortlists</Button> : !saved.data?.length ? <p className="mt-3 text-sm text-muted-foreground">No saved shortlists for this room.</p> : <ul className="mt-3 divide-y divide-border">{saved.data.map(s => <li key={s.id} className="py-3"><div className="flex items-center gap-2"><Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal px-0 text-left" onClick={() => { setItems(shortlistItems(s.items)); setName(s.name); setShareUrl(''); }}><FolderOpen className="mr-2 size-4 shrink-0" /><span>{s.name} · {shortlistItems(s.items).length}</span></Button><Button variant="ghost" size="icon" title="Copy share link" aria-label={`Share ${s.name}`} onClick={() => void copy(s.share_token)}><Link2 className="size-4" /></Button><Button variant="ghost" size="icon" title="Delete shortlist" aria-label={`Delete ${s.name}`} onClick={() => setConfirmDelete(s.id)}><Trash2 className="size-4" /></Button></div><p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString('en-GB')}</p>{confirmDelete === s.id && <div className="mt-3"><p className="text-sm">Delete this shortlist and disable its shared link?</p><div className="mt-2 flex gap-2"><Button variant="destructive" size="sm" disabled={busy} onClick={() => void removeSaved(s.id)}>Delete shortlist</Button><Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button></div></div>}</li>)}</ul>}
        </section>}
      </div>
    </SheetContent></Sheet>
  </Context.Provider>;
}

export function RoomShortlistToolbar() {
  const shortlist = useContext(Context);
  if (!shortlist) return null;
  return <div className="mx-auto flex w-full max-w-[1500px] justify-end px-6 pb-6"><Button variant="outline" onClick={shortlist.open}><Bookmark className="mr-2 size-4" />Room shortlist ({shortlist.items.length})</Button></div>;
}
export function RoomShortlistButton({ item, overlay = false }: { item: RoomShortlistItem; overlay?: boolean }) {
  const shortlist = useContext(Context);
  if (!shortlist) return null;
  const selected = shortlist.items.some(p => p.id === item.id);
  return <Button variant="outline" size="icon" aria-pressed={selected} title={selected ? 'Remove from room shortlist' : 'Add to room shortlist'} aria-label={`${selected ? 'Remove' : 'Add'} ${item.product_name} ${selected ? 'from' : 'to'} room shortlist`} className={overlay ? 'absolute bottom-14 right-2 z-30 size-9 bg-background/90' : 'size-9 shrink-0'} onClick={e => { e.stopPropagation(); shortlist.toggle(item); }} onKeyDown={e => e.stopPropagation()}>{selected ? <Check className="size-4" /> : <Bookmark className="size-4" />}</Button>;
}