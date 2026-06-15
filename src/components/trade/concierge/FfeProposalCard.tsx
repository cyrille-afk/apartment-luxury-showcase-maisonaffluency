import { useMemo, useState } from "react";
import { Check, X, ExternalLink, ClipboardList, Minus, Plus, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { commitProposal, type FfeProposal } from "@/lib/tradeConciergeStream";
import { supabase } from "@/integrations/supabase/client";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "pending" | "committing" | "approved" | "discarded";

interface Props {
  proposal: FfeProposal;
  onResolved?: (
    outcome: "approved" | "discarded",
    info?: { quoteId: string; url: string; added: number; rooms: number },
  ) => void;
}

const TRADE_DISCOUNT_PCT = 8;

function formatPrice(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents == null || !currency) return "Price Upon Request";
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

export function FfeProposalCard({ proposal, onResolved }: Props) {
  const [status, setStatus] = useState<Status>("pending");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState(proposal.preview);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ quoteId: string; url: string; added: number; rooms: number } | null>(null);

  const rowKey = (room: string, pickId: string) => `${room}::${pickId}`;

  const visibleRows = useMemo(
    () => rows.filter((r) => !excluded.has(rowKey(r.room, r.pick_id))),
    [rows, excluded],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    rows.forEach((r) => {
      const list = map.get(r.room) || [];
      list.push(r);
      map.set(r.room, list);
    });
    return Array.from(map.entries());
  }, [rows]);

  const displayCurrency = useMemo(() => {
    const currencies = Array.from(new Set(visibleRows.map((r) => r.currency).filter(Boolean)));
    return proposal.args.currency || (currencies.length === 1 ? currencies[0] as string : null);
  }, [visibleRows, proposal.args.currency]);

  const { subtotalCents, hasUnpriced } = useMemo(() => {
    let sub = 0;
    let missing = false;
    for (const r of visibleRows) {
      if (r.unit_price_cents == null) { missing = true; continue; }
      sub += r.unit_price_cents * r.qty;
    }
    return { subtotalCents: sub, hasUnpriced: missing };
  }, [visibleRows]);

  const discountCents = Math.round(subtotalCents * (TRADE_DISCOUNT_PCT / 100));
  const totalCents = subtotalCents - discountCents;

  const setQty = (room: string, pickId: string, qty: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.room === room && r.pick_id === pickId
          ? { ...r, qty: Math.max(1, Math.min(99, qty)) }
          : r,
      ),
    );
  };

  const toggleExclude = (room: string, pickId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      const k = rowKey(room, pickId);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const handleApprove = async () => {
    if (visibleRows.length === 0) {
      toast.error("Add at least one row to draft the schedule.");
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

    const rowsPayload = visibleRows.map((r) => ({
      pick_id: r.pick_id,
      room: r.room,
      qty: r.qty,
      variant: r.variant ?? null,
      lead_weeks: r.lead_weeks ?? null,
      note: r.note ?? null,
    }));

    const res = await commitProposal(
      {
        tool: "propose_ffe_rows",
        args: {
          project_id: proposal.args.project_id,
          currency: displayCurrency,
          note: proposal.args.note,
          rows: rowsPayload,
        },
      },
      token,
    );

    if (res.ok === false) {
      setStatus("pending");
      setError(res.error);
      toast.error(res.error);
      return;
    }

    const quoteId = res.quote_id || "";
    const roomCount = new Set(rowsPayload.map((r) => r.room)).size;
    const info = { quoteId, url: res.url, added: res.added, rooms: roomCount };
    setResult(info);
    setStatus("approved");

    toast.success(
      `FF&E schedule drafted — ${res.added} ${res.added === 1 ? "row" : "rows"} across ${roomCount} ${roomCount === 1 ? "room" : "rooms"}`,
      {
        action: { label: "Open quote", onClick: () => window.location.assign(res.url) },
      },
    );

    onResolved?.("approved", info);
  };

  const handleDiscard = () => {
    setStatus("discarded");
    onResolved?.("discarded");
  };

  const projectLabel = proposal.args.project_name || "active project";

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/[0.04] p-3.5 my-2 animate-fade-in">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-display text-[10px] uppercase tracking-widest text-accent">
          ✦ Concierge proposes an FF&E schedule
        </span>
        {displayCurrency && (
          <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
            {displayCurrency} · trade −{TRADE_DISCOUNT_PCT}%
          </span>
        )}
      </div>

      <div className="mb-2 flex items-center gap-1.5 text-foreground">
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-display text-sm truncate" title={projectLabel}>
          {projectLabel}
        </span>
      </div>

      {proposal.args.note && (
        <p className="font-body text-xs text-muted-foreground italic mb-2.5">"{proposal.args.note}"</p>
      )}

      <div className="space-y-3 mb-3">
        {grouped.map(([room, items]) => (
          <div key={room}>
            <div className="font-body text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 border-b border-border/40 pb-1">
              {room} · {items.length} {items.length === 1 ? "item" : "items"}
            </div>
            <ul className="space-y-1.5">
              {items.map((r) => {
                const k = rowKey(r.room, r.pick_id);
                const isExcluded = excluded.has(k);
                const lineTotal = r.unit_price_cents != null ? r.unit_price_cents * r.qty : null;
                return (
                  <li
                    key={k}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg p-1.5 transition-opacity",
                      isExcluded && "opacity-40",
                    )}
                  >
                    {r.image_url ? (
                      <img src={r.image_url} alt="" className="h-10 w-10 rounded object-cover bg-muted shrink-0" loading="lazy" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-xs text-foreground truncate">{r.title}</div>
                      <div className="font-body text-[10px] text-muted-foreground truncate">
                        {[r.designer_name, r.variant].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div className="mt-0.5 font-body text-[10px] text-muted-foreground">
                        {formatPrice(r.unit_price_cents, r.currency)}
                        {lineTotal != null && r.qty > 1 && (
                          <span className="ml-1 text-foreground/70">
                            × {r.qty} = {formatPrice(lineTotal, r.currency)}
                          </span>
                        )}
                        {r.lead_weeks != null && <span className="ml-2">· {r.lead_weeks}w lead</span>}
                      </div>
                    </div>
                    {status === "pending" && (
                      <div className="flex items-center gap-1.5 self-center shrink-0">
                        <div className="flex items-center rounded border border-border">
                          <button
                            onClick={() => setQty(r.room, r.pick_id, r.qty - 1)}
                            className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                            aria-label="Decrease quantity"
                            disabled={isExcluded || r.qty <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-1.5 font-body text-[11px] text-foreground tabular-nums">{r.qty}</span>
                          <button
                            onClick={() => setQty(r.room, r.pick_id, r.qty + 1)}
                            className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                            aria-label="Increase quantity"
                            disabled={isExcluded}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => toggleExclude(r.room, r.pick_id)}
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
          </div>
        ))}
      </div>

      {subtotalCents > 0 && (
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2 mb-3 font-body text-[11px] text-foreground/80 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal (RRP)</span>
            <span className="tabular-nums">{formatPrice(subtotalCents, displayCurrency)}</span>
          </div>
          <div className="flex justify-between text-accent">
            <span>Trade discount −{TRADE_DISCOUNT_PCT}%</span>
            <span className="tabular-nums">−{formatPrice(discountCents, displayCurrency)}</span>
          </div>
          <div className="flex justify-between font-display text-foreground">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(totalCents, displayCurrency)}</span>
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
            disabled={visibleRows.length === 0}
            className="flex items-center gap-1.5 rounded-full bg-foreground text-background font-body text-[11px] uppercase tracking-widest px-3.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ClipboardList className="h-3 w-3" />
            Approve schedule
          </button>
        </div>
      )}

      {status === "committing" && (
        <div className="flex items-center justify-end gap-2 text-muted-foreground">
          <DotCircleLoader size="sm" className="h-3.5 w-3.5" />
          <span className="font-body text-[11px]">Drafting FF&E schedule…</span>
        </div>
      )}

      {status === "approved" && result && (
        <div className="flex items-center justify-between gap-2">
          <span className="font-body text-[11px] text-foreground/80">
            <Check className="inline h-3 w-3 mr-1 text-accent" />
            Drafted {result.added} {result.added === 1 ? "row" : "rows"} across {result.rooms} {result.rooms === 1 ? "room" : "rooms"}
          </span>
          <Link
            to={result.url}
            className="flex items-center gap-1 font-body text-[11px] uppercase tracking-widest text-accent hover:underline shrink-0"
          >
            Open quote
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
