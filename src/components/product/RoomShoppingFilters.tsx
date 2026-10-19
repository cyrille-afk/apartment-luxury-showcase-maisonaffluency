import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDbCuratorPicks } from '@/hooks/useDbCuratorPicks';
import { useTradeProducts } from '@/hooks/useTradeProducts';
import { useRoomShoppingFinishes } from '@/hooks/useRoomShoppingFinishes';
import { pickMatchesRoom } from '@/lib/roomMatching';
import { roomShoppingProducts } from '@/lib/shopByRoom';
import { roomFilterOptions, matchesRoomShoppingFilters, type RoomFilterPiece, type RoomShoppingFilters } from '@/lib/roomShoppingFilters';
import type { RoomSlug } from '@/lib/roomCategories';

type Props = { room: RoomSlug; values: RoomShoppingFilters; onChange: (value: RoomShoppingFilters) => void };
function FilterBar({ pieces, loading, values, onChange }: Omit<Props, 'room'> & { pieces: RoomFilterPiece[]; loading: boolean }) {
  const { data: finishes = {}, isLoading: finishesLoading, isError, refetch } = useRoomShoppingFinishes(pieces.map(p => p.id));
  const options = useMemo(() => roomFilterOptions(pieces, values, finishes), [pieces, values, finishes]);
  const count = pieces.filter(p => matchesRoomShoppingFilters(p, values, finishes)).length;
  return <div aria-label="Room product filters" className="mt-6 border-b border-border pb-6">
    <div className="flex flex-wrap items-end gap-4">
      {(['type', 'finish'] as const).map(key => <div key={key} className="w-full min-w-0 sm:w-64">
        <label id={`room-${key}-label`} className="mb-2 block font-body text-xs text-muted-foreground">{key === 'type' ? 'Product type' : 'Finish'}</label>
        <Select value={values[key] || 'all'} onValueChange={value => onChange({ ...values, [key]: value === 'all' ? null : value })} disabled={loading}>
          <SelectTrigger aria-labelledby={`room-${key}-label`} className="h-11 rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{key === 'type' ? 'All product types' : 'All finishes'}</SelectItem>
            {values[key] && !(key === 'type' ? options.types : options.finishes).some(o => o.label === values[key]) && <SelectItem value={values[key]}>{values[key]} (0)</SelectItem>}
            {(key === 'type' ? options.types : options.finishes).map(o => <SelectItem key={o.label} value={o.label}>{o.label} ({o.count})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>)}
      {(values.type || values.finish) && <Button variant="ghost" onClick={() => onChange({ type: null, finish: null })} className="h-11 rounded-none text-xs"><X className="size-3" /> Clear room filters</Button>}
      <p role="status" className="py-3 font-body text-xs text-muted-foreground">{loading ? 'Loading pieces…' : `${count} ${count === 1 ? 'piece' : 'pieces'}`}{finishesLoading ? ' · Loading finishes…' : ''}</p>
    </div>
    {isError && <div role="alert" className="mt-3 text-xs text-muted-foreground">Finish names could not be loaded. <Button variant="link" className="h-auto p-0 text-xs" onClick={() => void refetch()}>Try again</Button></div>}
  </div>;
}
export default function RoomShoppingFilterBar(props: Props & { trade?: boolean }) {
  return props.trade ? <TradeFilters {...props} /> : <PublicFilters {...props} />;
}
function PublicFilters(props: Props) {
  const { data = [], isLoading } = useDbCuratorPicks();
  const pieces = useMemo(() => data.filter(p => pickMatchesRoom(p.pick, props.room)).flatMap(({ pick }) => pick.id ? [{ id: pick.id, title: pick.title, category: pick.category, subcategory: pick.subcategory, materials: pick.materials }] : []), [data, props.room]);
  return <FilterBar {...props} pieces={pieces} loading={isLoading} />;
}
function TradeFilters(props: Props) {
  const { allProducts, isLoading } = useTradeProducts();
  const pieces = useMemo(() => roomShoppingProducts(allProducts.map(p => ({ id: p.id, title: p.product_name, brand: p.brand_name, category: p.category, subcategory: p.subcategory, materials: p.materials, image: p.image_url || '', path: '' })), props.room), [allProducts, props.room]);
  return <FilterBar {...props} pieces={pieces} loading={isLoading} />;
}