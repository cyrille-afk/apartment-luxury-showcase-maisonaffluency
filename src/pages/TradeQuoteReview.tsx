import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Loader2, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface QuoteRow {
  id: string;
  status: string;
  currency: string | null;
  notes: string | null;
  created_at: string;
  project_id: string | null;
}

interface ItemRow {
  id: string;
  quantity: number;
  unit_price_cents: number | null;
  room: string | null;
  variant_label: string | null;
  product_id: string | null;
  trade_products: {
    product_name: string | null;
    brand_name: string | null;
    trade_price_cents: number | null;
    rrp_price_cents: number | null;
    currency: string | null;
    image_url: string | null;
  } | null;
}

const fmt = (cents: number | null | undefined, currency: string) =>
  cents == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

interface PriceCellProps {
  value: number | null;
  currency: string;
  saving: boolean;
  onSave: (newCents: number | null) => Promise<void>;
  placeholder?: string;
}

const PriceCell = ({ value, currency, saving, onSave, placeholder }: PriceCellProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const start = () => {
    setDraft(value != null ? (value / 100).toString() : "");
    setEditing(true);
  };

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      await onSave(null);
    } else {
      const num = parseFloat(trimmed.replace(/[^0-9.]/g, ""));
      if (isNaN(num) || num < 0) {
        setEditing(false);
        return;
      }
      await onSave(Math.round(num * 100));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="font-body text-[10px] text-muted-foreground">{currency}</span>
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-24 px-1.5 py-0.5 border border-border rounded text-xs font-body bg-background text-foreground outline-none focus:ring-1 focus:ring-accent text-right"
          placeholder={placeholder ?? "0"}
        />
        <button onClick={commit} disabled={saving} className="p-0.5 text-emerald-600 hover:text-emerald-700">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </button>
        <button onClick={() => setEditing(false)} className="p-0.5 text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={start}
      className="group/price inline-flex items-center justify-end gap-1.5 cursor-pointer hover:text-accent transition-colors"
      title="Edit price"
    >
      <span>{value == null ? (placeholder ?? "—") : fmt(value, currency)}</span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover/price:opacity-100 transition-opacity" />
    </button>
  );
};

