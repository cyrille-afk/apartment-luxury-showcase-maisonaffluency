import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { type DisplayCurrency, formatPriceConverted } from "@/components/trade/CurrencyToggle";

interface InlinePriceEditorProps {
  productName: string;
  brandName?: string;
  currentPriceCents?: number | null;
  currency?: string;
  displayCurrency?: DisplayCurrency;
  fxRates?: Record<string, number>;
  onPriceUpdated?: (newCents: number, currency: string) => void;
}

/** Normalize for fuzzy matching — strips punctuation, filler words, collapses spaces */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(custom|details?|edition|ed|piece|volume|the|and|of|in)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (s: string) => normalize(s).split(" ").filter((t) => t.length > 2);

/** Singularize very common suffixes */
const singularize = (t: string) =>
  t.endsWith("ches") ? t.slice(0, -2) :
  t.endsWith("ses") ? t.slice(0, -2) :
  t.endsWith("ies") ? t.slice(0, -3) + "y" :
  t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) :
  t;

/** Score how well two product names match (0–1). */
const matchScore = (a: string, b: string): number => {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    return Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
  }
  const ta = new Set(tokenize(a).map(singularize));
  const tb = tokenize(b).map(singularize);
  if (ta.size === 0 || tb.length === 0) return 0;
  let overlap = 0;
  for (const t of tb) { if (ta.has(t)) overlap++; }
  return overlap / Math.max(ta.size, tb.length);
};

export default function InlinePriceEditor({
  productName,
  brandName,
  currentPriceCents,
  currency = "SGD",
  displayCurrency = "original",
  fxRates = {},
  onPriceUpdated,
}: InlinePriceEditorProps) {
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

    // Fetch all trade_products to do fuzzy matching (avoids duplicate records)
    const { data: allProducts } = await supabase
      .from("trade_products")
      .select("id, product_name, brand_name");

    let matchedId: string | null = null;

    if (allProducts && allProducts.length > 0) {
      // 1) Exact case-insensitive match
      const exact = allProducts.find(
        (p) => p.product_name.trim().toLowerCase() === productName.trim().toLowerCase()
      );
      if (exact) {
        matchedId = exact.id;
      } else {
        // 2) Brand-weighted fuzzy match
        let bestId: string | null = null;
        let bestScore = 0;
        for (const p of allProducts) {
          let score = matchScore(productName, p.product_name);
          // Boost score if brand matches
          if (brandName && p.brand_name && normalize(brandName).includes(normalize(p.brand_name))) {
            score += 0.15;
          }
          if (score > bestScore && score >= 0.55) {
            bestScore = score;
            bestId = p.id;
          }
        }
        matchedId = bestId;
      }
    }

    if (matchedId) {
      await supabase.from("trade_products").update({ trade_price_cents: cents, currency }).eq("id", matchedId);
    } else {
      await supabase.from("trade_products").insert({
        product_name: productName,
        brand_name: brandName || "Unknown",
        trade_price_cents: cents,
        currency,
      });
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
          {formatPriceConverted(currentPriceCents, currency, displayCurrency, fxRates)}
        </span>
      ) : (
        <span className="font-body text-[10px] text-muted-foreground/60 italic">Set price</span>
      )}
      <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover/price:opacity-100 transition-opacity" />
    </button>
  );
}
