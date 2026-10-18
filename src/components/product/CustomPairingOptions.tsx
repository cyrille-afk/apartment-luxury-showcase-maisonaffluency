import { useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePublicRrpDisplay, formatPublicRrpCents } from "@/hooks/usePublicRrp";
import { addToCart } from "@/lib/cart";
import type { PairingProduct } from "@/lib/curatedPairings";
import { toast } from "sonner";

export default function CustomPairingOptions({ piece, onExplore }: { piece: PairingProduct; onExplore: () => void }) {
  const options = piece.finishOptions || [];
  const [optionId, setOptionId] = useState(options.length === 1 ? options[0].id : "");
  const [quantity, setQuantity] = useState(1);
  const option = options.find((o) => o.id === optionId);
  const { displayRow, toDisplayCents } = usePublicRrpDisplay({ rrp_price_cents: option?.price_cents || null, currency: piece.finishCurrency || "USD", price_unit: null, price_prefix: "" });
  const add = () => {
    if (!option?.price_cents || !piece.pairingRuleId) return;
    const parts = piece.path.split("/");
    addToCart({ pickId: piece.id, designerSlug: parts[2], productSlug: parts[3], title: piece.title, designerName: piece.brand,
      finishLabel: option.name, imageUrl: piece.image, leadTime: piece.leadTime || null, origin: piece.origin || null,
      unitPriceCents: option.price_cents, currency: piece.finishCurrency || "USD", quantity,
      pairing: { ruleId: piece.pairingRuleId, optionId: option.id } });
    toast.success(`${quantity} × ${piece.title} added to your selection`);
  };
  return <div className="mt-4 space-y-3">
    <Select value={optionId} onValueChange={setOptionId}><SelectTrigger aria-label={`${piece.title} Finish`} className="min-h-10 rounded-none text-xs"><SelectValue placeholder="Select Finish" /></SelectTrigger><SelectContent className="z-[10020]">{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
    <div className="flex items-center justify-between gap-2"><span className="font-body text-[10px] uppercase text-muted-foreground">Quantity</span><div className="flex h-9 items-center border border-border/60"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" aria-label={`Decrease ${piece.title} quantity`} disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Minus className="h-3 w-3" /></Button><span aria-live="polite" className="w-7 text-center font-body text-xs tabular-nums">{quantity}</span><Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" aria-label={`Increase ${piece.title} quantity`} disabled={quantity >= 99} onClick={() => setQuantity(quantity + 1)}><Plus className="h-3 w-3" /></Button></div></div>
    <p aria-live="polite" className="font-body text-xs text-muted-foreground">{option?.price_cents ? formatPublicRrpCents(toDisplayCents(option.price_cents * quantity), displayRow, "") : option ? "Price upon Request" : "Select finishes"}</p>
    {option?.price_cents ? <Button variant="outline" className="min-h-10 w-full whitespace-normal rounded-none text-xs" onClick={add}>Add to Selection</Button> : option ? <Button asChild variant="link" className="h-auto whitespace-normal px-0 text-xs"><Link to={piece.path} state={{ curatedPairing: true }} onClick={onExplore}>Request Quote & Customisation</Link></Button> : <Button variant="outline" className="min-h-10 w-full rounded-none text-xs" disabled>Add to Selection</Button>}
  </div>;
}