const TradeQuoteReview = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { toast } = useToast();
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [q, i] = await Promise.all([
        supabase.from("trade_quotes").select("id, status, currency, notes, created_at, project_id").eq("id", quoteId).maybeSingle(),
        supabase
          .from("trade_quote_items")
          .select("id, quantity, unit_price_cents, room, variant_label, product_id, trade_products(product_name, brand_name, trade_price_cents, rrp_price_cents, currency, image_url)")
          .eq("quote_id", quoteId)
          .order("room", { ascending: true }),
      ]);
      if (cancelled) return;
      setQuote((q.data as QuoteRow) || null);
      setItems((i.data as unknown as ItemRow[]) || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  const currency = quote?.currency || "EUR";

  const setSaving = (id: string, v: boolean) =>
    setSavingIds((prev) => ({ ...prev, [id]: v }));

  const saveUnitPrice = async (item: ItemRow, newCents: number | null) => {
    const prev = items.find((it) => it.id === item.id)?.unit_price_cents ?? null;
    // optimistic
    setItems((prevItems) =>
      prevItems.map((it) => (it.id === item.id ? { ...it, unit_price_cents: newCents } : it)),
    );
    setSaving(item.id, true);
    const { error } = await supabase
      .from("trade_quote_items")
      .update({ unit_price_cents: newCents })
      .eq("id", item.id);
    setSaving(item.id, false);
    if (error) {
      // rollback
      setItems((prevItems) =>
        prevItems.map((it) => (it.id === item.id ? { ...it, unit_price_cents: prev } : it)),
      );
      toast({ title: "Failed to update unit price", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Unit price updated" });
  };

  const saveCatalogPrice = async (item: ItemRow, newCents: number | null) => {
    if (!item.product_id) {
      toast({ title: "No catalog product linked", variant: "destructive" });
      return;
    }
    const prevMap = new Map(
      items.filter((it) => it.product_id === item.product_id).map((it) => [it.id, it.trade_products?.trade_price_cents ?? null]),
    );
    // optimistic
    setItems((prevItems) =>
      prevItems.map((it) =>
        it.product_id === item.product_id && it.trade_products
          ? { ...it, trade_products: { ...it.trade_products, trade_price_cents: newCents } }
          : it,
      ),
    );
    setSaving(`catalog-${item.id}`, true);
    const { error } = await supabase
      .from("trade_products")
      .update({ trade_price_cents: newCents })
      .eq("id", item.product_id);
    setSaving(`catalog-${item.id}`, false);
    if (error) {
      // rollback
      setItems((prevItems) =>
        prevItems.map((it) => {
          if (it.product_id !== item.product_id || !it.trade_products) return it;
          const prevCents = prevMap.get(it.id) ?? it.trade_products.trade_price_cents;
          return { ...it, trade_products: { ...it.trade_products, trade_price_cents: prevCents } };
        }),
      );
      toast({ title: "Failed to update catalog price", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Catalog price updated" });
  };

  const { grouped, needsReview, totalCents } = useMemo(() => {
    const groups: Record<string, ItemRow[]> = {};
    const review: ItemRow[] = [];
    let total = 0;
    for (const it of items) {
      const key = it.room?.trim() || "Unassigned";
      (groups[key] ||= []).push(it);
      const effective =
        it.unit_price_cents ??
        it.trade_products?.trade_price_cents ??
        it.trade_products?.rrp_price_cents ??
        null;
      if (effective == null) review.push(it);
      else total += effective * it.quantity;
    }
    return { grouped: groups, needsReview: review, totalCents: total };
  }, [items]);

  if (loading) {
    return (
      <div className="max-w-5xl space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="max-w-5xl p-6">
        <p className="font-body text-sm text-muted-foreground">Quote not found.</p>
        <Link to="/trade/quotes" className="text-accent underline text-sm">Back to quotes</Link>
      </div>
    );
  }

  const reviewIds = new Set(needsReview.map((r) => r.id));
  const quoteCode = `QU-${quote.id.slice(0, 6).toUpperCase()}`;

  return (
    <>
      <Helmet>
        <title>Review {quoteCode} — Trade Portal — Maison Affluency</title>
      </Helmet>
      <div className="max-w-5xl p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link to="/trade/quotes" className="inline-flex items-center gap-1 text-xs font-body text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="h-3 w-3" /> Quotes
            </Link>
            <h1 className="font-display text-2xl text-foreground">Review draft quote {quoteCode}</h1>
            <p className="font-body text-xs text-muted-foreground mt-1">
              {items.length} items · {Object.keys(grouped).length} rooms · {currency}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={`/trade/quotes/${quote.id}`}>
              <Pencil className="h-3.5 w-3.5" /> Open in editor
            </Link>
          </Button>
        </div>

        {needsReview.length > 0 ? (
          <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {needsReview.length} item{needsReview.length === 1 ? "" : "s"} need manual pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="font-body text-xs text-muted-foreground">
              No catalog price was found for these items. Click any price below to edit inline — unit prices save to this quote, catalog prices update the product.
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                All items priced
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        {Object.entries(grouped).map(([room, rows]) => (
          <Card key={room}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">{room}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Catalog</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Line</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((it) => {
                    const catalog = it.trade_products?.trade_price_cents ?? null;
                    const effective =
                      it.unit_price_cents ??
                      catalog ??
                      it.trade_products?.rrp_price_cents ??
                      null;
                    const flagged = reviewIds.has(it.id);
                    return (
                      <TableRow key={it.id} className={flagged ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}>
                        <TableCell>
                          <div className="font-body text-sm text-foreground">{it.trade_products?.product_name || "—"}</div>
                          <div className="font-body text-xs text-muted-foreground">{it.trade_products?.brand_name || ""}</div>
                        </TableCell>
                        <TableCell className="font-body text-xs text-muted-foreground">{it.variant_label || "—"}</TableCell>
                        <TableCell className="text-right font-body text-sm">{it.quantity}</TableCell>
                        <TableCell className="text-right font-body text-sm">
                          {it.product_id ? (
                            <PriceCell
                              value={catalog}
                              currency={it.trade_products?.currency || currency}
                              saving={!!savingIds[`catalog-${it.id}`]}
                              onSave={(v) => saveCatalogPrice(it, v)}
                              placeholder="Set"
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-body text-sm">
                          <PriceCell
                            value={it.unit_price_cents}
                            currency={currency}
                            saving={!!savingIds[it.id]}
                            onSave={(v) => saveUnitPrice(it, v)}
                            placeholder="Override"
                          />
                        </TableCell>
                        <TableCell className="text-right font-body text-sm">
                          {effective == null ? "—" : fmt(effective * it.quantity, currency)}
                        </TableCell>
                        <TableCell>
                          {flagged ? (
                            <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-300">
                              Price required
                            </Badge>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        <div className="flex items-center justify-end gap-6 border-t border-border pt-4">
          <div className="font-body text-xs text-muted-foreground">Subtotal (priced items)</div>
          <div className="font-display text-xl text-foreground">{fmt(totalCents, currency)}</div>
        </div>
      </div>
    </>
  );
};

export default TradeQuoteReview;
