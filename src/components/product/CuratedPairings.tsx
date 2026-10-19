import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDbCuratorPicks } from "@/hooks/useDbCuratorPicks";
import { formatPublicRrpForDestination, usePublicRrpMap } from "@/hooks/usePublicRrp";
import { useShippingDestination } from "@/lib/shippingDestination";
import { selectCuratedPairings } from "@/lib/curatedPairings";
import { useCuratedPairingRules } from "@/hooks/useCuratedPairingRules";
import PairingConfigurationSheet from "./PairingConfigurationSheet";
import type { PairingProduct } from "@/lib/curatedPairings";

interface Props {
  open: boolean;
  title: string;
  brand: string;
  excludedIds: string[];
  onDismiss: () => void;
  onExplore: () => void;
}

export default function CuratedPairings({ open, title, brand, excludedIds, onDismiss, onExplore }: Props) {
  const { data: catalogue = [] } = useDbCuratorPicks({ enabled: open });
  const { data: rules = [] } = useCuratedPairingRules(open);
  const reducedMotion = useReducedMotion();
  const destination = useShippingDestination();
  const [configuring, setConfiguring] = useState<PairingProduct | null>(null);
  const [addedPrimary, setAddedPrimary] = useState<PairingProduct | null>(null);
  const [previousSuggestions, setPreviousSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (!open) {
      setAddedPrimary(null);
      setPreviousSuggestions([]);
      setConfiguring(null);
    }
  }, [open]);
  const pieces = useMemo(() => {
    const products = catalogue.flatMap(({ pick, designerName, designerId }) => pick.id && pick.slug && pick.image ? [{
      id: pick.id, title: pick.title || "", brand: designerName, category: pick.category, subcategory: pick.subcategory,
      image: pick.image, path: `/designers/${designerId}/${pick.slug}`,
      materials: pick.materials, leadTime: pick.lead_time, origin: pick.origin,
    }] : []);
    const primary = addedPrimary ?? products.find((p) => p.title.toLowerCase() === title.toLowerCase() && p.brand.toLowerCase() === brand.toLowerCase()) ?? { id: "", title, brand };
    return selectCuratedPairings(primary, products, [...excludedIds, ...previousSuggestions], rules);
  }, [catalogue, title, brand, excludedIds, rules, addedPrimary, previousSuggestions]);
  const { data: prices = {} } = usePublicRrpMap(open ? pieces.map((p) => p.id) : []);

  return <><AnimatePresence>
    {open && pieces.length >= 2 && <motion.section
      key={addedPrimary?.id || title}
      role="region"
      aria-label="Curated Pairings"
      initial={{ opacity: 0, y: reducedMotion ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-x-4 bottom-4 z-10 max-h-[85dvh] overflow-y-auto border border-border/60 bg-background px-6 py-8 text-foreground md:inset-x-auto md:bottom-auto md:left-8 md:right-[452px] md:top-[12%] md:max-h-[76dvh] md:px-10 md:py-10"
    >
      <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Close curated pairings" className="absolute right-3 top-3 rounded-none text-muted-foreground"><X strokeWidth={1.25} /></Button>
      <p className="text-center font-body text-[10px] uppercase tracking-widest text-gold">Curated Pairings</p>
      <h2 className="mx-auto mt-3 max-w-xl text-center font-display text-2xl leading-snug md:text-3xl">Curated to Accompany Your Selection</h2>
      <div className="mt-8 grid grid-cols-2 gap-5 md:gap-8 lg:grid-cols-3">
        {pieces.map((piece) => <article key={piece.id} className="flex min-w-0 flex-col border-b border-border/60 pb-5">
          <Button variant="ghost" onClick={() => setConfiguring(piece)} aria-label={`Configure ${piece.title}`} className="block aspect-square h-auto w-full overflow-hidden rounded-none bg-muted/20 p-0">
            <img src={piece.image} alt={piece.title} className="h-full w-full object-contain" />
          </Button>
          <p className="mt-5 font-body text-[10px] uppercase tracking-widest text-muted-foreground">{piece.brand}</p>
          <h3 className="mt-2 font-display text-lg leading-snug">{piece.title}</h3>
          <p className="mt-3 font-body text-xs text-muted-foreground">{piece.finishOptions?.length ? (() => {
            const amounts = piece.finishOptions.map((o) => o.price_cents).filter((p): p is number => p !== null);
            return amounts.length ? formatPublicRrpForDestination({ rrp_price_cents: Math.min(...amounts), currency: piece.finishCurrency || "USD", price_unit: null, price_prefix: "From" }, destination.currency) : "Price upon Request";
          })() : formatPublicRrpForDestination(prices[piece.id], destination.currency) || "Price upon Request"}</p>
          <Button variant="link" onClick={() => setConfiguring(piece)} className="mt-4 h-auto justify-start self-start whitespace-normal rounded-none px-0 py-0 font-body text-xs text-foreground decoration-gold underline-offset-4">
            Choose Finishes &amp; Quantity <ArrowUpRight className="shrink-0" strokeWidth={1.25} />
          </Button>
        </article>)}
      </div>
      <div className="mt-6 text-center"><Button variant="link" onClick={onDismiss} className="h-auto rounded-none font-body text-xs text-muted-foreground">No, thank you</Button></div>
    </motion.section>}
  </AnimatePresence>{open && configuring && <PairingConfigurationSheet key={configuring.id} piece={configuring} onClose={() => setConfiguring(null)} onExplore={onExplore} onAdded={(piece) => {
    setPreviousSuggestions((previous) => [...new Set([...previous, ...pieces.map((suggestion) => suggestion.id)])]);
    setAddedPrimary(piece);
  }} />}</>;
}