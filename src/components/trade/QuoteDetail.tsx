import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Trash2, Plus, Minus, Package, Printer, ChevronDown, CheckCircle, CreditCard, Loader2, Edit3, XCircle, FileSpreadsheet, Lock } from "lucide-react";
import { QuoteItemSkeleton } from "@/components/trade/skeletons";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import affluencyLogo from "@/assets/affluency-logo-square.jpg";
import { downloadProcurementWorkbook, autoPoNumber, type ProcurementLine } from "@/lib/procurementExcel";

const CURRENCIES = ["SGD", "USD", "EUR", "GBP"] as const;
type Currency = (typeof CURRENCIES)[number];

interface QuoteItemWithProduct {
  id: string;
  quote_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number | null;
  notes: string | null;
  po_number: string | null;
  cost_code: string | null;
  lead_time_weeks_override: number | null;
  deposit_pct_override: number | null;
  trade_products: {
    product_name: string;
    brand_name: string;
    trade_price_cents: number | null;
    rrp_price_cents?: number | null;
    currency: string;
    image_url: string | null;
    dimensions: string | null;
    materials: string | null;
    lead_time: string | null;
    sku: string | null;
  } | null;
}

interface QuoteDetailProps {
  quoteId: string;
  quoteStatus: string;
  quoteCreatedAt: string;
  quoteNotes: string | null;
  onBack: () => void;
  onStatusChange: () => void;
}

