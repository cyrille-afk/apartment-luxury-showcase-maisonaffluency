import { Button } from '@/components/ui/button';
import { ROOM_LABELS, type RoomSlug } from '@/lib/roomCategories';
import type { RoomShoppingFilters } from '@/lib/roomShoppingFilters';
import type { RoomSort } from '@/lib/roomShoppingSort';

const rooms: RoomSlug[] = ['living-room', 'dining-room', 'bedroom', 'office', 'outdoor'];

export default function RoomShopping({ room, onRoomChange, collection = false }: { room: RoomSlug; trade?: boolean; onRoomChange: (room: RoomSlug) => void; filters: RoomShoppingFilters; onFiltersChange: (filters: RoomShoppingFilters) => void; sort: RoomSort; onSortChange: (sort: RoomSort) => void; collection?: boolean }) {
  return <section aria-label="Shop by Room" className="mx-auto w-full max-w-[1500px] px-6 py-8 md:py-12">
    <p className="font-body text-xs uppercase tracking-widest text-gold">Shop by Room</p>
    {collection ? <h2 className="mt-3 font-display text-3xl text-foreground md:text-4xl">The collection</h2> : <h1 className="mt-3 font-display text-3xl text-foreground md:text-4xl">{ROOM_LABELS[room]}</h1>}
    <nav aria-label="Rooms" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-5">
      {rooms.map(value => <Button key={value} variant="link" aria-current={room === value ? 'page' : undefined} onClick={() => onRoomChange(value)} className={`h-auto rounded-none px-0 py-2 font-body text-sm underline-offset-8 ${value === room ? 'text-foreground underline' : 'text-muted-foreground'}`}>{ROOM_LABELS[value]}</Button>)}
    </nav>
  </section>;
}