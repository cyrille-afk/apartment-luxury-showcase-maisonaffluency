import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Trash2, Plus, Minus, Package, Printer, ChevronDown, CheckCircle, CreditCard, Loader2, Edit3 } from "lucide-react";
import { QuoteItemSkeleton } from "@/components/trade/skeletons";
import affluencyLogo from "@/assets/affluency-logo-square.jpg";

const CURRENCIES = ["SGD", "USD", "EUR", "GBP"] as const;
type Currency = (typeof CURRENCIES)[number];

interface QuoteItemWithProduct {
  id: string;
  quote_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number | null;
  notes: string | null;
  trade_products: {
    product_name: string;
    brand_name: string;
    trade_price_cents: number | null;
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
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [payingStripe, setPayingStripe] = useState(false);

  const quoteNumber = `QU-${quoteId.slice(0, 6).toUpperCase()}`;
  const isDraft = quoteStatus === "draft";
  const isPriced = quoteStatus === "priced";
  const isConfirmed = quoteStatus === "confirmed" || quoteStatus === "deposit_paid" || quoteStatus === "paid";
  const isDepositPaid = quoteStatus === "deposit_paid";
  const isFullyPaid = quoteStatus === "paid";
  const isReadOnly = !isDraft;

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
          .select("*, trade_products(product_name, brand_name, trade_price_cents, currency, image_url, dimensions, materials, lead_time, sku)")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: true }),
        supabase.from("trade_quotes").select("currency, client_name, admin_notes").eq("id", quoteId).single(),
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
      if (profileRes?.data?.company) setClientCompany(profileRes.data.company);
      setLoading(false);
    };
    load();
  }, [quoteId, user]);

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
    const prodCurrency = item.trade_products?.currency || currency;
    const converted = convertCents(rawPrice, prodCurrency, currency) ?? 0;
    return sum + converted * item.quantity;
  }, 0);

  const handlePrint = () => window.print();

  return (
    <div className="max-w-4xl">
      {/* Back + Print — hidden in print */}
      <div className="flex items-center justify-between mb-4 md:mb-6 print:hidden">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">All Quotes</span>
          <span className="sm:hidden">Back</span>
        </button>
        <button onClick={handlePrint} className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 border border-border rounded-md font-body text-xs text-foreground hover:bg-muted transition-colors">
          <Printer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Print / PDF</span>
          <span className="sm:hidden">Print</span>
        </button>
      </div>

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

            <button
              onClick={() => setTradeDiscount(!tradeDiscount)}
              className="flex items-center gap-2"
            >
              <div className={`relative w-8 h-[18px] rounded-full transition-colors ${tradeDiscount ? "bg-foreground" : "bg-border"}`}>
                <div className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-transform ${tradeDiscount ? "translate-x-[14px]" : "translate-x-[2px]"}`} />
              </div>
              <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">8% Discount</span>
            </button>
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
              <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px] gap-4 pb-3 border-b border-border">
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
                  const prodCurrency = product?.currency || currency;
                  const unitPrice = convertCents(rawUnitPrice, prodCurrency, currency);
                  const lineTotal = unitPrice ? unitPrice * item.quantity : null;

                  return (
                    <div key={item.id} className="py-3 md:py-4 md:grid md:grid-cols-[1fr_80px_100px_100px] md:gap-4 md:items-start">
                      <div className="flex gap-3 md:gap-4">
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
                          <h4 className="font-display text-xs md:text-sm text-foreground leading-tight">
                            {product?.product_name || "Unknown Product"}
                          </h4>
                          <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                            {product?.brand_name?.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product?.brand_name}
                          </p>
                          {product?.dimensions && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground mt-1 truncate">{product.dimensions}</p>}
                          {product?.materials && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground truncate">{product.materials}</p>}
                          {product?.lead_time && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground">{product.lead_time}</p>}
                          {item.notes && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground/70 italic mt-1">{item.notes}</p>}
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
                        <span className="font-body text-sm text-foreground">{formatPriceRaw(unitPrice, currency) || "TBD"}</span>
                      </div>
                      <div className="hidden md:block text-right">
                        <span className="font-body text-sm text-foreground font-medium">{formatPriceRaw(lineTotal, currency) || "TBD"}</span>
                      </div>
                    </div>
                  );
                })}
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
                        <span>Trade Discount (8%)</span>
                        <span>-{formatPriceRaw(Math.round(subtotalCents * 0.08), currency)}</span>
                      </div>
                    )}
                    {currency === "SGD" && subtotalCents > 0 && (() => {
                      const afterDiscount = tradeDiscount ? subtotalCents - Math.round(subtotalCents * 0.08) : subtotalCents;
                      return (
                        <div className="flex justify-between font-body text-xs text-muted-foreground">
                          <span>GST (9%)</span>
                          <span>{formatPriceRaw(Math.round(afterDiscount * 0.09), currency)}</span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const afterDiscount = tradeDiscount && subtotalCents > 0 ? subtotalCents - Math.round(subtotalCents * 0.08) : subtotalCents;
                      const total = currency === "SGD" && afterDiscount > 0
                        ? afterDiscount + Math.round(afterDiscount * 0.09)
                        : afterDiscount;
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

        {isConfirmed && (() => {
          // Calculate total in quote's own currency (what Stripe will charge)
          const afterDiscount = tradeDiscount && subtotalCents > 0 ? subtotalCents - Math.round(subtotalCents * 0.08) : subtotalCents;
          const withGst = currency === "SGD" && afterDiscount > 0
            ? afterDiscount + Math.round(afterDiscount * 0.09)
            : afterDiscount;
          // Stripe fee pass-through with currency-appropriate fixed fee
          const fixedFees: Record<string, number> = { SGD: 50, USD: 30, EUR: 25, GBP: 20 };
          const fixedFee = fixedFees[currency] ?? 50;
          const chargeTotal = Math.ceil((withGst + fixedFee) / (1 - 0.034));
          const feeDisplay = currency === "SGD" ? "S$0.50" : currency === "USD" ? "US$0.30" : currency === "EUR" ? "€0.25" : currency === "GBP" ? "£0.20" : "0.50";

          return (
            <div className="border-t border-border p-4 md:p-6 lg:p-8 print:hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 font-body text-sm text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Order confirmed</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={handleStripePayment}
                    disabled={payingStripe}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    {payingStripe ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                    {payingStripe ? "Redirecting…" : "Pay with Stripe"}
                  </button>
                  {subtotalCents > 0 && (
                    <span className="font-body text-[10px] text-muted-foreground">
                      Stripe charge: {currencySymbol(currency)}{formatPriceRaw(chargeTotal, currency)} {currency} (incl.{currency === "SGD" ? " GST +" : ""} processing fee)
                    </span>
                  )}
                </div>
              </div>

              {/* Payment info notice */}
              {subtotalCents > 0 && (
                <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3 space-y-1.5">
                  <p className="font-body text-[11px] text-foreground/80 font-medium">Payment Information</p>
                  <ul className="font-body text-[10px] text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Payment will be charged in <span className="font-medium text-foreground/70">{currency}</span> — the same currency shown on your quote.</li>
                    <li>A processing fee of 3.4% + {feeDisplay} is included in the total above.</li>
                    {currency === "SGD" && <li>9% GST is included for SGD payments.</li>}
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
      </div>
    </div>
  );
};

export default QuoteDetail;
