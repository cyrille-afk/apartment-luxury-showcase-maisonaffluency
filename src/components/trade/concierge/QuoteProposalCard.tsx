import { useEffect, useState, useMemo, useRef } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { Check, X, ExternalLink, Plus, FileText, Minus, FolderOpen, Coins, Repeat } from "lucide-react";
import { buildSwapPrompt, sendConciergePrefill } from "@/lib/conciergePrefill";
import { Link } from "react-router-dom";
import { commitProposal, type QuoteProposal } from "@/lib/tradeConciergeStream";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ClientPicker, { type PickedClient } from "@/components/trade/ClientPicker";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useFxRates, convertCents, getFxRatesFetchedAt } from "@/components/trade/CurrencyToggle";

type Status = "pending" | "committing" | "approved" | "discarded";

interface Props {
  proposal: QuoteProposal;
  onResolved?: (
    outcome: "approved" | "discarded",
    info?: { quoteId: string; url: string; added: number; mode: "create" | "append" },
  ) => void;
}

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "SGD", "CHF", "AED", "HKD", "AUD"] as const;

type ProjectClientInfo = { client_id?: string | null; client_name?: string | null };

function formatPrice(cents: number | null, currency: string | null): string {
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

function normalizeLoose(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseSqm(label: string | null | undefined): number | null {
  const match = String(label || "").match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(cm|m)?/i);
  if (!match) return null;
  const width = parseFloat(match[1].replace(",", "."));
  const length = parseFloat(match[2].replace(",", "."));
  if (!(width > 0 && length > 0)) return null;
  const factor = (match[3] || "cm").toLowerCase() === "m" ? 1 : 0.01;
  return width * factor * length * factor;
}

function variantOptionLabel(v: any): string {
  return [v?.base, v?.top, v?.label].filter((s) => s && String(s).trim()).join(" — ");
}

function computeVariantOptionPrice(row: any, label: string): number | null {
  const wanted = normalizeLoose(label);
  const variants = Array.isArray(row?.size_variants) ? row.size_variants : [];
  const hit = variants.find((v: any) => {
    const option = normalizeLoose(variantOptionLabel(v));
    return option && (option === wanted || option.includes(wanted) || wanted.includes(option));
  });
  if (Number(hit?.price_cents) > 0) return Number(hit.price_cents);
  const sqm = parseSqm(label);
  const rate = Number(row?.price_per_sqm_cents);
  return sqm && rate > 0 ? Math.round(sqm * rate) : null;
}

export function QuoteProposalCard({ proposal, onResolved }: Props) {
  const isAppend = proposal.tool === "add_to_quote";
  const [status, setStatus] = useState<Status>("pending");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState(proposal.preview);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ quoteId: string; url: string; added: number } | null>(null);

  const proposalLineCurrency = (() => {
    const currencies = Array.from(new Set(proposal.preview.map((l) => l.currency).filter(Boolean)));
    return currencies.length === 1 ? currencies[0] : null;
  })();

  // Pre-fill project from session if available (set by AIConcierge when entering chat).
  const initialProjectId =
    !isAppend && proposal.tool === "draft_quote"
      ? proposal.args.project_id ||
        (typeof window !== "undefined"
          ? sessionStorage.getItem("trade:lastProjectFilter") || null
          : null)
      : null;
  const initialCurrency =
    proposal.tool === "draft_quote" ? proposalLineCurrency || proposal.args.currency || "EUR" : null;

  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [projectClientFallback, setProjectClientFallback] = useState<{ id: string | null; name: string } | null>(null);
  const [client, setClient] = useState<PickedClient | null>(null);
  const [currency, setCurrencyState] = useState<string>(initialCurrency || "EUR");
  const hydratedVariantPricingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missingIds = Array.from(new Set(lines
      .filter((l) => l.variant_options?.some((o) => o.price_cents == null))
      .map((l) => l.pick_id)))
      .filter((id) => !hydratedVariantPricingIdsRef.current.has(id));
    if (!missingIds.length) return;
    missingIds.forEach((id) => hydratedVariantPricingIdsRef.current.add(id));
    let cancelled = false;
    supabase
      .from("designer_curator_picks" as any)
      .select("id, price_per_sqm_cents, currency, size_variants")
      .in("id", missingIds)
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data)) return;
        const rows = new Map((data as any[]).map((row) => [row.id, row]));
        setLines((prev) => prev.map((line) => {
          const row = rows.get(line.pick_id);
          if (!row || !line.variant_options?.length) return line;
          return {
            ...line,
            currency: line.currency || row.currency || null,
            variant_options: line.variant_options.map((option) => ({
              ...option,
              price_cents: option.price_cents ?? computeVariantOptionPrice(row, option.label),
            })),
          };
        }));
      });
    return () => { cancelled = true; };
  }, [lines]);

  const { projects } = useProjects({ activeOnly: true });
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId],
  );
  const projectRecord = selectedProject as (Project & ProjectClientInfo) | null;
  const projectClientId = projectRecord?.client_id ?? null;
  const projectClientName = projectRecord?.client_name?.trim() || "";

  useEffect(() => {
    let cancelled = false;
    if (!projectId || projectClientId || projectClientName) {
      setProjectClientFallback(null);
      return;
    }
    supabase
      .from("projects")
      .select("client_id, client_name")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as ProjectClientInfo | null;
        setProjectClientFallback(row ? {
          id: row.client_id ?? null,
          name: row.client_name?.trim() || "",
        } : null);
      });
    return () => { cancelled = true; };
  }, [projectId, projectClientId, projectClientName]);

  const lineCurrency = useMemo(
    () => lines.find((l) => l.currency)?.currency || null,
    [lines],
  );
  // For append-to-existing-quote we must keep the existing quote's currency.
  // For a brand-new draft, the user is free to pick any display currency.
  const displayCurrency = isAppend ? (lineCurrency || currency) : currency;
  const trade_discount_pct = lines[0]?.trade_discount_pct ?? 0;

  // Live FX rates (Frankfurter, cached). Falls back to bundled rates offline.
  const fxRates = useFxRates();
  const ratesFetchedAt = getFxRatesFetchedAt();
  const convert = (cents: number | null, fromCurrency: string | null): number | null => {
    if (cents == null) return null;
    const src = fromCurrency || displayCurrency;
    if (!src || src === displayCurrency) return cents;
    return convertCents(cents, src, displayCurrency as any, fxRates);
  };

  function relativeTime(ts: number | null): string {
    if (!ts) return "fallback rates";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "just now";
    const mins = Math.round(diff / 60_000);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // When appending, keep the dropdown synced to the existing quote currency.
  useEffect(() => {
    if (isAppend && lineCurrency && currency !== lineCurrency) {
      setCurrencyState(lineCurrency);
    }
  }, [currency, isAppend, lineCurrency]);

  const visibleLines = lines.filter((l) => !excluded.has(l.pick_id));

  const effectiveLineUnitPrice = (l: (typeof lines)[number]) => {
    if (l.variant_options?.length) {
      if (!l.variant) return null;
      return l.variant_options.find((o) => o.label === l.variant)?.price_cents ?? null;
    }
    return l.unit_price_cents;
  };

  const subtotalCents = visibleLines.reduce((sum, l) => {
    const unitPrice = effectiveLineUnitPrice(l);
    if (unitPrice == null) return sum;
    const converted = convert(unitPrice, l.currency) ?? unitPrice;
    return sum + converted * l.qty;
  }, 0);
  const discountCents = Math.round((subtotalCents * trade_discount_pct) / 100);
  const totalCents = subtotalCents - discountCents;
  const hasUnpriced = visibleLines.some((l) => effectiveLineUnitPrice(l) == null);

  const setQty = (pickId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.pick_id === pickId ? { ...l, qty: Math.max(1, Math.min(99, qty)) } : l)),
    );
  };

  const setVariant = (pickId: string, label: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.pick_id !== pickId) return l;
        const opt = l.variant_options?.find((o) => o.label === label);
        return {
          ...l,
          variant: label || null,
          unit_price_cents: opt?.price_cents ?? null,
        };
      }),
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

  const needsClient = !isAppend;
  const effectiveProjectClientId = projectClientId ?? projectClientFallback?.id ?? null;
  const effectiveProjectClientName = projectClientName || projectClientFallback?.name || "";
  const hasClientForDraft = !!client?.id || !!effectiveProjectClientId || !!effectiveProjectClientName || !!projectId;
  const canApprove =
    visibleLines.length > 0 && (!needsClient || hasClientForDraft);

  const handleApprove = async () => {
    if (visibleLines.length === 0) {
      toast.error("Add at least one line to the quote.");
      return;
    }
    if (needsClient && !hasClientForDraft) {
      toast.error("Pick a client or a project with a client before drafting the quote.");
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
    // On a brand-new draft the user-picked currency wins; on append we must
    // keep the existing quote's currency intact.
    const quoteCurrency = isAppend ? (lineCurrency || currency) : (currency || lineCurrency);

    const body =
      proposal.tool === "draft_quote"
        ? {
            tool: "draft_quote" as const,
            args: {
              project_id: projectId,
              client_id: client?.id ?? effectiveProjectClientId ?? null,
              client_name: client?.name ?? effectiveProjectClientName,
              currency: quoteCurrency,
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
    if (res.ok === false) {
      setStatus("pending");
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setStatus("approved");
    const quoteId = res.quote_id || "";
    setResult({ quoteId, url: res.url, added: res.added });

    // Toast with a link — replaces the previous jarring auto-navigate.
    const quoteLabel = quoteId ? `QU-${quoteId.slice(0, 6).toUpperCase()}` : "quote";
    toast.success(
      isAppend
        ? `Added ${res.added} ${res.added === 1 ? "line" : "lines"} to ${quoteLabel}`
        : `Drafted ${quoteLabel} with ${res.added} ${res.added === 1 ? "line" : "lines"}`,
      {
        action: {
          label: "Open quote",
          onClick: () => {
            window.location.assign(res.url);
          },
        },
      },
    );

    onResolved?.("approved", {
      quoteId,
      url: res.url,
      added: res.added,
      mode: isAppend ? "append" : "create",
    });
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
        {displayCurrency && (
          <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
            {displayCurrency}
            {trade_discount_pct > 0 && ` · trade −${trade_discount_pct}%`}
          </span>
        )}
      </div>

      {proposal.tool === "add_to_quote" && (
        <div className="mb-2 font-display text-sm text-foreground truncate" title={proposal.args.quote_label}>
          {proposal.args.quote_label}
        </div>
      )}

      {/* Client / Project / Currency chips — only for new drafts and only while pending */}
      {!isAppend && status === "pending" && (
        <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="min-w-0">
            <label className="block font-body text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Client *
            </label>
            <ClientPicker
              value={client?.id ?? null}
              onChange={setClient}
              size="sm"
              placeholder="Pick client…"
              showManageLink={false}
            />
          </div>
          <div className="min-w-0">
            <label className="block font-body text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Project
            </label>
            <div className="relative">
              <FolderOpen className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={projectId ?? ""}
                onChange={(e) => setProjectId(e.target.value || null)}
                className="w-full h-9 pl-7 pr-2 rounded-md border border-input bg-background text-xs font-body text-foreground appearance-none"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="min-w-0">
            <label className="block font-body text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Currency
            </label>
            <div className="relative">
              <Coins className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={currency}
                onChange={(e) => setCurrencyState(e.target.value)}
                className="w-full h-9 pl-7 pr-2 rounded-md border border-input bg-background text-xs font-body text-foreground appearance-none"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {proposal.args.note && (
        <p className="font-body text-xs text-muted-foreground italic mb-2.5">"{proposal.args.note}"</p>
      )}

      <ul className="space-y-1.5 mb-3">
        {lines.map((l) => {
          const isExcluded = excluded.has(l.pick_id);
          const effectiveUnitPrice = effectiveLineUnitPrice(l);
          const displayedUnitPrice = convert(effectiveUnitPrice, l.currency);
          const lineTotal = displayedUnitPrice != null ? displayedUnitPrice * l.qty : null;
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
                  {[l.designer_name, !l.variant_options ? l.variant : null].filter(Boolean).join(" · ") || "—"}
                </div>
                {l.variant_options && l.variant_options.length > 0 && status === "pending" && (
                  <select
                    value={l.variant ?? ""}
                    onChange={(e) => setVariant(l.pick_id, e.target.value)}
                    className="mt-1 w-full h-7 px-1.5 rounded border border-input bg-background text-[10px] font-body text-foreground"
                  >
                    <option value="">Select option…</option>
                    {l.variant_options.map((o) => (
                      <option key={o.label} value={o.label}>
                        {o.label}
                        {o.price_cents != null
                          ? ` — ${formatPrice(convert(o.price_cents, l.currency), displayCurrency)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                )}
                <div className="mt-0.5 font-body text-[10px] text-muted-foreground">
                  {formatPrice(displayedUnitPrice, displayCurrency)}
                  {lineTotal != null && l.qty > 1 && (
                    <span className="ml-1 text-foreground/70">
                      × {l.qty} = {formatPrice(lineTotal, displayCurrency)}
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
                    type="button"
                    onClick={() => sendConciergePrefill(buildSwapPrompt({
                      pick_id: l.pick_id,
                      title: l.title,
                      designer_name: l.designer_name,
                      materials: (l as any).materials ?? null,
                      category: (l as any).category ?? null,
                    }))}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-accent text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border transition-colors"
                    aria-label={`Swap ${l.title || "this line"} for a similar piece`}
                    title="Swap for a similar piece (darker wood / warmer finish)"
                  >
                    <Repeat className="h-3 w-3" />
                    Swap
                  </button>
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
            <span className="tabular-nums">{formatPrice(subtotalCents, displayCurrency)}</span>
          </div>
          {trade_discount_pct > 0 && (
            <div className="flex justify-between text-accent">
              <span>Trade discount −{trade_discount_pct}%</span>
              <span className="tabular-nums">−{formatPrice(discountCents, displayCurrency)}</span>
            </div>
          )}
          <div className="flex justify-between font-display text-foreground">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(totalCents, displayCurrency)}</span>
          </div>
          {hasUnpriced && (
            <div className="pt-1 text-[10px] text-muted-foreground italic">
              Some items priced on request — final total confirmed at quoting.
            </div>
          )}
          <div className="pt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent/70" aria-hidden="true" />
            FX rates via Frankfurter · {relativeTime(ratesFetchedAt)}
          </div>
        </div>
      )}

      {error && <p className="font-body text-[11px] text-destructive mb-2">{error}</p>}

      {status === "pending" && (
        <div className="flex items-center justify-between gap-2">
          {needsClient && !hasClientForDraft ? (
            <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
              Pick a client or linked project to continue
            </span>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              className="font-body text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground px-2.5 py-1.5 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleApprove}
              disabled={!canApprove}
              className="flex items-center gap-1.5 rounded-full bg-foreground text-background font-body text-[11px] uppercase tracking-widest px-3.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ApproveIcon className="h-3 w-3" />
              {approveLabel}
            </button>
          </div>
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
        <div className="flex items-center justify-between gap-2">
          <span className="font-body text-[11px] text-foreground/80">
            <Check className="inline h-3 w-3 mr-1 text-accent" />
            {isAppend
              ? `Added ${result.added} ${result.added === 1 ? "line" : "lines"}`
              : `Drafted QU-${result.quoteId.slice(0, 6).toUpperCase()} with ${result.added} ${result.added === 1 ? "line" : "lines"}`}
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
