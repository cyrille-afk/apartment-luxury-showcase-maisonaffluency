import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Pencil, Loader2 } from "lucide-react";

interface InlinePriceEditorProps {
  productName: string;
  currentPriceCents?: number | null;
  currency?: string;
  onPriceUpdated?: (newCents: number, currency: string) => void;
}

const formatPrice = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);

export default function InlinePriceEditor({ productName, currentPriceCents, currency = "SGD", onPriceUpdated }: InlinePriceEditorProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const startEdit = () => {
    setValue(currentPriceCents ? (currentPriceCents / 100).toString() : "");
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    const num = parseFloat(value.replace(/[^0-9.]/g, ""));
    if (isNaN(num) || num <= 0) {
      toast({ title: "Invalid price", variant: "destructive" });
      return;
    }
    setSaving(true);
    const cents = Math.round(num * 100);

    // Upsert: find by name or create
    const { data: existing } = await supabase
      .from("trade_products")
      .select("id")
      .ilike("product_name", productName)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from("trade_products").update({ trade_price_cents: cents, currency }).eq("id", existing[0].id);
    } else {
      await supabase.from("trade_products").insert({ product_name: productName, brand_name: "Unknown", trade_price_cents: cents, currency });
    }

    setSaving(false);
    setEditing(false);
    onPriceUpdated?.(cents, currency);
    toast({ title: "Price updated" });
  };

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
        <span className="font-body text-[10px] text-muted-foreground">{currency}</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="w-20 px-1.5 py-0.5 border border-border rounded text-xs font-body bg-background text-foreground outline-none focus:ring-1 focus:ring-accent"
          placeholder="0"
        />
        <button onClick={save} disabled={saving} className="p-0.5 text-emerald-600 hover:text-emerald-700 transition-colors">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </button>
        <button onClick={cancel} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); startEdit(); }}
      className="group/price flex items-center justify-center gap-1 mt-1 cursor-pointer w-full"
      title="Edit price"
    >
      {currentPriceCents ? (
        <span className="font-display text-sm text-accent font-semibold">
          {formatPrice(currentPriceCents, currency)}
        </span>
      ) : (
        <span className="font-body text-[10px] text-muted-foreground/60 italic">Set price</span>
      )}
      <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover/price:opacity-100 transition-opacity" />
    </button>
  );
}
