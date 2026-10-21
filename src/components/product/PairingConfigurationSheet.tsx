import { useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileSwipeDismiss } from "@/hooks/useMobileSwipeDismiss";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@/lib/router-compat";
import { Check, Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatCuratorialEditionLine } from "@/lib/editionLabel";
import { withImperialInline } from "@/lib/formatDimensions";
import { useCuratorPickDetail } from "@/hooks/useCuratorPickDetail";
import { usePublicRrp, usePublicRrpDisplay, formatPublicRrpCents } from "@/hooks/usePublicRrp";
import { supabase } from "@/integrations/supabase/client";
import { addToCart } from "@/lib/cart";
import { pairingAxes, pairingAxisOptions, pairingOptionAvailable, pairingSelectionComplete, pairingSelectionPrice, type PairingSelection, type PairingVariant } from "@/lib/curatedPairingConfiguration";
import { pairingFinishImage, pairingSwatchFor, pairingVisualOptions, type PairingSwatch } from "@/lib/pairingFinishVisuals";
import type { PairingProduct } from "@/lib/curatedPairings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { pairingMediaKey } from '@/lib/pairingMedia';

export interface PairingConfigurationStart { selection: PairingSelection; visual: Partial<PairingSelection>; customId: string; material: string }
export default function PairingConfigurationSheet({ piece, onClose, onExplore, onAdded, preview = false, initial }: { piece: PairingProduct; onClose: () => void; onExplore: () => void; onAdded?: (piece: PairingProduct) => void; preview?: boolean; initial?: PairingConfigurationStart }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  useMobileSwipeDismiss({ containerRef: panelRef as React.RefObject<HTMLDivElement>, enabled: isMobile, onDismiss: onClose });
  const { data: detail, isPending: detailPending, isError } = useCuratorPickDetail(piece.id);
  const { data: price, isPending: pricePending } = usePublicRrp(piece.id);
  const { data: swatches = [], isPending: swatchesPending, isError: swatchesError } = useQuery({
    queryKey: ["pairing-public-swatches", piece.id],
    queryFn: async (): Promise<PairingSwatch[]> => {
      const result = await supabase.from("product_fabric_swatches_public").select("name, image_url, is_active").eq("pick_id", piece.id).order("sort_order", { ascending: true });
      if (result.error) throw result.error;
      return (result.data || []).filter(swatch => swatch.is_active !== false);
    },
  });
  const reduced = useReducedMotion();
  const [chosen, setChosen] = useState<PairingSelection>(initial?.selection || { base: null, top: null, label: null });
  const [quantity, setQuantity] = useState(1);
  const custom = piece.finishOptions || [];
  const [customId, setCustomId] = useState(initial?.customId || (custom.length === 1 ? custom[0].id : ""));
  const [material, setMaterial] = useState(initial?.material || "");
  const [visualChoices, setVisualChoices] = useState<Partial<PairingSelection>>(initial?.visual || {});
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const rows: PairingVariant[] = detail?.size_variants || price?.rrp_size_variants || [];
  const selection = useMemo(() => Object.fromEntries(pairingAxes.map((axis) => {
    const options = pairingAxisOptions(rows, axis);
    return [axis, chosen[axis] || (options.length === 1 ? options[0] : null)];
  })) as PairingSelection, [rows, chosen]);
  const customOption = custom.find((option) => option.id === customId);
  const complete = custom.length ? !!customOption : pairingSelectionComplete(rows, selection);
  const unit = custom.length ? customOption?.price_cents : complete ? pairingSelectionPrice(price, selection) : null;
  const currency = custom.length ? piece.finishCurrency || "USD" : price?.currency || "USD";
  const startingPrices = (custom.length ? custom.map(option => option.price_cents) : [price?.rrp_price_cents, ...(price?.rrp_size_variants || []).map(row => row.price_cents)]).filter((amount): amount is number => typeof amount === "number" && amount > 0);
  const startingPrice = startingPrices.length ? Math.min(...startingPrices) : null;
  const edition = formatCuratorialEditionLine(detail || {});
  const designerName = detail?.subtitle && edition?.toLowerCase().includes(piece.brand.toLowerCase()) ? detail.subtitle : piece.brand;
  const dimensionLabel = selection.label && /\bcm\b/i.test(selection.label) ? selection.label : null;
  const dimensionSource = detail?.dimensions || dimensionLabel;
  const dimensions = dimensionSource ? withImperialInline(dimensionSource.replace(/×/g, "x")) : "";
  const leadTime = detail?.lead_time || piece.leadTime;
  const { displayRow, toDisplayCents } = usePublicRrpDisplay({ rrp_price_cents: unit || null, currency, price_unit: null, price_prefix: "" });
  const images: string[] = detail?.gallery_images?.length ? detail.gallery_images : [piece.image];
  const imageSelection = { ...selection, ...visualChoices };
  const assigned = piece.finishMedia?.find(entry => entry.key === pairingMediaKey(rows.length ? imageSelection : { ...imageSelection, label: material }, customOption?.id));
  const catalogImage = pairingFinishImage(detail?.variant_image_map, images, rows, selection, customOption?.name, imageSelection);
  const dedicated = [assigned?.product_image_url, catalogImage].find(url => !!url && !failedImages.includes(url));
  const image = dedicated || piece.image;
  const selectedNames = custom.length ? customOption ? [customOption.name] : [] : rows.length ? pairingAxes.map((axis) => visualChoices[axis] || selection[axis]).filter((name): name is string => !!name) : material ? [material] : [];
  const macros = assigned?.macro_image_url && !failedImages.includes(assigned.macro_image_url) ? [{ name: assigned.label, image: assigned.macro_image_url }] : selectedNames.flatMap((name) => {
    const swatch = pairingSwatchFor(name, swatches);
    return swatch?.image_url && !failedImages.includes(swatch.image_url) ? [{ name, image: swatch.image_url }] : [];
  });
  const loading = detailPending || (!custom.length && (pricePending || swatchesPending));
  const canAdd = !!unit && complete && !loading && !isError && (custom.length ? !!piece.pairingRuleId : rows.length > 0 || (!swatchesPending && !swatchesError && !swatches.length));
  function add() {
    if (preview || !canAdd || !unit) return;
    const parts = piece.path.split("/");
    addToCart({ pickId: piece.id, designerSlug: parts[2], productSlug: parts[3], title: piece.title, designerName: piece.brand,
      finishLabel: selectedNames.join(" / ") || piece.materials || null,
      variant: custom.length ? null : { base: selection.base, top: selection.top, size: selection.label },
      ...(customOption && piece.pairingRuleId ? { pairing: { ruleId: piece.pairingRuleId, optionId: customOption.id } } : {}),
      imageUrl: image, leadTime: piece.leadTime || null, origin: piece.origin || null, unitPriceCents: unit, currency, quantity });
    toast.success(`${quantity} × ${piece.title} added to your selection`);
    onAdded?.(piece);
    onClose();
  }
  function swatchGrid(label: string, options: string[], active: string | null, select: (name: string) => void, available = (_name: string) => true) {
    if (label === "Size") return options.length === 1 && dimensions ? null : <fieldset className="space-y-4"><legend className="font-body text-xs uppercase tracking-widest text-muted-foreground">{label}</legend><div className="flex flex-wrap gap-3">{options.map((name) => <Button key={name} variant="outline" aria-label={`${label}: ${name}`} aria-pressed={active === name} disabled={!available(name)} onClick={() => select(name)} className={cn("h-auto min-h-11 whitespace-normal rounded-none px-4 py-3 text-xs leading-relaxed", active === name && "border-gold")}>{withImperialInline(name)}</Button>)}</div></fieldset>;
    const heading = /upholstery|fabric/i.test(label) ? "Select Your Upholstery" : /frame/i.test(label) ? "Select Your Frame Finish" : `Select Your ${label}`;
    return <Accordion type="single" collapsible defaultValue={preview ? label : undefined}><AccordionItem value={label} className="border-border/60"><AccordionTrigger className="gap-3 text-left hover:no-underline"><span className="min-w-0 flex-1"><span className="block font-body text-xs uppercase tracking-widest">{heading}</span><span className="mt-1 block break-words font-body text-xs font-normal text-muted-foreground">{active || "Choose a finish"}</span></span></AccordionTrigger><AccordionContent className="pt-3"><div className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-4">
      {options.map((name) => {
        const swatch = pairingSwatchFor(name, swatches);
        const customMacro = custom.find(option => option.name === name);
        const swatchImage = customMacro ? piece.finishMedia?.find(entry => entry.key === `custom:${customMacro.id}`)?.macro_image_url || swatch?.image_url : swatch?.image_url;
        return <Button key={name} variant="ghost" aria-pressed={active === name} aria-label={`${label}: ${name}`} title={name} disabled={!available(name)} onClick={() => select(name)} className="group h-auto min-h-24 min-w-0 flex-col justify-start gap-3 whitespace-normal rounded-none p-1 text-center font-body text-xs leading-relaxed hover:bg-transparent">
          <span className={cn("relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/20 transition-all", active === name ? "border-gold ring-1 ring-gold ring-offset-4 ring-offset-background" : "border-border group-hover:border-gold/60")}>
            {swatchImage ? <img src={swatchImage} alt="" className="h-full w-full object-cover" /> : <span className="px-1 text-[10px] text-muted-foreground">{name.split(/\s+/).map((word) => word[0]).slice(0, 3).join("")}</span>}
            {active === name && <span className="absolute bottom-0 right-0 bg-background p-1 text-foreground"><Check className="h-3 w-3" /></span>}
          </span><span className="w-full break-words">{name}</span>
        </Button>;
      })}
    </div></AccordionContent></AccordionItem></Accordion>;
  }
  return <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent ref={panelRef} aria-describedby="pairing-config-description" onEscapeKeyDown={(event) => { event.preventDefault(); onClose(); }} overlayClassName="!z-[10030] !bg-black/30 backdrop-blur-md motion-reduce:animate-none" className="!z-[10031] flex h-dvh w-full flex-col gap-0 !p-0 sm:!max-w-[1100px] motion-reduce:animate-none">
    <div data-swipe-dismiss-handle className="flex h-10 shrink-0 items-center justify-center touch-none md:hidden"><span className="h-1 w-10 rounded-full bg-muted-foreground/30" /></div>
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain md:grid-cols-2 md:overflow-hidden">
      <div className="relative flex min-h-64 items-center justify-center border-b border-border/50 bg-muted/10 p-6 md:min-h-0 md:border-b-0 md:border-r md:p-10">
        <AnimatePresence mode="wait"><motion.img key={image} src={image} alt={`${piece.title}${dedicated ? ` — ${selectedNames.join(" / ")}` : ""}`} onError={() => setFailedImages(f => [...f, image])} initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: reduced ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.25 }} className="max-h-[32dvh] w-full object-contain md:max-h-[80dvh]" /></AnimatePresence>
      </div>
      <div className="flex min-h-0 flex-col md:overflow-y-auto"><header className="px-6 pb-6 pt-12 md:px-10 md:pt-14"><SheetTitle className="font-display text-3xl font-normal leading-snug">{piece.title}</SheetTitle><p className="mt-3 font-body text-sm">{designerName}</p>{edition && <p className="mt-2 font-body text-[10px] uppercase tracking-widest text-gold">{edition}</p>}<p className="mt-4 font-body text-base">{startingPrice ? formatPublicRrpCents(toDisplayCents(startingPrice), displayRow, "From") : "Price upon Request"}</p><SheetDescription id="pairing-config-description" className={cn("mt-3 font-body text-sm leading-relaxed", !(detail?.materials || piece.materials) && "sr-only")}>{detail?.materials || piece.materials || piece.title}</SheetDescription></header>
        <div className="space-y-5 px-6 pb-8 md:px-10">
          {loading ? <p role="status" className="text-sm text-muted-foreground">Loading finishes…</p> : isError ? <p role="alert" className="text-sm text-muted-foreground">Finish details could not be loaded.</p> : custom.length ? swatchGrid("Finish", custom.map((option) => option.name), customOption?.name || null, (name) => setCustomId(custom.find((option) => option.name === name)?.id || "")) : rows.length ? pairingAxes.map((axis) => {
            const options = pairingAxisOptions(rows, axis);
            if (!options.length) return null;
            const label = axis === "base" ? detail?.base_axis_label || "Finish" : axis === "top" ? detail?.top_axis_label || "Material" : options.every((option) => /\d|small|medium|large/i.test(option)) ? "Size" : detail?.variant_placeholder?.replace(/^select (your |the )?/i, "") || "Finish";
            const visualOptions = pairingVisualOptions(options, swatches);
            const active = visualChoices[axis] || (selection[axis] ? pairingSwatchFor(selection[axis] || "", swatches)?.name || selection[axis] : null);
            return <div key={axis}>{swatchGrid(label, visualOptions.map((option) => option.name), active, (name) => {
              const option = visualOptions.find((option) => option.name === name);
              if (!option) return;
              setChosen({ ...selection, [axis]: option.value });
              setVisualChoices({ ...visualChoices, [axis]: name });
            }, (name) => pairingOptionAvailable(rows, selection, axis, visualOptions.find((option) => option.name === name)?.value || name))}</div>;
          }) : swatches.length ? swatchGrid("Material", swatches.map((swatch) => swatch.name), material, setMaterial) : null}
          {!dedicated && !!macros.length && <div className="space-y-4 border-t border-border/60 pt-6">{macros.map((macro) => <figure key={macro.name} className="flex items-center gap-4"><img src={macro.image} alt={`${macro.name} material close-up`} onError={() => setFailedImages(f => [...f, macro.image])} className="h-24 w-24 shrink-0 object-cover sm:h-28 sm:w-28" /><figcaption className="min-w-0 font-body text-sm leading-relaxed"><span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Material detail</span><span className="mt-2 block">{macro.name}</span></figcaption></figure>)}</div>}
          {dimensions && <section className="border-t border-border/60 pt-5"><h3 className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Dimensions &amp; Specifications</h3><p className="mt-3 whitespace-pre-line font-body text-xs leading-relaxed">{dimensions}</p></section>}
          {leadTime && <p className="border-t border-border/60 pt-5 font-body text-xs leading-relaxed text-muted-foreground">Production Lead Time: {leadTime.replace(/^production lead time:\s*/i, "")}</p>}
        </div>
      </div>
    </div>
    <footer className="shrink-0 border-t border-border bg-background px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-10">{preview && <p role="status" className="mb-3 text-xs text-muted-foreground">Customer preview · Unsaved changes</p>}<div className="mb-4 flex items-center justify-between gap-4"><div className="flex h-11 shrink-0 items-center border border-border"><Button variant="ghost" size="icon" aria-label={`Decrease ${piece.title} quantity`} disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} className="h-10 w-10 rounded-none"><Minus className="h-4 w-4" /></Button><span aria-live="polite" className="w-10 text-center text-sm tabular-nums">{quantity}</span><Button variant="ghost" size="icon" aria-label={`Increase ${piece.title} quantity`} disabled={quantity >= 99} onClick={() => setQuantity(quantity + 1)} className="h-10 w-10 rounded-none"><Plus className="h-4 w-4" /></Button></div><p aria-live="polite" className="text-right font-body text-sm">{unit ? formatPublicRrpCents(toDisplayCents(unit * quantity), displayRow, "") : complete ? "Price upon Request" : "Select finishes"}</p></div><Button disabled={preview || !canAdd} onClick={add} className="h-12 w-full whitespace-normal rounded-none bg-foreground px-4 font-body text-xs uppercase tracking-widest text-background hover:bg-foreground/90">Place Order</Button><Button asChild variant="link" className={cn("mt-3 h-auto w-full whitespace-normal px-0 py-1 text-center font-body text-[10px] uppercase tracking-widest text-muted-foreground", preview && "pointer-events-none opacity-50")}><Link to={piece.path} state={{ curatedPairing: true }} onClick={onExplore} aria-disabled={preview} tabIndex={preview ? -1 : undefined}>Request a bespoke quote / customisation</Link></Button></footer>
  </SheetContent></Sheet>;
}