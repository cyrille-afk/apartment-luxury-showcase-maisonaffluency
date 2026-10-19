import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDbCuratorPicks } from '@/hooks/useDbCuratorPicks';
import { useCuratedPairingRules } from '@/hooks/useCuratedPairingRules';
import { useCheckoutForm } from '@/contexts/CheckoutFormContext';
import { useCart } from '@/lib/cart';
import { ROOM_LABELS, type RoomSlug } from '@/lib/roomCategories';
import { roomAnchors, roomShoppingPairings } from '@/lib/shopByRoom';
import type { PairingProduct } from '@/lib/curatedPairings';
import PairingConfigurationSheet from './PairingConfigurationSheet';
import { useAuth } from '@/hooks/useAuth';

const rooms: RoomSlug[] = ['living-room', 'dining-room', 'bedroom', 'office', 'outdoor'];

export default function RoomShopping({ room, trade = false, onRoomChange }: { room: RoomSlug; trade?: boolean; onRoomChange: (room: RoomSlug) => void }) {
  const { data: catalogue = [], isLoading, isError, refetch } = useDbCuratorPicks();
  const { buyerProfile } = useCheckoutForm();
  const { user, isTradeUser, isAdmin, rolesLoaded } = useAuth();
  const privateClient = !trade && buyerProfile !== 'designer' && !isTradeUser && !isAdmin && (!user || rolesLoaded);
  const { data: rules = [], isError: rulesError, refetch: refetchRules } = useCuratedPairingRules(privateClient);
  const cart = useCart();
  const [chosenId, setChosenId] = useState('');
  const [configuring, setConfiguring] = useState<PairingProduct | null>(null);
  const products = useMemo(() => catalogue.flatMap(({ pick, designerId, designerName }) => pick.id && pick.slug && pick.image ? [{ id: pick.id, title: pick.title, brand: designerName, category: pick.category, subcategory: pick.subcategory, image: pick.image, path: `/designers/${designerId}/${pick.slug}`, materials: pick.materials, leadTime: pick.lead_time, origin: pick.origin }] : []), [catalogue]);
  const anchors = useMemo(() => roomAnchors(products, room), [products, room]);
  const primary = anchors.find(p => p.id === chosenId) || anchors[0];
  const pairings = useMemo(() => primary ? roomShoppingPairings(primary, products, room, cart.flatMap(p => p.pickId ? [p.pickId] : []), rules) : [], [primary, products, room, cart, rules]);

  return <section aria-label="Shop by Room" className="mx-auto w-full max-w-[1500px] px-6 py-8 md:py-12">
    <p className="font-body text-xs uppercase tracking-widest text-gold">Shop by Room</p>
    <h1 className="mt-3 font-display text-3xl text-foreground md:text-4xl">{ROOM_LABELS[room]}</h1>
    <nav aria-label="Rooms" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-5">
      {rooms.map(value => <Button key={value} variant="link" aria-current={room === value ? 'page' : undefined} onClick={() => { setChosenId(''); setConfiguring(null); onRoomChange(value); }} className={`h-auto rounded-none px-0 py-2 font-body text-sm underline-offset-8 ${value === room ? 'text-foreground underline' : 'text-muted-foreground'}`}>{ROOM_LABELS[value]}</Button>)}
    </nav>
    {privateClient && <div className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <h2 className="font-display text-2xl text-foreground">Curated Pairings</h2>
        <div className="w-full max-w-md"><label id="room-start-label" className="mb-2 block font-body text-xs text-muted-foreground">Starting piece</label><Select value={primary?.id || ''} onValueChange={setChosenId} disabled={!anchors.length}><SelectTrigger aria-labelledby="room-start-label" className="h-12 rounded-none"><SelectValue placeholder={isLoading ? 'Loading pieces…' : 'Select a piece'} /></SelectTrigger><SelectContent>{anchors.map(p => <SelectItem key={p.id} value={p.id}>{p.title} — {p.brand}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {(isError || rulesError) ? <div role="alert" className="mt-6"><p className="text-sm text-muted-foreground">The selection could not be loaded.</p><Button variant="link" onClick={() => { void refetch(); void refetchRules(); }}>Try again</Button></div> : isLoading ? <p role="status" className="mt-6 text-sm text-muted-foreground">Loading collection…</p> : primary && <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-8" aria-live="polite">
        <article className="group min-w-0"><Link to={primary.path} className="block aspect-square overflow-hidden bg-muted/20"><img src={primary.image} alt={primary.title} className="h-full w-full object-contain" /></Link><p className="mt-4 font-body text-[10px] uppercase tracking-widest text-gold">Your starting piece</p><p className="mt-2 text-xs text-muted-foreground group-hover:underline">{primary.brand}</p><h3 className="mt-1 font-display text-lg">{primary.title}</h3><p className="mt-2 text-xs text-muted-foreground">Price upon Request</p></article>
        {pairings.map(p => <article key={p.id} className="group min-w-0 motion-safe:animate-fade-in"><Button variant="ghost" aria-label={`Configure ${p.title}`} onClick={() => setConfiguring(p)} className="block aspect-square h-auto w-full overflow-hidden rounded-none bg-muted/20 p-0"><img src={p.image} alt={p.title} className="h-full w-full object-contain" /></Button><p className="mt-4 font-body text-[10px] uppercase tracking-widest text-muted-foreground">In the ensemble</p><p className="mt-2 text-xs text-muted-foreground group-hover:underline">{p.brand}</p><h3 className="mt-1 font-display text-lg">{p.title}</h3><p className="mt-2 text-xs text-muted-foreground">Price upon Request</p><Button variant="link" onClick={() => setConfiguring(p)} className="mt-3 h-auto whitespace-normal rounded-none px-0 text-xs">Choose finishes <ArrowUpRight className="size-3 shrink-0" /></Button></article>)}
      </div>}
      {!isLoading && !isError && !rulesError && pairings.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No complementary pieces are available for this selection.</p>}
    </div>}
    {configuring && <PairingConfigurationSheet key={configuring.id} piece={configuring} onClose={() => setConfiguring(null)} onExplore={() => setConfiguring(null)} />}
  </section>;
}