const formatPriceRaw = (cents: number | null, currency: string = "SGD") => {
  if (!cents) return null;
  return new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const currencySymbol = (c: string) => {
  const map: Record<string, string> = { SGD: "S$", USD: "US$", EUR: "€", GBP: "£" };
  return map[c] || c;
};

const QuoteDetail = ({ quoteId, quoteStatus, quoteCreatedAt, quoteNotes, onBack, onStatusChange }: QuoteDetailProps) => {
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const { discountPct: tradeDiscountPct, discountLabel: tradeDiscountLabel, tierLabel } = useTradeDiscount();
  const [items, setItems] = useState<QuoteItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState(quoteNotes || "");
  const [adminNotes, setAdminNotes] = useState("");
  const [currency, setCurrency] = useState<Currency>("SGD");
  const [clientCompany, setClientCompany] = useState("");
  const [clientName, setClientName] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [tradeDiscount, setTradeDiscount] = useState(false);
  // GST defaults to ON only for SGD quotes; other currencies (EUR/USD/GBP) default OFF.
  // The user can still toggle it on manually if needed.
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstUserTouched, setGstUserTouched] = useState(false);
  const [gstRate, setGstRate] = useState(9);
  const [editingGstRate, setEditingGstRate] = useState(false);
  const [payingStripe, setPayingStripe] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Insurance bundling
  type InsuranceTier = "standard" | "premium" | "all_risk";
  const INSURANCE_TIERS: { value: InsuranceTier; label: string; rateBps: number; description: string }[] = [
    { value: "standard", label: "Standard Transit", rateBps: 50, description: "Loss & damage in transit. Door-to-door coverage." },
    { value: "premium", label: "Premium Transit", rateBps: 100, description: "Adds handling, storage in-transit, partial loss." },
    { value: "all_risk", label: "All-Risk Fine Art", rateBps: 180, description: "Comprehensive incl. installation, storage 30 days, named perils." },
  ];
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [insuranceTier, setInsuranceTier] = useState<InsuranceTier>("standard");
  const [insuranceRateBps, setInsuranceRateBps] = useState<number>(50);
  const [insuranceNotes, setInsuranceNotes] = useState("");

  const quoteNumber = `QU-${quoteId.slice(0, 6).toUpperCase()}`;
  const isDraft = quoteStatus === "draft";
  const isPriced = quoteStatus === "priced";
  const isCancelled = quoteStatus === "cancelled";
  const isConfirmed = quoteStatus === "confirmed" || quoteStatus === "deposit_paid" || quoteStatus === "paid";
  const isDepositPaid = quoteStatus === "deposit_paid";
  const isFullyPaid = quoteStatus === "paid";
  const isReadOnly = !isDraft && !isSuperAdmin;

  const createdDate = new Date(quoteCreatedAt);
  const expiryDate = new Date(createdDate);
  expiryDate.setDate(expiryDate.getDate() + 7);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  /** Convert cents from `fromCurrency` to `toCurrency` using live rates */
  const convertCents = (cents: number | null, fromCurrency: string, toCurrency: string): number | null => {
    if (!cents) return null;
    if (fromCurrency === toCurrency) return cents;
    // rate key e.g. "EUR_SGD"
    const key = `${fromCurrency}_${toCurrency}`;
    const rate = fxRates[key];
    if (!rate) return cents; // fallback: show unconverted
    return Math.round(cents * rate);
  };

  // Fetch exchange rates from frankfurter.app
  useEffect(() => {
    const fetchRates = async () => {
      // Collect unique source currencies from items that differ from quote currency
      const sourceCurrencies = new Set<string>();
      items.forEach((item) => {
        const prodCurrency = item.trade_products?.currency;
        if (prodCurrency && prodCurrency !== currency) {
          sourceCurrencies.add(prodCurrency);
        }
      });
      if (sourceCurrencies.size === 0) { setFxRates({}); return; }

      const newRates: Record<string, number> = {};
      await Promise.all(
        Array.from(sourceCurrencies).map(async (src) => {
          try {
            const res = await fetch(`https://api.frankfurter.app/latest?from=${src}&to=${currency}`);
            const data = await res.json();
            if (data.rates?.[currency]) {
              newRates[`${src}_${currency}`] = data.rates[currency];
            }
          } catch {
            // silently fail — will show unconverted price
          }
        })
      );
      setFxRates(newRates);
    };
    if (items.length > 0) fetchRates();
  }, [items, currency]);

  // Fetch items, currency, and profile
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [itemsRes, quoteRes, profileRes] = await Promise.all([
        supabase
          .from("trade_quote_items")
          .select("*, trade_products(product_name, brand_name, trade_price_cents, rrp_price_cents, currency, image_url, dimensions, materials, lead_time, sku)")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: true }),
        supabase.from("trade_quotes").select("currency, client_name, admin_notes, project_id, insurance_enabled, insurance_tier, insurance_rate_bps, insurance_notes").eq("id", quoteId).single(),
        user ? supabase.from("profiles").select("company, first_name, last_name").eq("id", user.id).single() : null,
      ]);
      let loadedItems = (itemsRes.data as QuoteItemWithProduct[]) || [];

      // Fallback price lookup with fuzzy matching (same logic as Showroom)
      const needsPrice = loadedItems.filter(
        (i) => i.trade_products && !i.trade_products.trade_price_cents
      );
      if (needsPrice.length > 0) {
        const { data: priced } = await supabase
          .from("trade_products")
          .select("product_name, trade_price_cents, currency")
          .not("trade_price_cents", "is", null);

        if (priced && priced.length > 0) {
          const normalize = (s: string) =>
            s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
          const tokenize = (s: string) =>
            normalize(s).split(" ").filter((t) => t.length > 2);

          const exactLookup = new Map<string, { cents: number; currency: string }>();
          const entries: { name: string; cents: number; currency: string }[] = [];
          for (const p of priced) {
            const entry = { name: p.product_name, cents: p.trade_price_cents!, currency: p.currency };
            entries.push(entry);
            exactLookup.set(p.product_name.trim().toLowerCase(), entry);
            const norm = normalize(p.product_name);
            if (norm) exactLookup.set(norm, entry);
          }

          const findMatch = (name: string) => {
            const key = name.trim().toLowerCase();
            if (exactLookup.has(key)) return exactLookup.get(key)!;
            const norm = normalize(name);
            if (exactLookup.has(norm)) return exactLookup.get(norm)!;
            for (const e of entries) {
              const cn = normalize(e.name);
              if (cn.includes(norm) || norm.includes(cn)) return e;
            }
            const targetTokens = new Set(tokenize(name));
            if (targetTokens.size === 0) return undefined;
            let best: typeof entries[0] | undefined;
            let bestScore = 0;
            for (const e of entries) {
              const ct = tokenize(e.name);
              let overlap = 0;
              for (const t of ct) { if (targetTokens.has(t)) overlap++; }
              const score = overlap / Math.max(targetTokens.size, ct.length);
              if (score > 0.5 && score > bestScore) { bestScore = score; best = e; }
            }
            return best;
          };

          loadedItems = loadedItems.map((item) => {
            if (item.trade_products && !item.trade_products.trade_price_cents) {
              const match = findMatch(item.trade_products.product_name);
              if (match) {
                return {
                  ...item,
                  trade_products: {
                    ...item.trade_products,
                    trade_price_cents: match.cents,
                    currency: match.currency,
                  },
                };
              }
            }
            return item;
          });
        }
      }

      setItems(loadedItems);
      if (quoteRes.data?.currency) setCurrency(quoteRes.data.currency as Currency);
      if (quoteRes.data?.client_name) setClientName(quoteRes.data.client_name as string);
      if ((quoteRes.data as any)?.admin_notes) setAdminNotes((quoteRes.data as any).admin_notes);
      if ((quoteRes.data as any)?.project_id !== undefined) setProjectId((quoteRes.data as any).project_id);
      const q = quoteRes.data as any;
      if (q?.insurance_enabled !== undefined) setInsuranceEnabled(!!q.insurance_enabled);
      if (q?.insurance_tier) setInsuranceTier(q.insurance_tier as InsuranceTier);
      if (q?.insurance_rate_bps != null) setInsuranceRateBps(q.insurance_rate_bps);
      if (q?.insurance_notes) setInsuranceNotes(q.insurance_notes);
      if (profileRes?.data?.company) setClientCompany(profileRes.data.company);
      setLoading(false);
    };
    load();
  }, [quoteId, user]);

  // Auto-default GST on/off when currency changes, unless the user has manually toggled it.
  useEffect(() => {
    if (!gstUserTouched) setGstEnabled(currency === "SGD");
  }, [currency, gstUserTouched]);

  const handleCurrencyChange = async (c: Currency) => {
    setCurrency(c);
    setCurrencyOpen(false);
    await supabase.from("trade_quotes").update({ currency: c }).eq("id", quoteId);
  };

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    await supabase.from("trade_quote_items").update({ quantity: newQty }).eq("id", itemId);
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i)));
  };

  const handleRemoveItem = async (itemId: string) => {
    await supabase.from("trade_quote_items").delete().eq("id", itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast({ title: "Item removed" });
  };

  const handleSubmit = async () => {
    await supabase.from("trade_quotes").update({
      notes: notes || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }).eq("id", quoteId);

    // Notify admin via email (fire-and-forget)
    supabase.functions.invoke("send-quote-submitted", {
      body: { quoteId },
    }).catch((err) => console.error("Quote notification email failed:", err));

    toast({ title: "Quote submitted", description: "Our team will review and respond within 1-2 business days." });
    onStatusChange();
  };

  const handleConfirmOrder = async () => {
    await supabase.from("trade_quotes").update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    } as any).eq("id", quoteId);

    // Send confirmation notification email
    supabase.functions.invoke("send-quote-confirmed", {
      body: { quoteId },
    }).catch((err) => console.error("Order confirmation email failed:", err));

    toast({ title: "Order confirmed!", description: "We'll be in touch with next steps." });
    onStatusChange();
  };

  const handleCancelOrder = async () => {
    if (!confirm("Are you sure you want to cancel this confirmed order? This action will be tracked.")) return;
    await supabase.from("trade_quotes").update({
      status: "cancelled",
    } as any).eq("id", quoteId);
    toast({ title: "Order cancelled", description: "This quote has been marked as cancelled." });
    onStatusChange();
  };

  const handleSaveNotes = async () => {
    await supabase.from("trade_quotes").update({ notes: notes || null }).eq("id", quoteId);
    toast({ title: "Notes saved" });
  };

  const handleDelete = async () => {
    await supabase.from("trade_quotes").delete().eq("id", quoteId);
    toast({ title: "Quote deleted" });
    onStatusChange();
  };

  const handleStripePayment = async (paymentType: "deposit" | "balance" = "deposit") => {
    setPayingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-quote-payment", {
        body: { quoteId, paymentType },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Payment error", description: err.message || "Could not initiate payment", variant: "destructive" });
    } finally {
      setPayingStripe(false);
    }
  };

  const subtotalCents = items.reduce((sum, item) => {
    const rawPrice = item.unit_price_cents ?? item.trade_products?.trade_price_cents ?? 0;
    // If admin set unit_price_cents, it's already in the quote's currency — skip conversion
    const prodCurrency = item.unit_price_cents != null ? currency : (item.trade_products?.currency || currency);
    const converted = convertCents(rawPrice, prodCurrency, currency) ?? 0;
    return sum + converted * item.quantity;
  }, 0);

  const handlePrint = () => window.print();

  /** Persist insurance fields. Optimistic — caller already updated local state. */
  const persistInsurance = async (patch: Partial<{ insurance_enabled: boolean; insurance_tier: InsuranceTier; insurance_rate_bps: number; insurance_notes: string | null }>) => {
    if (isReadOnly) return;
    const { error } = await supabase.from("trade_quotes").update(patch as any).eq("id", quoteId);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };

  /** Insurance premium in cents, calculated on (subtotal − trade discount). */
  const insuredBaseCents = tradeDiscount && subtotalCents > 0
    ? subtotalCents - Math.round(subtotalCents * tradeDiscountPct)
    : subtotalCents;
  const insurancePremiumCents = insuranceEnabled && insuredBaseCents > 0
    ? Math.round(insuredBaseCents * insuranceRateBps / 10000)
    : 0;

  /** Optimistic patch: update one quote-line column and persist. */
  const updateItemField = async (
    itemId: string,
    patch: Partial<Pick<QuoteItemWithProduct, "po_number" | "cost_code" | "lead_time_weeks_override" | "deposit_pct_override">>
  ) => {
    if (isReadOnly) return;
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("trade_quote_items").update(patch as any).eq("id", itemId);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };

  const parseLeadWeeks = (text: string | null): number | null => {
    if (!text) return null;
    const m = text.match(/(\d+)\s*(?:-\s*(\d+))?/);
    if (!m) return null;
    return m[2] ? parseInt(m[2], 10) : parseInt(m[1], 10);
  };

  const [exportingExcel, setExportingExcel] = useState(false);
  const handleExportExcel = async () => {
    if (!items.length) return;
    setExportingExcel(true);
    try {
      const lines: ProcurementLine[] = items.map((item, idx) => {
        const product = item.trade_products;
        const rawUnit = item.unit_price_cents ?? product?.trade_price_cents ?? null;
        const fromCur = item.unit_price_cents != null ? currency : (product?.currency || currency);
        const unitTrade = convertCents(rawUnit, fromCur, currency);
        const unitRrp = convertCents(product?.rrp_price_cents ?? null, product?.currency || currency, currency);
        const lead = item.lead_time_weeks_override ?? parseLeadWeeks(product?.lead_time || null);
        return {
          po_number: item.po_number || autoPoNumber(quoteNumber, idx + 1),
          cost_code: item.cost_code || "",
          room: clientName || "",
          item_code: product?.sku || "",
          designer: product?.brand_name || "",
          product_name: product?.product_name || "—",
          finish_or_com: [product?.dimensions, product?.materials].filter(Boolean).join(" · "),
          quantity: item.quantity,
          unit_rrp_cents: unitRrp,
          unit_trade_cents: unitTrade,
          currency,
          lead_time_weeks: lead,
          deposit_pct: item.deposit_pct_override ?? 0.6,
          status: quoteStatus,
          supplier: product?.brand_name || "",
          notes: item.notes || "",
        };
      });

      await downloadProcurementWorkbook({
        meta: {
          project_name: clientName || quoteNumber,
          client_name: clientName || "—",
          designer_studio: clientCompany || "—",
          address: "—",
          revision: "Rev 1",
          quote_refs: [quoteNumber],
        },
        lines,
        fileName: `${quoteNumber}-procurement-${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      toast({ title: "Excel export ready", description: "Procurement workbook downloaded." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message || "Unable to generate workbook.", variant: "destructive" });
    } finally {
      setExportingExcel(false);
    }
  };


  return (
    <div className="max-w-4xl">
      {/* Back + Project + Print — hidden in print */}
      <div className="flex items-center justify-between gap-3 mb-4 md:mb-6 print:hidden">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">All Quotes</span>
          <span className="sm:hidden">Back</span>
        </button>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {(isDraft || isSuperAdmin) && (
            <ProjectPicker
              value={projectId}
              onChange={async (id) => {
                setProjectId(id);
                await supabase.from("trade_quotes").update({ project_id: id } as any).eq("id", quoteId);
                toast({ title: id ? "Quote assigned to project" : "Removed from project" });
              }}
              compact
            />
          )}
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || items.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 border border-border rounded-md font-body text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Procurement-grade Excel with PO numbers, lead times, deposit schedule and cost codes"
          >
            {exportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 border border-border rounded-md font-body text-xs text-foreground hover:bg-muted transition-colors">
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print / PDF</span>
            <span className="sm:hidden">Print</span>
          </button>
        </div>
      </div>

      {/* Read-only mode banner */}
      {isReadOnly && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 md:mb-6 flex items-start gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 print:hidden"
        >
          <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-body text-xs uppercase tracking-[0.12em] text-foreground">
              Read-only mode
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1 leading-relaxed">
              {isCancelled
                ? "This quote has been cancelled and can no longer be edited."
                : isFullyPaid
                ? "This quote is fully paid and locked. Procurement fields are preserved as a record."
                : isDepositPaid
                ? "Deposit has been paid — line items, PO #, cost codes, lead times and deposit % are locked."
                : isConfirmed
                ? "This quote has been confirmed. Edits are no longer permitted to keep procurement records consistent."
                : isPriced
                ? "This quote has been priced and sent. Contact your concierge to request changes."
                : "Editing is disabled for this quote."}
            </p>
          </div>
        </div>
      )}

      {/* Quote document */}
      <div className="border border-border rounded-lg bg-background">
        {/* ===== HEADER — matches reference layout ===== */}
        <div className="border-b border-border p-4 md:p-6 lg:p-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 md:gap-10">
            {/* Left: Title + Client Name */}
            <div>
              <h1 className="font-display text-2xl md:text-3xl lg:text-4xl text-foreground tracking-wide uppercase mb-2 md:mb-3">
                Quote
              </h1>
              {isDraft ? (
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  onBlur={() => supabase.from("trade_quotes").update({ client_name: clientName } as any).eq("id", quoteId)}
                  placeholder="Client / Project Name"
                  className="font-display text-sm text-foreground uppercase tracking-wider bg-transparent border-b border-dashed border-border focus:border-foreground outline-none pb-1 w-full max-w-[300px] placeholder:text-muted-foreground/50 print:border-none text-[16px] sm:text-sm"
                />
              ) : (
                clientName && (
                  <p className="font-display text-sm text-foreground uppercase tracking-wider">
                    {clientName}
                  </p>
                )
              )}
            </div>

            {/* Middle: Date / Expiry / Number */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 md:block md:space-y-2 text-sm font-body">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Date</span>
                <span className="text-foreground">{formatDate(createdDate)}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Expiry</span>
                <span className="text-foreground">{formatDate(expiryDate)}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Quote Number</span>
                <span className="text-foreground">{quoteNumber}</span>
              </div>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${
                quoteStatus === "submitted" ? "bg-primary/10 text-primary" :
                quoteStatus === "reviewed" ? "bg-emerald-500/10 text-emerald-600" :
                "bg-muted text-muted-foreground"
              }`}>
                {quoteStatus}
              </span>
            </div>

            {/* Right: Logo + Company details */}
            <div className="flex items-start gap-3 md:gap-4">
              <img src={affluencyLogo} alt="Affluency" className="h-14 w-14 md:h-16 md:w-16 lg:h-20 lg:w-20 object-contain shrink-0" />
              <div className="text-left">
                <p className="font-display text-xs text-foreground uppercase tracking-wider">
                  Affluency Etc Pte. Ltd.
                </p>
                <p className="font-body text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  1 Grange Garden<br />
                  #16-05<br />
                  The Grange<br />
                  249631<br />
                  Singapore
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Currency selector (draft only, hidden in print) ===== */}
        {isDraft && (
          <div className="border-b border-border px-4 md:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3 md:gap-6 print:hidden">
            <div className="flex items-center gap-3">
              <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">Currency</span>
              <div className="relative">
                <button
                  onClick={() => setCurrencyOpen(!currencyOpen)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md font-body text-xs text-foreground hover:bg-muted transition-colors"
                >
                  {currencySymbol(currency)} {currency}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {currencyOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-md shadow-lg z-10 min-w-[120px]">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleCurrencyChange(c)}
                        className={`block w-full text-left px-3 py-2 font-body text-xs hover:bg-muted transition-colors ${
                          c === currency ? "text-primary font-medium" : "text-foreground"
                        }`}
                      >
                        {currencySymbol(c)} {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={() => setTradeDiscount(!tradeDiscount)}
                className="flex items-center gap-2"
              >
                <div className={`relative w-8 h-[18px] rounded-full transition-colors ${tradeDiscount ? "bg-foreground" : "bg-border"}`}>
                  <div className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-transform ${tradeDiscount ? "translate-x-[14px]" : "translate-x-[2px]"}`} />
                </div>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest" title={`${tierLabel} tier`}>{tradeDiscountLabel} Discount</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setGstUserTouched(true); setGstEnabled(!gstEnabled); }}
                  className="flex items-center gap-2"
                >
                  <div className={`relative w-8 h-[18px] rounded-full transition-colors ${gstEnabled ? "bg-foreground" : "bg-border"}`}>
                    <div className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-transform ${gstEnabled ? "translate-x-[14px]" : "translate-x-[2px]"}`} />
                  </div>
                  <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">GST</span>
                </button>
                {gstEnabled && (
                  editingGstRate ? (
                    <input
                      type="number"
                      value={gstRate}
                      onChange={(e) => setGstRate(Math.max(0, Math.min(100, Number(e.target.value))))}
                      onBlur={() => setEditingGstRate(false)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingGstRate(false)}
                      autoFocus
                      className="w-12 font-body text-[10px] text-foreground bg-transparent border-b border-foreground outline-none text-center"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingGstRate(true)}
                      className="font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      title="Click to edit tax rate"
                    >
                      ({gstRate}%)
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== Line items ===== */}
        <div className="p-4 md:p-6 lg:p-8">
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => <QuoteItemSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <Package className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-body text-sm text-muted-foreground mb-1">No items in this quote</p>
              <p className="font-body text-[10px] text-muted-foreground">
                Add products from the Trade Gallery to build your quote.
              </p>
            </div>
          ) : (
            <>
              {/* Table header */}
               <div className="hidden md:grid grid-cols-[minmax(0,1fr)_100px_120px_130px] gap-4 pb-3 border-b border-border">
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">Description</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest text-center">Qty</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest text-right">Unit Price</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest text-right">Amount {currency}</span>
              </div>

              {/* Items */}
              <div className="divide-y divide-border">
                {items.map((item) => {
                  const product = item.trade_products;
                  const rawUnitPrice = item.unit_price_cents ?? product?.trade_price_cents ?? null;
                  // unit_price_cents is already in the quote currency (admin converts before saving)
                  const prodCurrency = item.unit_price_cents != null ? currency : (product?.currency || currency);
                  const unitPrice = convertCents(rawUnitPrice, prodCurrency, currency);
                  const lineTotal = unitPrice ? unitPrice * item.quantity : null;

                  return (
                    <div key={item.id} className="py-3 md:py-4 md:grid md:grid-cols-[minmax(0,1fr)_100px_120px_130px] md:gap-4 md:items-start">
                      <div className="flex gap-3 md:gap-4 min-w-0">
                        <div className="w-14 h-14 md:w-20 md:h-20 rounded bg-muted/30 overflow-hidden shrink-0">
                          {product?.image_url ? (
                            <img src={product.image_url} alt={product.product_name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-display text-xs md:text-sm text-foreground leading-tight break-words">
                            {product?.product_name || "Unknown Product"}
                          </h4>
                          <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 truncate">
                            {product?.brand_name?.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product?.brand_name}
                          </p>
                          {product?.dimensions && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground mt-1 truncate">{product.dimensions}</p>}
                          {product?.materials && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground truncate">{product.materials}</p>}
                          {product?.lead_time && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground truncate">{product.lead_time}</p>}
                          {item.notes && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground/70 italic mt-1 truncate">{item.notes}</p>}
                          {isDraft && (
                            <button onClick={() => handleRemoveItem(item.id)} className="inline-flex items-center gap-1 font-body text-[10px] text-destructive hover:text-destructive/80 mt-1.5 md:mt-2 transition-colors">
                              <Trash2 className="h-3 w-3" /> Remove
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Mobile: qty + prices in a row */}
                      <div className="flex items-center justify-between mt-2 md:hidden">
                        <div className="flex items-center gap-1">
                          {isDraft ? (
                            <>
                              <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" disabled={item.quantity <= 1}>
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="font-body text-xs text-foreground w-6 text-center">{item.quantity}</span>
                              <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                                <Plus className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <span className="font-body text-xs text-muted-foreground">Qty: {item.quantity}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-body text-xs text-foreground font-medium">
                            {currencySymbol(currency)} {formatPriceRaw(lineTotal, currency) || "TBD"}
                          </span>
                          {item.unit_price_cents != null && product?.currency && product.currency !== currency && product.trade_price_cents && (
                            <p className="font-body text-[8px] text-muted-foreground/60 mt-0.5">
                              Catalog: {currencySymbol(product.currency)} {formatPriceRaw(product.trade_price_cents, product.currency)}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Desktop: standard columns */}
                      <div className="hidden md:flex items-center justify-center gap-1">
                        {isDraft ? (
                          <>
                            <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" disabled={item.quantity <= 1}>
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="font-body text-sm text-foreground w-8 text-center">{item.quantity}</span>
                            <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                              <Plus className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <span className="font-body text-sm text-foreground">{item.quantity}</span>
                        )}
                      </div>
                      <div className="hidden md:block text-right">
                        <span className="font-body text-sm text-foreground tabular-nums">
                          {unitPrice ? `${currencySymbol(currency)} ${formatPriceRaw(unitPrice, currency)}` : "TBD"}
                        </span>
                        {item.unit_price_cents != null && product?.currency && product.currency !== currency && product.trade_price_cents && (
                          <p className="font-body text-[9px] text-muted-foreground/60">
                            Catalog: {currencySymbol(product.currency)} {formatPriceRaw(product.trade_price_cents, product.currency)}
                          </p>
                        )}
                      </div>
                      <div className="hidden md:block text-right">
                        <span className="font-body text-sm text-foreground font-medium tabular-nums">
                          {lineTotal ? `${currencySymbol(currency)} ${formatPriceRaw(lineTotal, currency)}` : "TBD"}
                        </span>
                      </div>

                      {/* Procurement metadata — editable on draft/priced quotes, read-only otherwise */}
                      <div className="md:col-span-4 mt-2 md:mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 print:hidden">
                        <label className="flex flex-col gap-0.5">
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">PO #</span>
                          <input
                            type="text"
                            defaultValue={item.po_number || ""}
                            placeholder={`${quoteNumber}-auto`}
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            tabIndex={isReadOnly ? -1 : 0}
                            aria-disabled={isReadOnly}
                            onBlur={(e) => {
                              if (isReadOnly) return;
                              const v = e.target.value.trim();
                              if (v !== (item.po_number || "")) updateItemField(item.id, { po_number: v || null });
                            }}
                            className="font-body text-[11px] text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">Cost Code</span>
                          <input
                            type="text"
                            defaultValue={item.cost_code || ""}
                            placeholder="e.g. FF-LIV-001"
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            tabIndex={isReadOnly ? -1 : 0}
                            aria-disabled={isReadOnly}
                            onBlur={(e) => {
                              if (isReadOnly) return;
                              const v = e.target.value.trim();
                              if (v !== (item.cost_code || "")) updateItemField(item.id, { cost_code: v || null });
                            }}
                            className="font-body text-[11px] text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">Lead (wks)</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={item.lead_time_weeks_override ?? ""}
                            placeholder={parseLeadWeeks(product?.lead_time || null)?.toString() ?? "—"}
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            tabIndex={isReadOnly ? -1 : 0}
                            aria-disabled={isReadOnly}
                            onBlur={(e) => {
                              if (isReadOnly) return;
                              const raw = e.target.value.trim();
                              const v = raw === "" ? null : parseInt(raw, 10);
                              if (v !== item.lead_time_weeks_override) updateItemField(item.id, { lead_time_weeks_override: v });
                            }}
                            className="font-body text-[11px] text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none tabular-nums"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">Deposit %</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            defaultValue={item.deposit_pct_override != null ? Math.round(item.deposit_pct_override * 100) : ""}
                            placeholder="60"
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            tabIndex={isReadOnly ? -1 : 0}
                            aria-disabled={isReadOnly}
                            onBlur={(e) => {
                              if (isReadOnly) return;
                              const raw = e.target.value.trim();
                              const v = raw === "" ? null : Math.max(0, Math.min(100, parseInt(raw, 10))) / 100;
                              if (v !== item.deposit_pct_override) updateItemField(item.id, { deposit_pct_override: v });
                            }}
                            className="font-body text-[11px] text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none tabular-nums"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Insurance bundling */}
              <div className="border-t border-border mt-2 pt-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-display text-xs uppercase tracking-[0.15em] text-foreground">Coverage & Insurance</div>
                    <div className="font-body text-[11px] text-muted-foreground mt-0.5">
                      Bundle transit & all-risk coverage with this quote. Premium is calculated on net value after trade discount.
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={insuranceEnabled}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setInsuranceEnabled(next);
                        persistInsurance({ insurance_enabled: next });
                      }}
                      className="h-4 w-4 accent-foreground"
                    />
                    <span className="font-body text-xs text-foreground">Include</span>
                  </label>
                </div>

                {insuranceEnabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {INSURANCE_TIERS.map((opt) => {
                        const active = insuranceTier === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => {
                              setInsuranceTier(opt.value);
                              setInsuranceRateBps(opt.rateBps);
                              persistInsurance({ insurance_tier: opt.value, insurance_rate_bps: opt.rateBps });
                            }}
                            className={`text-left rounded-md border px-3 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                              active
                                ? "border-foreground bg-foreground/5"
                                : "border-border hover:border-foreground/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display text-[11px] uppercase tracking-wider text-foreground">{opt.label}</span>
                              <span className="font-body text-[11px] tabular-nums text-foreground/80">{(opt.rateBps / 100).toFixed(2)}%</span>
                            </div>
                            <div className="font-body text-[10px] text-muted-foreground mt-1 leading-snug">{opt.description}</div>
                          </button>
                        );
                      })}
                    </div>
                    {!isReadOnly ? (
                      <textarea
                        value={insuranceNotes}
                        onChange={(e) => setInsuranceNotes(e.target.value)}
                        onBlur={() => persistInsurance({ insurance_notes: insuranceNotes || null })}
                        placeholder="Coverage notes — declared value, certificate holder, named insured, installation site…"
                        rows={2}
                        className="w-full px-3 py-2 bg-background border border-border rounded-md font-body text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none transition-colors"
                      />
                    ) : insuranceNotes ? (
                      <p className="font-body text-[11px] text-muted-foreground italic">Coverage notes: {insuranceNotes}</p>
                    ) : null}
                    <p className="font-body text-[10px] text-muted-foreground/80 leading-relaxed">
                      Indicative premiums underwritten by Maison Affluency partner brokers. Final certificate issued upon order confirmation.
                    </p>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="border-t border-border mt-2 pt-4">
                <div className="flex justify-end">
                  <div className="w-72 space-y-1">
                    <div className="flex justify-between font-body text-xs text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatPriceRaw(subtotalCents, currency) || "TBD"}</span>
                    </div>
                    {tradeDiscount && subtotalCents > 0 && (
                      <div className="flex justify-between font-body text-xs text-muted-foreground">
                        <span>Trade Discount ({tradeDiscountLabel})</span>
                        <span>-{formatPriceRaw(Math.round(subtotalCents * tradeDiscountPct), currency)}</span>
                      </div>
                    )}
                    {insuranceEnabled && insurancePremiumCents > 0 && (
                      <div className="flex justify-between font-body text-xs text-muted-foreground">
                        <span>
                          Insurance ({INSURANCE_TIERS.find((t) => t.value === insuranceTier)?.label} · {(insuranceRateBps / 100).toFixed(2)}%)
                        </span>
                        <span>{formatPriceRaw(insurancePremiumCents, currency)}</span>
                      </div>
                    )}
                    {gstEnabled && subtotalCents > 0 && (() => {
                      const afterDiscount = tradeDiscount ? subtotalCents - Math.round(subtotalCents * tradeDiscountPct) : subtotalCents;
                      const taxable = afterDiscount + insurancePremiumCents;
                      return (
                        <div className="flex justify-between font-body text-xs text-muted-foreground">
                          <span>GST ({gstRate}%)</span>
                          <span>{formatPriceRaw(Math.round(taxable * gstRate / 100), currency)}</span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const afterDiscount = tradeDiscount && subtotalCents > 0 ? subtotalCents - Math.round(subtotalCents * tradeDiscountPct) : subtotalCents;
                      const taxable = afterDiscount + insurancePremiumCents;
                      const total = gstEnabled && taxable > 0
                        ? taxable + Math.round(taxable * gstRate / 100)
                        : taxable;
                      const depositCents = Math.round(total * 0.6);
                      const balanceCents = total - depositCents;
                      return (
                        <>
                          <div className="flex justify-between font-display text-sm text-foreground pt-2 border-t border-border">
                            <span className="uppercase tracking-wider">Total {currency}</span>
                            <span className="font-medium">
                              {currencySymbol(currency)}{" "}
                              {formatPriceRaw(total, currency) || "TBD"}
                            </span>
                          </div>

                          {/* 60/40 deposit/balance breakdown — shown when priced or later */}
                          {(isPriced || isConfirmed) && total > 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed border-border space-y-1.5">
                              <div className="flex justify-between font-body text-xs">
                                <span className={isDepositPaid || isFullyPaid ? "text-emerald-600" : "text-foreground/80"}>
                                  {isDepositPaid || isFullyPaid ? "✓ " : ""}60% Deposit
                                </span>
                                <span className={isDepositPaid || isFullyPaid ? "text-emerald-600 font-medium" : "text-foreground/80"}>
                                  {currencySymbol(currency)} {formatPriceRaw(depositCents, currency)}
                                </span>
                              </div>
                              <div className="flex justify-between font-body text-xs">
                                <span className={isFullyPaid ? "text-emerald-600" : "text-muted-foreground"}>
                                  {isFullyPaid ? "✓ " : ""}40% Balance
                                </span>
                                <span className={isFullyPaid ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                                  {currencySymbol(currency)} {formatPriceRaw(balanceCents, currency)}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notes */}
        <div className="border-t border-border p-4 md:p-6 lg:p-8">
          <label className="font-body text-[10px] text-muted-foreground uppercase tracking-widest block mb-2">
            Notes / Special Instructions
          </label>
          {isDraft ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any special requirements…"
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none transition-colors text-[16px] sm:text-sm"
              />
              <button onClick={handleSaveNotes} className="font-body text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors">
                Save Notes
              </button>
            </div>
          ) : (
            <p className="font-body text-sm text-muted-foreground italic">{notes || "No notes"}</p>
          )}
        </div>

        {/* Payment Terms & Banking Details */}
        <div className="border-t border-border p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6">
          <div>
            <h3 className="font-display text-xs uppercase tracking-[0.15em] text-foreground mb-3">Payment Terms</h3>
            <ul className="font-body text-[10px] md:text-[11px] leading-relaxed text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>60% payment upon order confirmation unless indicated otherwise</li>
              <li>Payment by bank transfer</li>
              <li>Balance of Payment ex-work prior to shipping</li>
            </ul>
          </div>

          <div>
            <p className="font-body text-[10px] md:text-[11px] text-muted-foreground mb-2">Payment by bank transfer to:</p>
            <div className="font-body text-[10px] md:text-[11px] leading-relaxed text-foreground/80 space-y-0.5">
              <p className="font-medium text-foreground">AFFLUENCY ETC PTE. LTD.</p>
              {currency === "SGD" ? (
                <>
                  <p>Account Number: 713127249001</p>
                  <p>Bank: OCBC Bank</p>
                  <p>Oversea-Chinese Banking Corporation Ltd</p>
                  <p>BIC/SWIFT: OCBCSGSG</p>
                  <p>Bank Code: 7339 · Branch Code: 713</p>
                </>
              ) : currency === "EUR" ? (
                <>
                  <p className="font-medium text-foreground/60 text-[9px] uppercase tracking-widest mt-1">SEPA (EEA transfers)</p>
                  <p>IBAN: LT73 3250 0692 1856 8740</p>
                  <p>BIC: REVOLT21</p>
                  <p>Bank: Revolut Bank UAB</p>
                  <p>Konstitucijos ave. 21B, 08130, Vilnius, Lithuania</p>
                  <p className="font-medium text-foreground/60 text-[9px] uppercase tracking-widest mt-2">SWIFT (International)</p>
                  <p>Account Number: 885111609218375</p>
                  <p>SWIFT/BIC: REVOSGS2</p>
                  <p>Intermediary BIC: BARCDEFF</p>
                  <p>Bank: Revolut Technologies Singapore Pte. Ltd</p>
                  <p>6 Battery Road, Floor 6-01, 049909, Singapore</p>
                </>
              ) : currency === "USD" ? (
                <>
                  <p>Account Number: 885111609218375</p>
                  <p>SWIFT/BIC: REVOSGS2</p>
                  <p>Intermediary BIC: BARCGB22</p>
                  <p>Bank: Revolut Technologies Singapore Pte. Ltd</p>
                  <p>6 Battery Road, Floor 6-01, 049909, Singapore</p>
                </>
              ) : (
                <>
                  <p>Account Number: 885111609218375</p>
                  <p>SWIFT/BIC: REVOSGS2</p>
                  <p>Intermediary BIC: BARCGB22</p>
                  <p>Bank: Revolut Technologies Singapore Pte. Ltd</p>
                  <p>6 Battery Road, Floor 6-01, 049909, Singapore</p>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-display text-xs uppercase tracking-[0.15em] text-foreground mb-2">Terms &amp; Conditions</h3>
            <p className="font-body text-[10px] md:text-[11px] text-muted-foreground leading-relaxed">
              The terms and conditions will be given separately and shall apply to the quotation given for the supply of any items detailed herein. Please read carefully.
            </p>
          </div>
        </div>

        {/* Admin notes (shown when priced/confirmed) */}
        {adminNotes && (isPriced || isConfirmed) && (
          <div className="border-t border-border p-4 md:p-6 lg:p-8">
            <label className="font-body text-[10px] text-muted-foreground uppercase tracking-widest block mb-2">Notes from Maison Affluency</label>
            <p className="font-body text-sm text-foreground/80 italic whitespace-pre-wrap">"{adminNotes}"</p>
          </div>
        )}

        {/* Actions — hidden in print */}
        {isDraft && (
          <div className="border-t border-border p-4 md:p-6 lg:p-8 flex items-center justify-between print:hidden">
            <button onClick={handleDelete} className="inline-flex items-center gap-1.5 font-body text-[10px] text-destructive hover:text-destructive/80 uppercase tracking-wider transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Delete Quote</span><span className="sm:hidden">Delete</span>
            </button>
            <button onClick={handleSubmit} disabled={items.length === 0} className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-40">
              <Send className="h-3.5 w-3.5" /> Submit
            </button>
          </div>
        )}

        {/* Revise Quote — shown for submitted or priced quotes */}
        {(quoteStatus === "submitted" || quoteStatus === "priced") && (
          <div className="border-t border-border p-4 md:p-6 lg:p-8 flex items-center justify-between print:hidden">
            <p className="font-body text-[10px] text-muted-foreground max-w-xs">
              Need to make changes? Revise will reopen the quote as a draft so you can add or remove items, then resubmit.
            </p>
            <button
              onClick={async () => {
                await supabase.from("trade_quotes").update({
                  status: "draft",
                  submitted_at: null,
                  responded_at: null,
                } as any).eq("id", quoteId);
                toast({ title: "Quote reopened", description: "You can now edit items and resubmit." });
                onStatusChange();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 border border-border font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-muted transition-colors text-foreground"
            >
              <Edit3 className="h-3.5 w-3.5" /> Revise Quote
            </button>
          </div>
        )}

        {isPriced && (
          <div className="border-t border-border p-4 md:p-6 lg:p-8 flex items-center justify-end print:hidden">
            <button
              onClick={handleConfirmOrder}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Confirm Order
            </button>
          </div>
        )}

        {isConfirmed && !isFullyPaid && (() => {
          const afterDiscount = tradeDiscount && subtotalCents > 0 ? subtotalCents - Math.round(subtotalCents * tradeDiscountPct) : subtotalCents;
          const withGst = gstEnabled && afterDiscount > 0
            ? afterDiscount + Math.round(afterDiscount * gstRate / 100)
            : afterDiscount;

          const isPayingDeposit = quoteStatus === "confirmed";
          const isPayingBalance = quoteStatus === "deposit_paid";
          const portionCents = isPayingDeposit ? Math.round(withGst * 0.6) : Math.round(withGst * 0.4);
          const fixedFees: Record<string, number> = { SGD: 50, USD: 30, EUR: 25, GBP: 20 };
          const fixedFee = fixedFees[currency] ?? 50;
          const chargeTotal = Math.ceil((portionCents + fixedFee) / (1 - 0.034));
          const feeDisplay = currency === "SGD" ? "S$0.50" : currency === "USD" ? "US$0.30" : currency === "EUR" ? "€0.25" : currency === "GBP" ? "£0.20" : "0.50";
          const paymentLabel = isPayingDeposit ? "Pay 60% Deposit" : "Pay 40% Balance";
          const paymentType = isPayingDeposit ? "deposit" : "balance";

          return (
            <div className="border-t border-border p-4 md:p-6 lg:p-8 print:hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-body text-sm text-emerald-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{isPayingBalance ? "Deposit paid — balance due" : "Order confirmed"}</span>
                  </div>
                  {isPayingBalance && (
                    <p className="font-body text-[10px] text-muted-foreground">
                      60% deposit received. Please pay the remaining 40% balance to complete your order.
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => handleStripePayment(paymentType)}
                    disabled={payingStripe}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    {payingStripe ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                    {payingStripe ? "Redirecting…" : paymentLabel}
                  </button>
                  {subtotalCents > 0 && (
                    <span className="font-body text-[10px] text-muted-foreground">
                      Stripe charge: {currencySymbol(currency)}{formatPriceRaw(chargeTotal, currency)} {currency} (incl.{gstEnabled ? ` ${gstRate}% GST +` : ""} processing fee)
                    </span>
                  )}
                </div>
              </div>

              {subtotalCents > 0 && (
                <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3 space-y-1.5">
                  <p className="font-body text-[11px] text-foreground/80 font-medium">Payment Information</p>
                  <ul className="font-body text-[10px] text-muted-foreground space-y-1 list-disc list-inside">
                    <li>You are paying the <span className="font-medium text-foreground/70">{isPayingDeposit ? "60% deposit" : "40% balance"}</span> of {currencySymbol(currency)}{formatPriceRaw(portionCents, currency)} {currency}.</li>
                    <li>A processing fee of 3.4% + {feeDisplay} is included in the Stripe charge above.</li>
                    {gstEnabled && <li>{gstRate}% GST is included.</li>}
                    <li>
                      If your card is denominated in a different currency, your bank may apply a foreign transaction fee of approximately <span className="font-medium text-foreground/70">1–2%</span>.
                    </li>
                  </ul>
                </div>
              )}

              <p className="font-body text-[10px] text-muted-foreground mt-3">
                Or pay via bank transfer using the details above to avoid card processing fees.
              </p>
            </div>
          );
        })()}

        {isFullyPaid && (
          <div className="border-t border-border p-4 md:p-6 lg:p-8 print:hidden">
            <div className="flex items-center gap-2 font-body text-sm text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              <span>Fully paid</span>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="border-t border-border p-4 md:p-6 lg:p-8 print:hidden">
            <div className="flex items-center gap-2 font-body text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              <span>This order has been cancelled</span>
            </div>
          </div>
        )}

        {/* Admin cancel button for confirmed/deposit_paid quotes */}
        {isSuperAdmin && isConfirmed && !isFullyPaid && !isCancelled && (
          <div className="border-t border-border p-4 md:p-6 lg:p-8 print:hidden">
            <button
              onClick={handleCancelOrder}
              className="inline-flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive font-body text-[10px] uppercase tracking-[0.1em] rounded-md hover:bg-destructive/10 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel Order
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteDetail;
