import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const TradeQuoteReview = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const { grouped, needsReview, totalCents } = useMemo(() => {
    const groups: Record<string, ItemRow[]> = {};
    let review: ItemRow[] = [];
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
              No catalog price was found for these items. Set a unit price in the editor before sending the quote to your client.
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
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Line</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((it) => {
                    const effective =
                      it.unit_price_cents ??
                      it.trade_products?.trade_price_cents ??
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
                        <TableCell className="text-right font-body text-sm">{fmt(effective, currency)}</TableCell>
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
