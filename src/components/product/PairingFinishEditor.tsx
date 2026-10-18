import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAIRING_FINISH_CURRENCIES, type PairingFinishOption } from "@/lib/pairingFinishPricing";

export default function PairingFinishEditor({ options, currency, disabled, onChange, onCurrencyChange }: {
  options: PairingFinishOption[]; currency: string; disabled: boolean;
  onChange: (options: PairingFinishOption[]) => void; onCurrencyChange: (currency: string) => void;
}) {
  const update = (id: string, patch: Partial<PairingFinishOption>) => onChange(options.map((o) => o.id === id ? { ...o, ...patch } : o));
  return <fieldset disabled={disabled} className="space-y-3 border-t border-border pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-lg">Pairing finishes & retail prices</h3><Button variant="outline" size="sm" disabled={disabled || options.length >= 50} onClick={() => onChange([...options, { id: crypto.randomUUID(), name: "", price_cents: null }])}><Plus className="h-4 w-4" />Add finish</Button></div>
    {!!options.length && <><div className="space-y-2"><Label>Price currency</Label><Select value={currency} onValueChange={onCurrencyChange}><SelectTrigger aria-label="Finish price currency"><SelectValue /></SelectTrigger><SelectContent>{PAIRING_FINISH_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
      {options.map((o, index) => <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,120px)_36px] items-end gap-2">
        <div className="space-y-1"><Label htmlFor={`finish-name-${o.id}`}>Finish / configuration</Label><Input id={`finish-name-${o.id}`} aria-label={`Finish ${index + 1} name`} maxLength={160} value={o.name} onChange={(e) => update(o.id, { name: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor={`finish-price-${o.id}`}>Retail price</Label><Input id={`finish-price-${o.id}`} aria-label={`Finish ${index + 1} retail price`} type="number" min="0.01" step="0.01" value={o.price_cents === null ? "" : o.price_cents / 100} placeholder="Upon Request" onChange={(e) => update(o.id, { price_cents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} /></div>
        <Button variant="ghost" size="icon" aria-label={`Remove finish ${index + 1}`} title="Remove finish" onClick={() => onChange(options.filter((item) => item.id !== o.id))}><Trash2 className="h-4 w-4" /></Button>
      </div>)}<Button variant="link" className="px-0 text-muted-foreground" onClick={() => onChange([])}>Use catalogue finishes & prices</Button></>}
  </fieldset>;
}