import { useState } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { Check, X, ExternalLink, Plus, FileText, Minus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { commitProposal, type QuoteProposal } from "@/lib/tradeConciergeStream";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "pending" | "committing" | "approved" | "discarded";

interface Props {
  proposal: QuoteProposal;
  onResolved?: (
    outcome: "approved" | "discarded",
    info?: { quoteId: string; url: string; added: number; mode: "create" | "append" },
  ) => void;
}

function formatPrice(cents: number | null, currency: string | null): string {
  if (cents == null || !currency) return "Price on Request";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency}`;
  }
}

export function QuoteProposalCard({ proposal, onResolved }: Props) {
  const isAppend = proposal.tool === "add_to_quote";
  const [status, setStatus] = useState<Status>("pending");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState(proposal.preview);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ quoteId: string; url: string; added: number } | null>(null);
  const navigate = useNavigate();

  const currency =
    proposal.tool === "draft_quote"
      ? proposal.args.currency || lines.find((l) => l.currency)?.currency || null
      : lines.find((l) => l.currency)?.currency || null;

  const trade_discount_pct = lines[0]?.trade_discount_pct ?? 0;

  const visibleLines = lines.filter((l) => !excluded.has(l.pick_id));

  const subtotalCents = visibleLines.reduce((sum, l) => {
    if (l.unit_price_cents == null) return sum;
    return sum + l.unit_price_cents * l.qty;
  }, 0);
  const discountCents = Math.round((subtotalCents * trade_discount_pct) / 100);
  const totalCents = subtotalCents - discountCents;
  const hasUnpriced = visibleLines.some((l) => l.unit_price_cents == null);

  const setQty = (pickId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.pick_id === pickId ? { ...l, qty: Math.max(1, Math.min(99, qty)) } : l)),
    );
  };

  const toggleExclude = (pickId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(pickId)) next.delete(pickId);
      else next.add(pickId);
      return next;
    });
  };

  const handleApprove = async () => {
    if (visibleLines.length === 0) {
      toast.error("Add at least one line to the quote.");
      return;
    }
    setStatus("committing");
    setError(null);

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setStatus("pending");
      setError("You need to be signed in to approve this draft.");
      return;
    }

    const linesPayload = visibleLines.map((l) => ({
      pick_id: l.pick_id,
      qty: l.qty,
      variant: l.variant,
      lead_weeks: l.lead_weeks,
      note: l.note,
    }));

    const body =
      proposal.tool === "draft_quote"
        ? {
            tool: "draft_quote" as const,
            args: {
              project_id: proposal.args.project_id,
              currency: proposal.args.currency,
              note: proposal.args.note,
              lines: linesPayload,
            },
          }
        : {
            tool: "add_to_quote" as const,
            args: {
              quote_id: proposal.args.quote_id,
              note: proposal.args.note,
              lines: linesPayload,
            },
          };

    const res = await commitProposal(body, token);
    if (!res.ok) {
      setStatus("pending");
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setStatus("approved");
    const quoteId = res.quote_id || "";
    setResult({ quoteId, url: res.url, added: res.added });
    onResolved?.("approved", {
      quoteId,
      url: res.url,
      added: res.added,
      mode: isAppend ? "append" : "create",
    });
    setTimeout(() => navigate(res.url), 700);
  };

  const handleDiscard = () => {
    setStatus("discarded");
    onResolved?.("discarded");
  };

  const headerLabel = isAppend
    ? "✦ Concierge proposes adding to your quote"
    : "✦ Concierge proposes a new quote";
  const approveLabel = isAppend ? "Approve & add" : "Approve & draft";
  const ApproveIcon = isAppend ? Plus : FileText;

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/[0.04] p-3.5 my-2 animate-fade-in">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-display text-[10px] uppercase tracking-widest text-accent">
          {headerLabel}
        </span>
        {currency && (
          <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
            {currency}
            {trade_discount_pct > 0 && ` · trade −${trade_discount_pct}%`}
          </span>
        )}
      </div>

      {proposal.tool === "add_to_quote" && (
        <div className="mb-2 font-display text-sm text-foreground truncate" title={proposal.args.quote_label}>
          {proposal.args.quote_label}
        </div>
      )}

      {proposal.args.note && (
        <p className="font-body text-xs text-muted-foreground italic mb-2.5">"{proposal.args.note}"</p>
      )}

      <ul className="space-y-1.5 mb-3">
        {lines.map((l) => {
          const isExcluded = excluded.has(l.pick_id);
          const lineTotal = l.unit_price_cents != null ? l.unit_price_cents * l.qty : null;
          return (
            <li
              key={l.pick_id}
              className={cn(
                "flex items-start gap-2.5 rounded-lg p-1.5 transition-opacity",
                isExcluded && "opacity-40",
              )}
            >
              {l.image_url ? (
                <img src={l.image_url} alt="" className="h-10 w-10 rounded object-cover bg-muted shrink-0" loading="lazy" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-body text-xs text-foreground truncate">{l.title}</div>
                <div className="font-body text-[10px] text-muted-foreground truncate">
                  {[l.designer_name, l.variant].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="mt-0.5 font-body text-[10px] text-muted-foreground">
                  {formatPrice(l.unit_price_cents, l.currency)}
                  {lineTotal != null && l.qty > 1 && (
                    <span className="ml-1 text-foreground/70">
                      × {l.qty} = {formatPrice(lineTotal, l.currency)}
                    </span>
                  )}
                  {l.lead_weeks != null && <span className="ml-2">· {l.lead_weeks}w lead</span>}
                </div>
              </div>
              {status === "pending" && (
                <div className="flex items-center gap-1.5 self-center shrink-0">
                  <div className="flex items-center rounded border border-border">
                    <button
                      onClick={() => setQty(l.pick_id, l.qty - 1)}
                      className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                      aria-label="Decrease quantity"
                      disabled={isExcluded || l.qty <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-1.5 font-body text-[11px] text-foreground tabular-nums">{l.qty}</span>
                    <button
                      onClick={() => setQty(l.pick_id, l.qty + 1)}
                      className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                      aria-label="Increase quantity"
                      disabled={isExcluded}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => toggleExclude(l.pick_id)}
                    className="text-muted-foreground hover:text-foreground text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border"
                  >
                    {isExcluded ? "Add" : "Skip"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Totals */}
      {subtotalCents > 0 && (
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2 mb-3 font-body text-[11px] text-foreground/80 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal (RRP)</span>
            <span className="tabular-nums">{formatPrice(subtotalCents, currency)}</span>
          </div>
          {trade_discount_pct > 0 && (
            <div className="flex justify-between text-accent">
              <span>Trade discount −{trade_discount_pct}%</span>
              <span className="tabular-nums">−{formatPrice(discountCents, currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-display text-foreground">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(totalCents, currency)}</span>
          </div>
          {hasUnpriced && (
            <div className="pt-1 text-[10px] text-muted-foreground italic">
              Some items priced on request — final total confirmed at quoting.
            </div>
          )}
        </div>
      )}

      {error && <p className="font-body text-[11px] text-destructive mb-2">{error}</p>}

      {status === "pending" && (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleDiscard}
            className="font-body text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground px-2.5 py-1.5 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleApprove}
            disabled={visibleLines.length === 0}
            className="flex items-center gap-1.5 rounded-full bg-foreground text-background font-body text-[11px] uppercase tracking-widest px-3.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <ApproveIcon className="h-3 w-3" />
            {approveLabel}
          </button>
        </div>
      )}

      {status === "committing" && (
        <div className="flex items-center justify-end gap-2 text-muted-foreground">
          <DotCircleLoader size="sm" className="h-3.5 w-3.5" />
          <span className="font-body text-[11px]">
            {isAppend ? "Adding to quote…" : "Drafting quote…"}
          </span>
        </div>
      )}

      {status === "approved" && result && (
        <div className="flex items-center justify-between">
          <span className="font-body text-[11px] text-foreground/80">
            <Check className="inline h-3 w-3 mr-1 text-accent" />
            {isAppend
              ? `Added ${result.added} ${result.added === 1 ? "line" : "lines"}`
              : `Drafted with ${result.added} ${result.added === 1 ? "line" : "lines"}`}
          </span>
          <Link
            to={result.url}
            className="flex items-center gap-1 font-body text-[11px] uppercase tracking-widest text-accent hover:underline"
          >
            Open
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}

      {status === "discarded" && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <X className="h-3.5 w-3.5" />
          <span className="font-body text-[11px]">Discarded</span>
        </div>
      )}
    </div>
  );
}
