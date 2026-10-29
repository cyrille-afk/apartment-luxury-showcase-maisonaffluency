import { FileText, Clock, CheckCircle, Send, CreditCard, XCircle } from "lucide-react";

export const quoteStatusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: "Draft", icon: FileText, className: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", icon: Send, className: "bg-primary/10 text-primary" },
  priced: { label: "Priced — Review", icon: Clock, className: "bg-amber-500/10 text-amber-600" },
  confirmed: { label: "Order Confirmed", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600" },
  deposit_paid: { label: "Deposit Paid", icon: CreditCard, className: "bg-emerald-500/10 text-emerald-600" },
  paid: { label: "Fully Paid", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-destructive/10 text-destructive" },
};

export const quoteStatusMeta = (status: string | null | undefined) =>
  quoteStatusConfig[status || "draft"] || quoteStatusConfig.draft;

/**
 * Last activity on a quote: the quote row's own updated_at, or the newest
 * line item's created_at, whichever is later. trade_quote_items has no
 * updated_at and no trigger bumps the parent row, so item additions would
 * otherwise leave "last updated" stale.
 */
export const quoteLastActivity = (
  quoteUpdatedAt: string | null | undefined,
  itemCreatedAts: (string | null | undefined)[],
): string | null => {
  let best: number | null = null;
  const consider = (iso: string | null | undefined) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return;
    if (best === null || t > best) best = t;
  };
  consider(quoteUpdatedAt);
  for (const iso of itemCreatedAts) consider(iso);
  return best === null ? null : new Date(best).toISOString();
};

export const formatQuoteDate = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
