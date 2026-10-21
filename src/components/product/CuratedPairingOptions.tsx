import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCuratorPickDetail } from "@/hooks/useCuratorPickDetail";
import { usePublicRrp, usePublicRrpDisplay, formatPublicRrpCents } from "@/hooks/usePublicRrp";
import FinishSelector from "@/components/FinishSelector";
import { supabase } from "@/integrations/supabase/client";
import { addToCart } from "@/lib/cart";
import { pairingAxes, pairingAxisOptions, pairingOptionAvailable, pairingSelectionComplete, pairingSelectionPrice, type PairingSelection, type PairingVariant } from "@/lib/curatedPairingConfiguration";
import { buildProductFinishMap, resolveVariantImageIndex } from "@/lib/variantImageMap";
import type { PairingProduct } from "@/lib/curatedPairings";
import { toast } from "sonner";
import { pairingSwatchFor } from "@/lib/pairingFinishVisuals";

type Swatch = { name: string; image_url: string | null };

export default function CuratedPairingOptions({ piece, onExplore }: { piece: PairingProduct; onExplore: () => void }) {
  const { data: detail, isPending: detailPending, isError } = useCuratorPickDetail(piece.id);
  const { data: price, isPending: pricePending } = usePublicRrp(piece.id);
  const { displayRow, toDisplayCents } = usePublicRrpDisplay(price);
  const [chosen, setChosen] = useState<PairingSelection>({ base: null, top: null, label: null });
  const [quantity, setQuantity] = useState(1);
  const { data: swatches = [], isPending: swatchesPending, isError: swatchesError } = useQuery({
    queryKey: ["pairing-public-swatches", piece.id],
    queryFn: async (): Promise<Swatch[]> => {
      const { data, error } = await supabase.from("product_fabric_swatches_public").select("name, image_url, is_active").eq("pick_id", piece.id).order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []).filter(swatch => swatch.is_active !== false);
    },
  });
  const rows: PairingVariant[] = detail?.size_variants || price?.rrp_size_variants || [];
  const selection = useMemo(() => Object.fromEntries(pairingAxes.map((axis) => {
    const options = pairingAxisOptions(rows, axis);
    return [axis, chosen[axis] || (options.length === 1 ? options[0] : null)];
  })) as PairingSelection, [rows, chosen]);
  const complete = pairingSelectionComplete(rows, selection);
  const unit = complete ? pairingSelectionPrice(price, selection) : null;
  const imageList: string[] = detail?.gallery_images?.length ? detail.gallery_images : [piece.image];
  const selectedImage = resolveVariantImageIndex(buildProductFinishMap(detail?.variant_image_map), { ...selection, size: selection.label, variants: rows, imageCount: imageList.length });
  const swatchFor = (option: string) => pairingSwatchFor(option, swatches);

  const add = () => {
    if (!unit || !complete || isError) return;
    const parts = piece.path.split("/");
    addToCart({ pickId: piece.id, designerSlug: parts[2], productSlug: parts[3], title: piece.title, designerName: piece.brand,
      finishLabel: pairingAxes.map((axis) => selection[axis]).filter(Boolean).join(" / ") || piece.materials || null,
      variant: { base: selection.base, top: selection.top, size: selection.label }, imageUrl: imageList[selectedImage ?? 0] || piece.image,
      leadTime: piece.leadTime || null, origin: piece.origin || null, unitPriceCents: unit, currency: (price?.currency || "USD").toUpperCase(), quantity });
    toast.success(`${quantity} × ${piece.title} added to your selection`);
  };

  if (detailPending || pricePending || swatchesPending) return <p role="status" className="mt-4 font-body text-xs text-muted-foreground">Loading finishes…</p>;
  return <div className="mt-4 space-y-3">
    {!isError && !rows.length && <FinishSelector pickId={piece.id} productTitle={piece.title} includePricing={false} />}
    {!isError && pairingAxes.map((axis) => {
      const options = pairingAxisOptions(rows, axis);
      if (!options.length) return null;
      const label = axis === "base" ? detail?.base_axis_label || "Finish" : axis === "top" ? detail?.top_axis_label || "Material" : options.every((option) => /\d|small|medium|large/i.test(option)) ? "Size" : detail?.variant_placeholder?.replace(/^select (your |the )?/i, "") || "Finish";
      const selectedSwatch = selection[axis] ? swatchFor(selection[axis] || "") : undefined;
      return <div key={axis}>
        <p className="mb-1.5 font-body text-[10px] uppercase text-muted-foreground">{label}</p>
        <Select value={selection[axis] || ""} onValueChange={(value) => setChosen({ ...selection, [axis]: value === "__clear__" ? null : value })}>
          <SelectTrigger aria-label={`${piece.title} ${label}`} className="h-auto min-h-10 rounded-none text-xs">
            <span className="flex min-w-0 items-center gap-2">{selectedSwatch?.image_url && <img src={selectedSwatch.image_url} alt="" className="h-6 w-6 shrink-0 object-cover" />}<SelectValue placeholder={`Select ${label}`} /></span>
          </SelectTrigger>
          <SelectContent className="z-[10020]">{options.length > 1 && <SelectItem value="__clear__">Clear selection</SelectItem>}{options.map((option) => {
            const swatch = swatchFor(option);
            return <SelectItem key={option} value={option} disabled={!pairingOptionAvailable(rows, selection, axis, option)}><span className="flex items-center gap-2">{swatch?.image_url && <img src={swatch.image_url} alt="" className="h-7 w-7 object-cover" />}{option}</span></SelectItem>;
          })}</SelectContent>
        </Select>
      </div>;
    })}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-body text-[10px] uppercase text-muted-foreground">Quantity</span>
      <div className="flex h-9 items-center border border-border/60">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" aria-label={`Decrease ${piece.title} quantity`} disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Minus className="h-3 w-3" /></Button>
        <span aria-live="polite" className="w-7 text-center font-body text-xs tabular-nums">{quantity}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" aria-label={`Increase ${piece.title} quantity`} disabled={quantity >= 99} onClick={() => setQuantity(quantity + 1)}><Plus className="h-3 w-3" /></Button>
      </div>
    </div>
    <p aria-live="polite" className="font-body text-xs text-muted-foreground">{unit ? formatPublicRrpCents(toDisplayCents(unit * quantity), { ...displayRow, rrp_price_cents: unit * quantity, currency: displayRow?.currency || "USD", price_unit: null, price_prefix: "" }, "") : complete ? "Price upon Request" : "Select finishes"}</p>
    {unit && !isError && (rows.length > 0 || (!swatchesPending && !swatchesError && !swatches.length)) ? <Button variant="outline" className="h-auto min-h-10 w-full whitespace-normal rounded-none px-3 text-xs" onClick={add}>Add to Selection</Button> : <Button asChild variant="link" className="h-auto whitespace-normal px-0 text-xs"><Link to={piece.path} state={{ curatedPairing: true }} onClick={onExplore}>{isError || !complete ? "View Piece" : "Request Quote & Customisation"}</Link></Button>}
  </div>;
}