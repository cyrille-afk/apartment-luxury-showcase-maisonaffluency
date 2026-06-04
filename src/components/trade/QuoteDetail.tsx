import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Trash2, Plus, Minus, Package, Printer, ChevronDown, CheckCircle, CreditCard, Loader2, Edit3, XCircle, FileSpreadsheet, Lock, FolderOpen, Layers, Eye, ExternalLink, Mail, History as HistoryIcon, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";
import { QuoteItemSkeleton } from "@/components/trade/skeletons";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import ClientPicker from "@/components/trade/ClientPicker";
import AlphabetProductPicker, { type PickerItem } from "@/components/trade/AlphabetProductPicker";
import affluencyLogo from "@/assets/affluency-quote-logo.jpg";
import { downloadProcurementWorkbook, autoPoNumber, type ProcurementLine } from "@/lib/procurementExcel";
import { downloadQuotePdf, previewQuotePdfUrl, type QuotePdfLine } from "@/lib/quotePdf";
import { UkLandedCostPanel } from "@/components/trade/UkLandedCostPanel";
import { HkLandedCostPanel } from "@/components/trade/HkLandedCostPanel";
import QuoteExtrasEditor from "@/components/trade/QuoteExtrasEditor";
import { DEFAULT_HKD_LANDED_CBM, HKD_LANDED_KG_PER_CBM, useHkdLandedCost, type HkMode } from "@/hooks/useHkdLandedCost";
import { QuoteDisplayCurrencyToggle } from "@/components/trade/QuoteDisplayCurrencyToggle";
import { DEFAULT_GBP_LANDED_CBM, GBP_LANDED_KG_PER_CBM, useGbpLandedCost, fmtGbp, fetchFx, FX_BUFFER } from "@/hooks/useGbpLandedCost";
import { usePerLineShipping } from "@/hooks/usePerLineShipping";
import { toIsoCountry, computePerLineShipments } from "@/lib/perLineShipping";
import { labelForMode } from "@/lib/shippingEstimator";

import { PerOriginShippingRecap } from "@/components/trade/PerOriginShippingRecap";
import { priceRugVariantFromLabel } from "@/lib/rugPricing";

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
  variant_label: string | null;
  room: string | null;
  // Per-line shipping (multi-origin support)
  ship_origin_country: string | null;
  ship_mode: string | null;
  ship_cbm: number | null;
  ship_weight_kg: number | null;
  trade_products: {
    product_name: string;
    brand_name: string;
    trade_price_cents: number | null;
    rrp_price_cents?: number | null;
    price_per_sqm_cents?: number | null;
    price_unit?: string | null;
    currency: string;
    image_url: string | null;
    dimensions: string | null;
    materials: string | null;
    lead_time: string | null;
    sku: string | null;
    origin: string | null;
  } | null;
  /** Enriched at load time from designer_curator_picks (limited-edition / edition note). */
  edition?: string | null;
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

const catalogSourcePriceCents = (item: QuoteItemWithProduct) => {
  const product = item.trade_products;
  if (!product) return null;
  if (product.price_unit === "per_sqm" && product.price_per_sqm_cents) {
    return priceRugVariantFromLabel(item.variant_label || product.dimensions, product.price_per_sqm_cents);
  }
  return product.trade_price_cents;
};

const QuotePdfPreviewPages = ({ blobUrl }: { blobUrl: string | null }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const renderTokenRef = useRef(0);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!blobUrl) {
      if (hostRef.current) hostRef.current.innerHTML = "";
      setRendering(false);
      setRenderError(false);
      return;
    }

    let cancelled = false;
    const token = renderTokenRef.current + 1;
    renderTokenRef.current = token;

    const renderPages = async () => {
      const host = hostRef.current;
      if (!host) return;
      host.innerHTML = "";
      setRendering(true);
      setRenderError(false);

      try {
        const pdfjsLib = await import("pdfjs-dist");
        try {
          const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
          pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }

        const pdf = await pdfjsLib.getDocument({ url: blobUrl }).promise;
        if (cancelled || renderTokenRef.current !== token) return;

        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
          const page = await pdf.getPage(pageNo);
          if (cancelled || renderTokenRef.current !== token) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const availableWidth = Math.min(980, Math.max(320, host.clientWidth - 48));
          const scale = Math.max(1, Math.min(2.1, availableWidth / baseViewport.width));
          const viewport = page.getViewport({ scale });

          const wrapper = document.createElement("section");
          wrapper.className = "flex flex-col items-center gap-2";

          const label = document.createElement("div");
          label.className = "font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground";
          label.textContent = `Page ${pageNo} / ${pdf.numPages}`;

          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "block max-w-full h-auto bg-background shadow-[0_14px_42px_rgba(0,0,0,0.18)]";

          wrapper.appendChild(label);
          wrapper.appendChild(canvas);
          host.appendChild(wrapper);

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context unavailable");
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (error) {
        console.error("[QuotePdfPreviewPages] render failed", error);
        if (!cancelled) setRenderError(true);
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    void renderPages();
    return () => {
      cancelled = true;
    };
  }, [blobUrl]);

  return (
    <div className="relative flex-1 overflow-y-auto bg-muted/20">
      {(!blobUrl || rendering) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <DotCircleLoader size="sm" />
          <p className="font-body text-xs">{blobUrl ? "Rendering pages…" : "Generating PDF…"}</p>
        </div>
      )}
      {renderError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center font-body text-xs text-muted-foreground">
          Preview could not render here. Use Download to open the PDF.
        </div>
      )}
      <div ref={hostRef} className="flex flex-col items-center gap-8 px-4 py-8" />
    </div>
  );
};

const QuoteDetail = ({ quoteId, quoteStatus, quoteCreatedAt, quoteNotes, onBack, onStatusChange }: QuoteDetailProps) => {
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { discountPct: tradeDiscountPct, discountLabel: tradeDiscountLabel, tierLabel, tier: currentTier, config: tierConfig } = useTradeDiscount();
  const [items, setItems] = useState<QuoteItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState(quoteNotes || "");
  const [adminNotes, setAdminNotes] = useState("");
  const [currency, setCurrency] = useState<Currency>("SGD");
  const [clientCompany, setClientCompany] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientApproval, setClientApproval] = useState<{ approved: boolean; email: string | null; status: string | null }>({ approved: false, email: null, status: null });
  const [emailLog, setEmailLog] = useState<Array<{ id: string; recipient_email: string; sent_by_email: string | null; created_at: string; note: string | null }>>([]);
  const [emailLogOpen, setEmailLogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [tradeDiscount, setTradeDiscount] = useState(true);
  // GST defaults to ON only for SGD quotes; other currencies (EUR/USD/GBP) default OFF.
  // The user can still toggle it on manually if needed.
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstUserTouched, setGstUserTouched] = useState(false);
  /** Display the totals block in the quote currency or in GBP DDP landed cost. */
  const [displayCcy, setDisplayCcy] = useState<"quote" | "gbp">("quote");
  const [gstRate, setGstRate] = useState(9);
  const [editingGstRate, setEditingGstRate] = useState(false);
  const [payingStripe, setPayingStripe] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  // Ship-to / Incoterm (separate from Bill-to/Client)
  const INCOTERMS = ["EXW", "FCA", "FOB", "CIF", "CIP", "DAP", "DDP", "DPU"] as const;
  type Incoterm = (typeof INCOTERMS)[number];
  const [shipToSameAsBill, setShipToSameAsBill] = useState(true);
  const [incoterm, setIncoterm] = useState<Incoterm | "">("");
  const [shipTo, setShipTo] = useState({
    name: "", attention: "", address1: "", address2: "",
    city: "", state: "", postal_code: "", country: "",
    phone: "", email: "", notes: "",
  });
  const [shipToOpen, setShipToOpen] = useState(false);
  // Add-product picker state
  const [productOptions, setProductOptions] = useState<PickerItem[]>([]);
  const [pendingProductId, setPendingProductId] = useState<string>("");
  const [addingProduct, setAddingProduct] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [issueDate, setIssueDate] = useState<string | null>(null);
  const [landedCostSettings, setLandedCostSettings] = useState<{ cbm: number; kg: number; mode: "road" | "courier" }>(() => ({
    cbm: DEFAULT_GBP_LANDED_CBM,
    kg: Math.round(DEFAULT_GBP_LANDED_CBM * GBP_LANDED_KG_PER_CBM.road),
    mode: "road",
  }));
  const [hkLandedSettings, setHkLandedSettings] = useState<{ cbm: number; kg: number; mode: HkMode }>(() => ({
    cbm: DEFAULT_HKD_LANDED_CBM,
    kg: Math.round(DEFAULT_HKD_LANDED_CBM * HKD_LANDED_KG_PER_CBM.sea_lcl),
    mode: "sea_lcl",
  }));

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
  /** Sum of all rows in `trade_quote_extras` for this quote, in quote currency (cents). */
  const [extrasTotalCents, setExtrasTotalCents] = useState<number>(0);
  const [insuranceNotes, setInsuranceNotes] = useState("");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [respondedAt, setRespondedAt] = useState<string | null>(null);
  const [confirmedAtTs, setConfirmedAtTs] = useState<string | null>(null);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseReason, setReviseReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const quoteNumber = `QU-${quoteId.slice(0, 6).toUpperCase()}`;
  const isDraft = quoteStatus === "draft";
  const isPriced = quoteStatus === "priced";
  const isCancelled = quoteStatus === "cancelled";
  const isConfirmed = quoteStatus === "confirmed" || quoteStatus === "deposit_paid" || quoteStatus === "paid";
  const isDepositPaid = quoteStatus === "deposit_paid";
  const isFullyPaid = quoteStatus === "paid";
  const isReadOnly = !isDraft && !isSuperAdmin;
  // Admins can edit line items at any status (remove, change qty) without first reopening as draft.
  const canEditLines = isDraft || isSuperAdmin;

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    draft:        { label: "Draft",        cls: "bg-muted text-muted-foreground" },
    submitted:    { label: "Submitted",    cls: "bg-primary/10 text-primary" },
    reviewed:     { label: "Reviewed",     cls: "bg-emerald-500/10 text-emerald-600" },
    priced:       { label: "Priced",       cls: "bg-amber-500/10 text-amber-600" },
    confirmed:    { label: "Confirmed",    cls: "bg-blue-500/10 text-blue-600" },
    deposit_paid: { label: "Deposit Paid", cls: "bg-emerald-500/10 text-emerald-600" },
    paid:         { label: "Fully Paid",   cls: "bg-emerald-600 text-white" },
    cancelled:    { label: "Cancelled",    cls: "bg-destructive/10 text-destructive" },
  };
  const StatusBadge = ({ className = "" }: { className?: string }) => {
    const s = STATUS_BADGE[quoteStatus] ?? { label: quoteStatus, cls: "bg-muted text-muted-foreground" };
    return (
      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-body uppercase tracking-wider ${s.cls} ${className}`}>
        {s.label}
      </span>
    );
  };

  const createdDate = issueDate ? new Date(`${issueDate}T00:00:00`) : new Date(quoteCreatedAt);
  const expiryDate = new Date(createdDate);
  expiryDate.setMonth(expiryDate.getMonth() + 1);

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
          .select("*, trade_products(product_name, brand_name, trade_price_cents, rrp_price_cents, price_per_sqm_cents, price_unit, currency, image_url, dimensions, materials, lead_time, sku, origin, stock_status_override, lead_weeks_min_override, lead_weeks_max_override)")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: true }),
        supabase.from("trade_quotes").select("currency, client_name, client_id, admin_notes, project_id, insurance_enabled, insurance_tier, insurance_rate_bps, insurance_notes, issue_date, submitted_at, responded_at, confirmed_at, landed_cost_cbm, landed_cost_kg, landed_cost_mode, ship_to_same_as_bill, incoterm, ship_to_name, ship_to_attention, ship_to_address1, ship_to_address2, ship_to_city, ship_to_state, ship_to_postal_code, ship_to_country, ship_to_phone, ship_to_email, ship_to_notes").eq("id", quoteId).single(),
        user ? supabase.from("profiles").select("company, first_name, last_name").eq("id", user.id).single() : null,
      ]);
      let loadedItems = (itemsRes.data as QuoteItemWithProduct[]) || [];

      // NOTE: We intentionally do NOT fuzzy-match prices from other catalog rows.
      // Per project rule, products with NULL trade_price_cents must show
      // "Price on Request" / TBD — fuzzy fallback caused wildly incorrect
      // prices (e.g. every "...Chandelier" inheriting an unrelated €47k price).

      // Enrich items with `edition` from designer_curator_picks (matched by title, normalized).
      try {
        const titles = Array.from(
          new Set(
            loadedItems
              .map((i) => i.trade_products?.product_name?.trim())
              .filter(Boolean) as string[]
          )
        );
        if (titles.length > 0) {
          const { data: picks } = await supabase
            .from("designer_curator_picks")
            .select("title, edition")
            .in("title", titles);
          if (picks && picks.length > 0) {
            const norm = (s: string) =>
              s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
            const editionByTitle = new Map<string, string>();
            for (const p of picks as Array<{ title: string; edition: string | null }>) {
              if (p.edition && p.title) editionByTitle.set(norm(p.title), p.edition);
            }
            loadedItems = loadedItems.map((it) => {
              const t = it.trade_products?.product_name;
              if (!t) return it;
              const ed = editionByTitle.get(norm(t));
              return ed ? { ...it, edition: ed } : it;
            });
          }
        }
      } catch {
        /* non-fatal — edition is purely additive metadata */
      }

      setItems(loadedItems);
      if (quoteRes.data?.currency) setCurrency(quoteRes.data.currency as Currency);
      if (quoteRes.data?.client_name) setClientName(quoteRes.data.client_name as string);
      if ((quoteRes.data as any)?.client_id) setClientId((quoteRes.data as any).client_id as string);
      if ((quoteRes.data as any)?.admin_notes) setAdminNotes((quoteRes.data as any).admin_notes);
      if ((quoteRes.data as any)?.project_id !== undefined) setProjectId((quoteRes.data as any).project_id);
      const q = quoteRes.data as any;
      if (q?.insurance_enabled !== undefined) setInsuranceEnabled(!!q.insurance_enabled);
      if (q?.insurance_tier) setInsuranceTier(q.insurance_tier as InsuranceTier);
      if (q?.insurance_rate_bps != null) setInsuranceRateBps(q.insurance_rate_bps);
      if (q?.insurance_notes) setInsuranceNotes(q.insurance_notes);
      if (q?.issue_date !== undefined) setIssueDate(q.issue_date ?? null);
      const mode = q?.landed_cost_mode === "courier" ? "courier" : "road";
      const cbm = Number(q?.landed_cost_cbm ?? DEFAULT_GBP_LANDED_CBM);
      const kg = Number(q?.landed_cost_kg ?? Math.round(cbm * GBP_LANDED_KG_PER_CBM[mode]));
      setLandedCostSettings({ cbm, kg, mode });
      if (q?.submitted_at !== undefined) setSubmittedAt(q.submitted_at ?? null);
      if (q?.responded_at !== undefined) setRespondedAt(q.responded_at ?? null);
      if (q?.confirmed_at !== undefined) setConfirmedAtTs(q.confirmed_at ?? null);
      // Ship-to / Incoterm
      if (q?.ship_to_same_as_bill !== undefined && q?.ship_to_same_as_bill !== null) {
        setShipToSameAsBill(!!q.ship_to_same_as_bill);
        if (!q.ship_to_same_as_bill) setShipToOpen(true);
      }
      if (q?.incoterm) setIncoterm(q.incoterm as Incoterm);
      setShipTo({
        name: q?.ship_to_name ?? "",
        attention: q?.ship_to_attention ?? "",
        address1: q?.ship_to_address1 ?? "",
        address2: q?.ship_to_address2 ?? "",
        city: q?.ship_to_city ?? "",
        state: q?.ship_to_state ?? "",
        postal_code: q?.ship_to_postal_code ?? "",
        country: q?.ship_to_country ?? "",
        phone: q?.ship_to_phone ?? "",
        email: q?.ship_to_email ?? "",
        notes: q?.ship_to_notes ?? "",
      });
      if (profileRes?.data?.company) setClientCompany(profileRes.data.company);
      setLoading(false);
    };
    load();
  }, [quoteId, user, reloadKey]);

  // Fetch products for the in-quote "Add product" picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name")
        .order("brand_name", { ascending: true })
        .order("product_name", { ascending: true })
        .limit(2000);
      if (cancelled || !data) return;
      const opts: PickerItem[] = data
        .filter((p: any) => p.product_name && p.brand_name)
        .map((p: any) => ({
          id: p.id as string,
          label: p.product_name as string,
          group: (p.brand_name as string).includes(" - ")
            ? (p.brand_name as string).split(" - ")[0].trim()
            : (p.brand_name as string),
        }));
      setProductOptions(opts);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAddProduct = async (productId: string) => {
    if (!productId || addingProduct) return;
    setAddingProduct(true);
    try {
      const { error } = await supabase.from("trade_quote_items").insert({
        quote_id: quoteId,
        product_id: productId,
        quantity: 1,
      } as any);
      if (error) throw error;
      const picked = productOptions.find((p) => p.id === productId);
      toast({
        title: "Added to quote",
        description: picked ? `${picked.label} — ${picked.group}` : undefined,
      });
      setPendingProductId("");
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      toast({
        title: "Couldn't add product",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingProduct(false);
    }
  };

  // Fetch project name when projectId changes
  useEffect(() => {
    if (!projectId) { setProjectName(null); return; }
    (supabase.from as any)("trade_projects").select("name").eq("id", projectId).maybeSingle().then(({ data }: any) => {
      setProjectName(data?.name ?? null);
    });
  }, [projectId]);

  // Check whether the linked client's primary contact is an approved trade applicant
  useEffect(() => {
    if (!clientId) { setClientApproval({ approved: false, email: null, status: null }); return; }
    (supabase.rpc as any)("is_client_trade_approved", { _client_id: clientId }).then(({ data }: any) => {
      const row = Array.isArray(data) ? data[0] : data;
      setClientApproval({
        approved: !!row?.approved,
        email: row?.contact_email ?? null,
        status: row?.application_status ?? null,
      });
    });
  }, [clientId]);

  // Pull the linked client's billing country to gate destination-specific panels (e.g. UK DDP)
  const [clientCountry, setClientCountry] = useState<string | null>(null);
  useEffect(() => {
    if (!clientId) { setClientCountry(null); return; }
    (supabase.from("clients" as any).select("billing_country").eq("id", clientId).maybeSingle() as any)
      .then(({ data }: any) => setClientCountry((data?.billing_country as string) || null));
  }, [clientId]);
  const effectiveDestCountry = (() => {
    // Ship-to country wins when a separate ship-to is set.
    const v = ((!shipToSameAsBill && shipTo.country ? shipTo.country : clientCountry) || "").trim().toLowerCase();
    return v;
  })();
  const isUkDestination = (() => {
    const c = effectiveDestCountry;
    return c === "uk" || c === "gb" || c === "united kingdom" || c === "great britain" || c === "england" || c === "scotland" || c === "wales" || c === "northern ireland";
  })();
  const isHkDestination = (() => {
    const c = effectiveDestCountry;
    return c === "hk" || c === "hong kong" || c === "hong kong sar" || c === "hong kong sar china" || c === "hksar";
  })();

  useEffect(() => {
    if (!isUkDestination && displayCcy === "gbp") setDisplayCcy("quote");
  }, [isUkDestination, displayCcy]);


  // Load email audit log for this quote
  const loadEmailLog = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("quote_email_log")
      .select("id, recipient_email, sent_by_email, created_at, note")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false });
    setEmailLog(data ?? []);
  }, [quoteId]);

  useEffect(() => { loadEmailLog(); }, [loadEmailLog]);

  // Auto-default GST on/off when currency changes, unless the user has manually toggled it.
  useEffect(() => {
    if (!gstUserTouched) setGstEnabled(currency === "SGD");
  }, [currency, gstUserTouched]);

  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>("");
  const [editingQtyError, setEditingQtyError] = useState<string | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState<string>("");
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [editingInternalNotesId, setEditingInternalNotesId] = useState<string | null>(null);
  const [editingInternalNotesValue, setEditingInternalNotesValue] = useState<string>("");
  const internalNotesTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const startEditQty = (itemId: string, currentQty: number) => {
    setEditingQtyId(itemId);
    setEditingQtyValue(String(currentQty));
    setEditingQtyError(null);
    setTimeout(() => qtyInputRef.current?.select(), 0);
  };

  const commitEditQty = async (itemId: string) => {
    const raw = editingQtyValue.trim();
    const num = parseInt(raw, 10);
    if (Number.isNaN(num) || num < 1) {
      setEditingQtyError("Quantity must be at least 1");
      qtyInputRef.current?.select();
      return;
    }
    setEditingQtyError(null);
    setEditingQtyId(null);
    if (num !== items.find((i) => i.id === itemId)?.quantity) {
      await handleUpdateQuantity(itemId, num);
    }
  };

  const cancelEditQty = () => {
    setEditingQtyId(null);
    setEditingQtyValue("");
    setEditingQtyError(null);
  };

  const startEditNotes = (itemId: string, currentNotes: string | null) => {
    setEditingNotesId(itemId);
    setEditingNotesValue(currentNotes || "");
    setTimeout(() => notesTextareaRef.current?.focus(), 0);
  };

  const commitEditNotes = async (itemId: string) => {
    const raw = editingNotesValue.trim();
    const v = raw || null;
    setEditingNotesId(null);
    setEditingNotesValue("");
    const current = items.find((i) => i.id === itemId)?.notes ?? null;
    if (v !== current) {
      await updateItemField(itemId, { notes: v });
    }
  };

  const cancelEditNotes = () => {
    setEditingNotesId(null);
    setEditingNotesValue("");
  };

  const startEditInternalNotes = (itemId: string, currentNotes: string | null) => {
    setEditingInternalNotesId(itemId);
    setEditingInternalNotesValue(currentNotes || "");
    setTimeout(() => internalNotesTextareaRef.current?.focus(), 0);
  };

  const commitEditInternalNotes = async (itemId: string) => {
    const raw = editingInternalNotesValue.trim();
    const v = raw || null;
    setEditingInternalNotesId(null);
    setEditingInternalNotesValue("");
    const current = (items.find((i) => i.id === itemId) as any)?.internal_notes ?? null;
    if (v !== current) {
      await updateItemField(itemId, { internal_notes: v } as any);
    }
  };

  const cancelEditInternalNotes = () => {
    setEditingInternalNotesId(null);
    setEditingInternalNotesValue("");
  };

  const handleCurrencyChange = async (c: Currency) => {
    setCurrency(c);
    setCurrencyOpen(false);
    await supabase.from("trade_quotes").update({ currency: c }).eq("id", quoteId);
  };

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    const { error } = await supabase.from("trade_quote_items").update({ quantity: newQty }).eq("id", itemId);
    if (error) {
      toast({ title: "Could not update quantity", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i)));
  };

  const handleRemoveItem = async (itemId: string) => {
    const { error } = await supabase.from("trade_quote_items").delete().eq("id", itemId);
    if (error) {
      toast({ title: "Could not remove item", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast({ title: "Item removed" });
  };

  const handleSubmit = async () => {
    await supabase.from("trade_quotes").update({
      notes: notes || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      landed_cost_cbm: landedCostSettings.cbm,
      landed_cost_kg: landedCostSettings.kg,
      landed_cost_mode: landedCostSettings.mode,
    } as any).eq("id", quoteId);

    // Auto-apply any available credit (e.g. FF&E unlock)
    try {
      const { data: applied } = await supabase.rpc("apply_available_credit_to_quote", { _quote_id: quoteId });
      if (applied && (applied as number) > 0) {
        toast({ title: "Credit applied", description: `$${((applied as number) / 100).toLocaleString()} credit applied to this quote.` });
      }
    } catch (err) { console.error("Credit apply failed:", err); }

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

  const appendAdminNote = (existing: string | null | undefined, header: string, body: string) => {
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const block = `[${header} — ${stamp}]\n${body.trim()}`;
    return existing && existing.trim() ? `${existing.trim()}\n\n${block}` : block;
  };

  const handleSubmitRevise = async () => {
    const reason = reviseReason.trim();
    if (!isSuperAdmin && !reason) {
      toast({ title: "Reason required", description: "Please describe what you'd like changed.", variant: "destructive" });
      return;
    }
    const header = isSuperAdmin ? "Reopened as draft by admin" : "Client requested changes";
    const newNotes = reason ? appendAdminNote(adminNotes, header, reason) : adminNotes;
    await supabase.from("trade_quotes").update({
      status: "draft",
      submitted_at: null,
      responded_at: null,
      admin_notes: newNotes,
    } as any).eq("id", quoteId);
    setAdminNotes(newNotes);
    setReviseOpen(false);
    setReviseReason("");
    toast({ title: isSuperAdmin ? "Quote reopened as draft" : "Changes requested", description: isSuperAdmin ? "You can now edit lines directly." : "Quote reopened as draft with your note attached." });
    onStatusChange();
  };

  const handleSubmitCancel = async () => {
    const reason = cancelReason.trim();
    if (!reason) {
      toast({ title: "Reason required", description: "Please add a brief reason for cancellation.", variant: "destructive" });
      return;
    }
    const newNotes = appendAdminNote(adminNotes, "Cancelled by client", reason);
    await supabase.from("trade_quotes").update({
      status: "cancelled",
      admin_notes: newNotes,
    } as any).eq("id", quoteId);
    setAdminNotes(newNotes);
    setCancelOpen(false);
    setCancelReason("");
    toast({ title: "Quote cancelled", description: "Your reason has been recorded." });
    onStatusChange();
  };

  const [recreating, setRecreating] = useState(false);
  const handleCancelAndRecreate = async () => {
    if (!user) return;
    if (!confirm("Cancel this quote and start a fresh draft with the same lines, client, ship-to and Incoterm?")) return;
    setRecreating(true);
    try {
      // 1) Fetch the full source row (no relations) + items
      const [srcRes, itemsRes] = await Promise.all([
        supabase.from("trade_quotes").select("*").eq("id", quoteId).single(),
        supabase.from("trade_quote_items").select("product_id, quantity, unit_price_cents, notes, po_number, cost_code, lead_time_weeks_override, deposit_pct_override, variant_label, room, axonometric_image_url").eq("quote_id", quoteId),
      ]);
      if (srcRes.error || !srcRes.data) throw srcRes.error || new Error("Source quote not found");
      const src: any = srcRes.data;

      // 2) Insert new draft, copying everything that defines the quote
      const draft: any = {
        user_id: user.id,
        studio_id: src.studio_id ?? null,
        status: "draft",
        currency: src.currency,
        client_id: src.client_id ?? null,
        client_name: src.client_name ?? null,
        project_id: src.project_id ?? null,
        notes: src.notes ?? null,
        insurance_enabled: src.insurance_enabled ?? false,
        insurance_tier: src.insurance_tier ?? null,
        insurance_rate_bps: src.insurance_rate_bps ?? null,
        insurance_notes: src.insurance_notes ?? null,
        landed_cost_cbm: src.landed_cost_cbm ?? null,
        landed_cost_kg: src.landed_cost_kg ?? null,
        landed_cost_mode: src.landed_cost_mode ?? null,
        ship_to_same_as_bill: src.ship_to_same_as_bill ?? true,
        incoterm: src.incoterm ?? null,
        ship_to_name: src.ship_to_name ?? null,
        ship_to_attention: src.ship_to_attention ?? null,
        ship_to_address1: src.ship_to_address1 ?? null,
        ship_to_address2: src.ship_to_address2 ?? null,
        ship_to_city: src.ship_to_city ?? null,
        ship_to_state: src.ship_to_state ?? null,
        ship_to_postal_code: src.ship_to_postal_code ?? null,
        ship_to_country: src.ship_to_country ?? null,
        ship_to_phone: src.ship_to_phone ?? null,
        ship_to_email: src.ship_to_email ?? null,
        ship_to_notes: src.ship_to_notes ?? null,
      };
      const insertRes = await supabase.from("trade_quotes").insert(draft).select("id").single();
      if (insertRes.error || !insertRes.data) throw insertRes.error || new Error("Could not create new draft");
      const newId = insertRes.data.id as string;

      // 3) Copy line items
      const lines = (itemsRes.data || []).map((it: any) => ({ ...it, quote_id: newId }));
      if (lines.length > 0) {
        const itemsInsert = await supabase.from("trade_quote_items").insert(lines);
        if (itemsInsert.error) throw itemsInsert.error;
      }

      // 4) Mark source cancelled with traceability note
      const newSrcNotes = appendAdminNote(adminNotes, "Cancelled & recreated", `Replaced by draft QU-${newId.slice(0, 6).toUpperCase()}`);
      await supabase.from("trade_quotes").update({ status: "cancelled", admin_notes: newSrcNotes } as any).eq("id", quoteId);

      toast({ title: "New draft created", description: `${lines.length} line${lines.length === 1 ? "" : "s"} carried over. Original quote cancelled.` });

      // 5) Navigate to the new draft (parent re-syncs from ?quote=)
      const sp = new URLSearchParams();
      sp.set("quote", newId);
      if (src.project_id) sp.set("project", src.project_id);
      navigate(`/trade/quotes?${sp.toString()}`, { replace: true });
    } catch (err: any) {
      toast({ title: "Could not recreate", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setRecreating(false);
    }
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
      const shippingQuoteCents = (fxQuoteEur && perLine.totalShippingEurCents > 0)
        ? Math.round(perLine.totalShippingEurCents / fxQuoteEur)
        : 0;
      const { data, error } = await supabase.functions.invoke("create-quote-payment", {
        body: { quoteId, paymentType, shippingCents: shippingQuoteCents },
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
    const rawPrice = item.unit_price_cents ?? catalogSourcePriceCents(item) ?? 0;
    // If admin set unit_price_cents, it's already in the quote's currency — skip conversion
    const prodCurrency = item.unit_price_cents != null ? currency : (item.trade_products?.currency || currency);
    const converted = convertCents(rawPrice, prodCurrency, currency) ?? 0;
    return sum + converted * item.quantity;
  }, 0);

  const buildPdfArgs = async () => {
    const lines: QuotePdfLine[] = items.map((item) => {
      const product = item.trade_products;
      const rawUnit = item.unit_price_cents ?? catalogSourcePriceCents(item) ?? null;
      const fromCur = item.unit_price_cents != null ? currency : (product?.currency || currency);
      const unit = convertCents(rawUnit, fromCur, currency);
      return {
        productName: product?.product_name || "—",
        brandName: product?.brand_name || "",
        dimensions: product?.dimensions ?? null,
        materials: product?.materials ?? null,
        edition: item.edition ?? null,
        variantLabel: item.variant_label ?? null,
        leadTime: product?.lead_time ?? null,
        notes: item.notes ?? null,
        quantity: item.quantity,
        unitPriceCents: unit,
        lineTotalCents: unit != null ? unit * item.quantity : null,
        imageUrl: product?.image_url ?? null,
        shipOriginCountry: toIsoCountry(item.ship_origin_country ?? product?.origin ?? null, "FR"),
        shipMode: item.ship_mode || null,
        shipCbm: item.ship_cbm != null ? Number(item.ship_cbm) : null,
        shipWeightKg: item.ship_weight_kg != null ? Number(item.ship_weight_kg) : null,
      };
    });
    const statusEntry = STATUS_BADGE[quoteStatus] ?? { label: quoteStatus, cls: "" };
    const insLabel = INSURANCE_TIERS.find((t) => t.value === insuranceTier)?.label ?? null;

    // Compute shipping fresh at build time — avoids race where React state
    // is briefly empty after an item edit (perLine resets while async runs).
    let livePerLine = perLine;
    if (destIso && fxQuoteEur && perLineRawLines.length > 0) {
      try {
        livePerLine = await computePerLineShipments(perLineRawLines, destIso, fxQuoteEur);
      } catch {
        /* keep stale perLine */
      }
    }
    const shippingEstimateCents = (fxQuoteEur && livePerLine.totalShippingEurCents > 0)
      ? Math.round(livePerLine.totalShippingEurCents / fxQuoteEur)
      : 0;
    const uniqueModes = Array.from(new Set(livePerLine.shipments.map((s) => s.mode)));
    const shippingModeLabel = uniqueModes.length === 1 ? labelForMode(uniqueModes[0]) : null;
    const shippingModeBreakdown = uniqueModes.length > 1 && fxQuoteEur
      ? uniqueModes.map((mode) => {
          const group = livePerLine.shipments.filter((s) => s.mode === mode);
          const eurCents = group.reduce((sum, s) => sum + s.shippingEurCents, 0);
          return {
            modeLabel: labelForMode(mode),
            cents: Math.round(eurCents / fxQuoteEur),
            shipmentCount: group.length,
          };
        })
      : undefined;

    // Pull structured billing + primary contact from the linked client (if any)
    let clientCompanyName: string | null = null;
    let clientBilling: any = null;
    let clientContact: any = null;
    if (clientId) {
      try {
        const [{ data: cli }, { data: contacts }] = await Promise.all([
          supabase
            .from("clients" as any)
            .select("name, billing_address_line1, billing_address_line2, billing_city, billing_region, billing_postal_code, billing_country")
            .eq("id", clientId)
            .maybeSingle(),
          supabase
            .from("client_contacts" as any)
            .select("first_name, last_name, role_title, email, phone, is_primary")
            .eq("client_id", clientId)
            .order("is_primary", { ascending: false })
            .limit(1),
        ]);
        if (cli) {
          const c = cli as any;
          clientCompanyName = c.name ?? null;
          clientBilling = {
            line1: c.billing_address_line1,
            line2: c.billing_address_line2,
            city: c.billing_city,
            region: c.billing_region,
            postalCode: c.billing_postal_code,
            country: c.billing_country,
          };
        }
        const primary = (contacts as any[])?.[0];
        if (primary) {
          const fullName = [primary.first_name, primary.last_name].filter(Boolean).join(" ").trim();
          clientContact = {
            name: fullName || null,
            role: primary.role_title || null,
            email: primary.email || null,
            phone: primary.phone || null,
          };
        }
      } catch {
        /* non-fatal — fallback to clientName text */
      }
    }

    return {
      quoteNumber,
      status: quoteStatus,
      statusLabel: statusEntry.label,
      createdAt: createdDate,
      expiryAt: expiryDate,
      clientName: clientName || null,
      clientCompany: clientCompanyName,
      clientBilling,
      clientContact,
      projectName: projectName || null,
      currency,
      lines,
      subtotalCents,
      tradeDiscountPct,
      tradeDiscountApplied: tradeDiscount,
      tierLabel,
      tierBreakdown: tierConfig
        ? (["silver", "gold", "platinum"] as const).map((t) => ({
            label: tierConfig[t].label,
            pct: tierConfig[t].discount_pct,
            minSpendCents: tierConfig[t].min_spend_cents,
            active: t === currentTier,
          }))
        : undefined,
      gstEnabled,
      gstRate,
      insurancePremiumCents: (() => {
        // Recompute insurance premium fresh at PDF time so deposit/stock/shipping
        // changes are always reflected. CIF basis = (goods after discount) + freight.
        if (!insuranceEnabled) return 0;
        const liveFreightCents = (fxQuoteEur && livePerLine.totalShippingEurCents > 0)
          ? Math.round(livePerLine.totalShippingEurCents / fxQuoteEur)
          : 0;
        const cifBase = insuredBaseCents + liveFreightCents;
        return cifBase > 0 ? Math.round(cifBase * insuranceRateBps / 10000) : 0;
      })(),
      depositPct: computeWeightedDepositPct(
        items.map((it) => {
          const rawPrice = it.unit_price_cents ?? catalogSourcePriceCents(it) ?? 0;
          const fromCur = it.unit_price_cents != null ? currency : (it.trade_products?.currency || currency);
          const lineCents = (convertCents(rawPrice, fromCur, currency) ?? 0) * it.quantity;
          const p = it.trade_products as any;
          return {
            lineCents,
            deposit_pct_override: it.deposit_pct_override,
            lead_weeks_override: getLeadWeeksOverride(it.lead_time_weeks_override),
            stock_status_override: p?.stock_status_override ?? null,
            lead_weeks_max_override: p?.lead_weeks_max_override ?? null,
          };
        }),
      ),
      shippingEstimateCents,
      shippingShipmentCount: livePerLine.shipments.length,
      shippingModeLabel,
      shippingModeBreakdown,
      insuranceLabel: insuranceEnabled ? insLabel : null,
      insuranceRateBps: insuranceEnabled ? insuranceRateBps : 0,
      insuranceEnabled,
      notes: notes || null,
      shipToSameAsBill,
      incoterm: incoterm || null,
      shipTo: !shipToSameAsBill ? {
        name: shipTo.name || null,
        attention: shipTo.attention || null,
        address1: shipTo.address1 || null,
        address2: shipTo.address2 || null,
        city: shipTo.city || null,
        state: shipTo.state || null,
        postalCode: shipTo.postal_code || null,
        country: shipTo.country || null,
        phone: shipTo.phone || null,
        email: shipTo.email || null,
        notes: shipTo.notes || null,
      } : null,
      gbpLanded: gbp.ready
        ? {
            ready: gbp.ready,
            fxEurGbp: gbp.fxEurGbp,
            fxIsFallback: gbp.fxIsFallback,
            goodsGbpCents: gbp.goodsGbpCents,
            shippingGbpCents: gbp.shippingGbpCents,
            dutyGbpCents: gbp.dutyGbpCents,
            vatGbpCents: gbp.vatGbpCents,
            totalGbpCents: gbp.totalGbpCents,
            // Per-origin so the PDF can show shipping mode (air / sea LCL / etc.) per consolidation.
            origins: livePerLine.shipments.length && gbp.fxEurGbp
              ? livePerLine.shipments.map((s) => ({
                  country: s.origin,
                  modeLabel: labelForMode(s.mode),
                  gbpCents: Math.round((s.shippingEurCents + s.dutyEurCents + s.vatEurCents) * (gbp.fxEurGbp || 0)),
                }))
              : undefined,
          }
        : null,
      hkdLanded: hkd.ready && isHkDestination
        ? {
            ready: hkd.ready,
            fxEurHkd: hkd.fxEurHkd,
            fxIsFallback: hkd.fxIsFallback,
            goodsHkdCents: hkd.goodsHkdCents,
            shippingHkdCents: hkd.shippingHkdCents,
            dutyHkdCents: hkd.dutyHkdCents,
            vatHkdCents: hkd.vatHkdCents,
            totalHkdCents: hkd.totalHkdCents,
            goodsEurCents: hkd.goodsEurCents,
            shippingEurCents: hkd.shippingEurCents,
            totalEurCents: hkd.totalEurCents,
            // Per-origin so the PDF can show shipping mode (air / sea LCL / etc.) per consolidation.
            origins: livePerLine.shipments.length && hkd.fxEurHkd
              ? livePerLine.shipments.map((s) => {
                  const eurCents = s.shippingEurCents + s.dutyEurCents + s.vatEurCents;
                  return {
                    country: s.origin,
                    modeLabel: labelForMode(s.mode),
                    hkdCents: Math.round(eurCents * (hkd.fxEurHkd || 0)),
                    eurCents,
                  };
                })
              : undefined,
          }
        : null,

      // Full dedicated annex pages — appended to the main quote PDF so the
      // client receives a single multi-page document (no separate downloads).
      ukDdpPage: isUkDestination && gbp.ready && gbp.totalGbpCents > 0
        ? {
            quoteRef: quoteNumber,
            clientName: clientName || null,
            quoteCurrency: currency,
            cbm: landedCostSettings.cbm,
            kg: landedCostSettings.kg,
            mode: landedCostSettings.mode,
            carrier: gbp.breakdown?.selected_carrier ?? null,
            transitDays: {
              min: gbp.breakdown?.transit_days_min ?? null,
              max: gbp.breakdown?.transit_days_max ?? null,
            },
            gbp,
          }
        : null,
      hkDapPage: isHkDestination && hkd.ready && hkd.totalHkdCents > 0
        ? {
            quoteRef: quoteNumber,
            clientName: clientName || null,
            quoteCurrency: currency,
            cbm: hkLandedSettings.cbm,
            kg: hkLandedSettings.kg,
            mode: hkLandedSettings.mode,
            carrier: hkd.breakdown?.selected_carrier ?? null,
            transitDays: {
              min: hkd.breakdown?.transit_days_min ?? null,
              max: hkd.breakdown?.transit_days_max ?? null,
            },
            hkd,
            origins: livePerLine.shipments.length && hkd.fxEurHkd
              ? livePerLine.shipments.map((s) => {
                  const eurCents = s.shippingEurCents + s.dutyEurCents + s.vatEurCents;
                  return {
                    country: s.origin,
                    modeLabel: labelForMode(s.mode),
                    totalCbm: s.totalCbm,
                    totalKg: s.totalKg,
                    hkdCents: Math.round(eurCents * (hkd.fxEurHkd || 0) * (1 + FX_BUFFER)),
                  };
                })
              : undefined,
          }
        : null,
    };
  };

  const handleDownloadPdf = async () => {
    try {
      const args = await buildPdfArgs();
      await downloadQuotePdf(args);
      toast({ title: "PDF downloaded", description: "Branded quote PDF saved to your device." });
    } catch (err: any) {
      toast({ title: "PDF failed", description: err?.message || "Could not generate PDF.", variant: "destructive" });
    }
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const handlePreviewPdf = async () => {
    if (previewLoading) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const args = await buildPdfArgs();
      const url = await previewQuotePdfUrl(args);
      setPreviewUrl(url);
    } catch (err: any) {
      const message = err?.message || "Could not generate preview.";
      setPreviewError(message);
      toast({ title: "Preview failed", description: message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };
  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewOpen(false);
  };


  /** Persist insurance fields. Optimistic — caller already updated local state. */
  const persistInsurance = async (patch: Partial<{ insurance_enabled: boolean; insurance_tier: InsuranceTier; insurance_rate_bps: number; insurance_notes: string | null }>) => {
    if (isReadOnly) return;
    const { error } = await supabase.from("trade_quotes").update(patch as any).eq("id", quoteId);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };

  /** Insured goods base: subtotal − trade discount (used by GBP/HK landed-cost panels). */
  const insuredBaseCents = tradeDiscount && subtotalCents > 0
    ? subtotalCents - Math.round(subtotalCents * tradeDiscountPct)
    : subtotalCents;

  /**
   * Per-line shipping: groups quote lines by (origin, mode), runs the
   * estimator per group, returns aggregated EUR totals. Feeds the
   * landed-cost panels as `overrideShipping` so multi-origin quotes
   * (e.g. one item from FR, another from DE) get a correct freight figure.
   */
  const destIso = toIsoCountry(effectiveDestCountry || "", "");
  const [fxQuoteEur, setFxQuoteEur] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchFx(currency, "EUR").then((r) => { if (!cancelled) setFxQuoteEur(r.rate); });
    return () => { cancelled = true; };
  }, [currency]);
  const perLineRawLines = useMemo(() => items.map((it) => {
    const product = it.trade_products;
    const lineCents = (it.unit_price_cents ?? catalogSourcePriceCents(it) ?? 0) * it.quantity;
    return {
      id: it.id,
      qty: it.quantity,
      lineCents,
      productOrigin: product?.origin ?? null,
      shipOriginCountry: it.ship_origin_country,
      shipMode: it.ship_mode,
      shipCbm: it.ship_cbm != null ? Number(it.ship_cbm) : null,
      shipWeightKg: it.ship_weight_kg != null ? Number(it.ship_weight_kg) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items]);
  const { result: perLine, loading: perLineLoading } = usePerLineShipping(
    perLineRawLines,
    destIso || null,
    fxQuoteEur,
    !!destIso && !!fxQuoteEur && items.length > 0,
  );
  const overrideShipping = perLine.shipments.length > 0 ? {
    shippingEurCents: perLine.totalShippingEurCents,
    dutyEurCents: perLine.totalDutyEurCents,
    vatEurCents: perLine.totalVatEurCents,
    shipmentCount: perLine.shipments.length,
    totalCbm: perLine.shipments.reduce((s, x) => s + x.totalCbm, 0),
    totalKg: perLine.shipments.reduce((s, x) => s + x.totalKg, 0),
  } : null;

  /**
   * Insurance premium — calculated on CIF value (goods after discount + freight),
   * per the user's policy. Freight is converted from EUR to the quote currency.
   */
  const freightInQuoteCcyCents = (fxQuoteEur && perLine.totalShippingEurCents > 0)
    ? Math.round(perLine.totalShippingEurCents / fxQuoteEur)
    : 0;
  const insuranceBaseCents = insuredBaseCents + freightInQuoteCcyCents;
  const insurancePremiumCents = insuranceEnabled && insuranceBaseCents > 0
    ? Math.round(insuranceBaseCents * insuranceRateBps / 10000)
    : 0;

  /** GBP DDP landed-cost amounts for the totals toggle (Paris → London). */
  const gbp = useGbpLandedCost({
    goodsAfterDiscountCents: isUkDestination ? insuredBaseCents : 0,
    quoteCurrency: currency,
    cbm: landedCostSettings.cbm,
    kg: landedCostSettings.kg,
    mode: landedCostSettings.mode,
    overrideShipping: isUkDestination ? overrideShipping : null,
  });

  const handleLandedCostSettingsChange = useCallback((settings: { cbm: number; kg: number; mode: "road" | "courier" }) => {
    setLandedCostSettings((prev) => (
      prev.cbm === settings.cbm && prev.kg === settings.kg && prev.mode === settings.mode ? prev : settings
    ));
    void supabase.from("trade_quotes").update({
      landed_cost_cbm: settings.cbm,
      landed_cost_kg: settings.kg,
      landed_cost_mode: settings.mode,
    } as any).eq("id", quoteId);
  }, [quoteId]);

  /** HKD DAP landed-cost amounts for the PDF (Paris → Hong Kong). */
  const hkd = useHkdLandedCost({
    goodsAfterDiscountCents: isHkDestination ? insuredBaseCents : 0,
    quoteCurrency: currency,
    cbm: hkLandedSettings.cbm,
    kg: hkLandedSettings.kg,
    mode: hkLandedSettings.mode,
    overrideShipping: isHkDestination ? overrideShipping : null,
  });

  const handleHkLandedSettingsChange = useCallback((settings: { cbm: number; kg: number; mode: HkMode }) => {
    setHkLandedSettings((prev) => (
      prev.cbm === settings.cbm && prev.kg === settings.kg && prev.mode === settings.mode ? prev : settings
    ));
  }, []);


  /** Optimistic patch: update one quote-line column and persist. */
  const updateItemField = async (
    itemId: string,
    patch: Partial<Pick<QuoteItemWithProduct,
      "po_number" | "cost_code" | "lead_time_weeks_override" | "deposit_pct_override" | "room"
      | "ship_origin_country" | "ship_mode" | "ship_cbm" | "ship_weight_kg" | "notes"
    >> & { internal_notes?: string | null },
  ) => {
    if (isReadOnly) return;
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("trade_quote_items").update(patch as any).eq("id", itemId);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };

  const parseLeadWeeks = (text: string | null): number | null => {
    if (!text) return null;
    // Match "14-16", "14 - 16", "18 to 20", "18 – 20" (en-dash), "18—20" (em-dash)
    const m = text.match(/(\d+)\s*(?:-|–|—|to)\s*(\d+)|\d+/i);
    if (!m) return null;
    if (m[2]) return parseInt(m[2], 10); // upper bound of a range
    const single = text.match(/\d+/);
    return single ? parseInt(single[0], 10) : null;
  };

  // null = no override (fall back to product default); 0 = In Stock; >0 = explicit weeks
  const getLeadWeeksOverride = (value: number | null): number | null =>
    value != null && value >= 0 ? value : null;

  const [exportingExcel, setExportingExcel] = useState(false);
  const handleExportExcel = async () => {
    if (!items.length) return;
    setExportingExcel(true);
    try {
      const lines: ProcurementLine[] = items.map((item, idx) => {
        const product = item.trade_products;
        const rawUnit = item.unit_price_cents ?? catalogSourcePriceCents(item) ?? null;
        const fromCur = item.unit_price_cents != null ? currency : (product?.currency || currency);
        const unitTrade = convertCents(rawUnit, fromCur, currency);
        const unitRrp = convertCents(product?.rrp_price_cents ?? null, product?.currency || currency, currency);
        const lead = getLeadWeeksOverride(item.lead_time_weeks_override) ?? parseLeadWeeks(product?.lead_time || null);
        return {
          po_number: item.po_number || autoPoNumber(quoteNumber, idx + 1),
          cost_code: item.cost_code || "",
          room: item.room || clientName || "",
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
            {exportingExcel ? <DotCircleLoader size="sm" className="h-3.5 w-3.5" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
          <button
            onClick={handlePreviewPdf}
            disabled={items.length === 0 || previewLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 border border-border rounded-md font-body text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Preview the branded PDF before downloading"
          >
            {previewLoading ? <DotCircleLoader size="sm" className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Preview PDF</span>
            <span className="sm:hidden">Preview</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={items.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 border border-border rounded-md font-body text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Download a branded PDF — clean, no browser headers/footers"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          {(() => {
            const hasClient = !!clientId;
            const hasEmail = !!clientApproval.email;
            const isApproved = clientApproval.approved;
            const disabled = items.length === 0 || !hasClient || !hasEmail || !isApproved;
            const title = !hasClient
              ? "Link a client first"
              : !hasEmail
              ? "No contact email on file for this client"
              : !isApproved
              ? `Client's trade application is ${clientApproval.status ?? "not submitted"} — approve it before emailing`
              : `Email this quote to ${clientApproval.email}`;
            const openPreview = async () => {
              if (disabled || emailPreviewLoading) return;
              setEmailPreviewLoading(true);
              try {
                const args = await buildPdfArgs();
                const url = await previewQuotePdfUrl(args);
                setEmailPreviewUrl(url);
                setEmailSubject(`Quote ${quoteNumber} from Maison Affluency${projectName ? ` — ${projectName}` : ""}`);
                setEmailBody(
                  `Dear ${(clientName || "Client").split(" ")[0]},\n\n` +
                  `Please find attached your quote ${quoteNumber}${projectName ? ` for ${projectName}` : ""}.\n\n` +
                  `Do let us know if you have any questions or would like to proceed.\n\n` +
                  `With kind regards,\nMaison Affluency`
                );
                setEmailPreviewOpen(true);
              } catch (err: any) {
                toast({ title: "Preview failed", description: err?.message || "Could not build preview.", variant: "destructive" });
              } finally {
                setEmailPreviewLoading(false);
              }
            };
            return (
              <button
                onClick={openPreview}
                disabled={disabled || sendingEmail || emailPreviewLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 border border-border rounded-md font-body text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={title}
              >
                {disabled && !isApproved && hasClient ? <Lock className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Email to Client</span>
                <span className="sm:hidden">Email</span>
              </button>
            );
          })()}
          {emailLog.length > 0 && (
            <button
              onClick={() => setEmailLogOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 border border-border rounded-md font-body text-xs text-muted-foreground hover:bg-muted transition-colors"
              title="View email send history"
            >
              <HistoryIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Email log ({emailLog.length})</span>
              <span className="sm:hidden">{emailLog.length}</span>
            </button>
          )}
        </div>
      </div>

      {emailLogOpen && emailLog.length > 0 && (
        <div className="mb-4 md:mb-6 rounded-md border border-border bg-muted/30 px-4 py-3 print:hidden">
          <p className="font-body text-xs uppercase tracking-[0.12em] text-foreground mb-2">Email send history</p>
          <ul className="space-y-1.5">
            {emailLog.map((row) => (
              <li key={row.id} className="font-body text-xs text-muted-foreground flex flex-wrap gap-x-2">
                <span className="text-foreground">{new Date(row.created_at).toLocaleString()}</span>
                <span>→ {row.recipient_email}</span>
                <span>· by {row.sent_by_email ?? "unknown admin"}</span>
                {row.note && <span className="italic">— {row.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

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
            {/* Left: Title + Project + Client Name */}
            <div>
              <h1 className="font-display text-2xl md:text-3xl lg:text-4xl text-foreground tracking-wide uppercase mb-2 md:mb-3">
                Quote
              </h1>
              {projectName && (
                <div className="mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Project</span>
                  <p className="font-display text-sm text-foreground uppercase tracking-wider">{projectName}</p>
                  {projectId && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
                      <a
                        href={`/trade/tearsheets?project=${projectId}`}
                        className="inline-flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                        title="Open this project's tearsheets"
                      >
                        <Layers className="h-3 w-3" />
                        Project tearsheets
                      </a>
                      <a
                        href={`/trade/boards?project=${projectId}`}
                        className="inline-flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                        title="Open this project's boards"
                      >
                        <FolderOpen className="h-3 w-3" />
                        Project boards
                      </a>
                    </div>
                  )}
                </div>
              )}
              {isDraft ? (
                <div className="w-full max-w-[320px]">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Client</span>
                  <ClientPicker
                    value={clientId}
                    size="sm"
                    showManageLink={false}
                    placeholder="Select or create a client…"
                    onChange={(c) => {
                      const newId = c?.id ?? null;
                      const newName = c?.name ?? "";
                      setClientId(newId);
                      setClientName(newName);
                      supabase.from("trade_quotes")
                        .update({ client_id: newId, client_name: newName } as any)
                        .eq("id", quoteId);
                    }}
                  />
                  {clientId && (
                    <Link
                      to={`/trade/clients?edit=${clientId}`}
                      className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-body text-muted-foreground hover:text-foreground"
                    >
                      Edit client & contacts <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ) : (
                clientName && (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Client</span>
                    <p className="font-display text-sm text-foreground uppercase tracking-wider">
                      {clientName}
                    </p>
                  </div>
                )
              )}

              {/* Ship-to & Incoterm */}
              {isDraft ? (
                <div className="w-full max-w-[320px] mt-3 pt-3 border-t border-border/60">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={!shipToSameAsBill}
                      onChange={async (e) => {
                        const different = e.target.checked;
                        const same = !different;
                        setShipToSameAsBill(same);
                        setShipToOpen(different);
                        const patch: any = { ship_to_same_as_bill: same };
                        // Default Incoterm to DAP when enabling separate ship-to
                        if (different && !incoterm) {
                          setIncoterm("DAP");
                          patch.incoterm = "DAP";
                        }
                        await supabase.from("trade_quotes").update(patch).eq("id", quoteId);
                      }}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      Different ship-to address
                    </span>
                  </label>

                  {!shipToSameAsBill && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Incoterm</span>
                        <select
                          value={incoterm}
                          onChange={async (e) => {
                            const v = (e.target.value || "") as Incoterm | "";
                            setIncoterm(v);
                            await supabase.from("trade_quotes")
                              .update({ incoterm: v || null } as any)
                              .eq("id", quoteId);
                          }}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-body"
                        >
                          <option value="">—</option>
                          {INCOTERMS.map((ic) => (
                            <option key={ic} value={ic}>{ic}</option>
                          ))}
                        </select>
                      </div>

                      {(["name","attention","address1","address2","city","state","postal_code","country","phone","email","notes"] as const).map((key) => {
                        const labelMap: Record<string, string> = {
                          name: "Ship-to name / company",
                          attention: "Attention",
                          address1: "Address line 1",
                          address2: "Address line 2",
                          city: "City",
                          state: "State / region",
                          postal_code: "Postal code",
                          country: "Country",
                          phone: "Phone",
                          email: "Email",
                          notes: "Delivery notes",
                        };
                        const dbCol = `ship_to_${key}`;
                        return (
                          <div key={key}>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-0.5">{labelMap[key]}</span>
                            <input
                              type="text"
                              value={shipTo[key] || ""}
                              onChange={(e) => setShipTo((s) => ({ ...s, [key]: e.target.value }))}
                              onBlur={async (e) => {
                                await supabase.from("trade_quotes")
                                  .update({ [dbCol]: e.target.value || null } as any)
                                  .eq("id", quoteId);
                              }}
                              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-body"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                !shipToSameAsBill && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">
                      Ship to {incoterm ? `· ${incoterm}` : ""}
                    </span>
                    <p className="font-body text-xs text-foreground leading-relaxed">
                      {[shipTo.name, shipTo.attention].filter(Boolean).join(" — ")}
                      {shipTo.address1 && <><br />{shipTo.address1}</>}
                      {shipTo.address2 && <><br />{shipTo.address2}</>}
                      {(shipTo.city || shipTo.postal_code) && <><br />{[shipTo.postal_code, shipTo.city].filter(Boolean).join(" ")}{shipTo.state ? `, ${shipTo.state}` : ""}</>}
                      {shipTo.country && <><br />{shipTo.country}</>}
                      {shipTo.phone && <><br />Tel: {shipTo.phone}</>}
                      {shipTo.email && <><br />{shipTo.email}</>}
                    </p>
                    {shipTo.notes && (
                      <p className="font-body text-[11px] text-muted-foreground italic mt-1">{shipTo.notes}</p>
                    )}
                  </div>
                )
              )}
            </div>


            {/* Middle: Date / Expiry / Number */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 md:block md:space-y-2 text-sm font-body">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Date</span>
                {isDraft ? (
                  <input
                    type="date"
                    value={issueDate ?? new Date(quoteCreatedAt).toISOString().slice(0, 10)}
                    onChange={(e) => setIssueDate(e.target.value || null)}
                    onBlur={async (e) => {
                      const v = e.target.value || null;
                      await supabase.from("trade_quotes").update({ issue_date: v } as any).eq("id", quoteId);
                    }}
                    className="bg-transparent border-b border-border focus:outline-none focus:border-primary text-foreground text-sm font-body py-0.5"
                  />
                ) : (
                  <span className="text-foreground">{formatDate(createdDate)}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Expiry</span>
                <span className="text-foreground">{formatDate(expiryDate)}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Quote Number</span>
                <span className="text-foreground">{quoteNumber}</span>
              </div>
              <StatusBadge className="mt-1" />
              {(submittedAt || respondedAt || confirmedAtTs) && (
                <div className="mt-2 space-y-0.5 text-[10px] font-body text-muted-foreground print:hidden">
                  {submittedAt && (
                    <div><span className="uppercase tracking-widest">Submitted</span> · {formatDate(new Date(submittedAt))}</div>
                  )}
                  {respondedAt && (
                    <div><span className="uppercase tracking-widest">Priced</span> · {formatDate(new Date(respondedAt))}</div>
                  )}
                  {confirmedAtTs && (
                    <div><span className="uppercase tracking-widest">Confirmed</span> · {formatDate(new Date(confirmedAtTs))}</div>
                  )}
                </div>
              )}
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
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">
                  Trade discount
                </span>
                <span className="font-body text-[10px] text-foreground uppercase tracking-widest">
                  · {tierLabel} {tradeDiscountLabel}
                </span>
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

            {tradeDiscount && tierConfig && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[10px] text-muted-foreground">
                <span className="uppercase tracking-widest">Tiers:</span>
                {(["silver","gold","platinum"] as const).map((t) => {
                  const c = tierConfig[t];
                  const pct = `${(c.discount_pct * 100).toFixed(c.discount_pct * 100 % 1 === 0 ? 0 : 1)}%`;
                  const min = c.min_spend_cents > 0
                    ? `from ${(c.min_spend_cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
                    : "entry";
                  const active = t === currentTier;
                  return (
                    <span key={t} className={active ? "text-foreground" : ""}>
                      <span className={active ? "font-medium" : ""}>{c.label}</span>{" "}
                      <span className="opacity-70">{pct} · {min}</span>
                      {active && <span className="ml-1 uppercase tracking-widest">(you)</span>}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== Line items ===== */}
        <div className="p-4 md:p-6 lg:p-8">
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => <QuoteItemSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 md:p-12 text-center">
              <Package className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-body text-sm text-muted-foreground mb-1">No items in this quote</p>
              <p className="font-body text-[10px] text-muted-foreground mb-4">
                Add a product below, or pick more from the Trade Gallery.
              </p>
              <div className="max-w-sm mx-auto print:hidden">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 min-w-0">
                    <AlphabetProductPicker
                      items={productOptions}
                      value={pendingProductId}
                      onChange={setPendingProductId}
                      placeholder={productOptions.length === 0 ? "Loading catalogue…" : "Pick a product (A → Designer → Item)"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddProduct(pendingProductId)}
                    disabled={!pendingProductId || addingProduct}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-background rounded-md font-body text-xs uppercase tracking-wider hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {addingProduct ? <DotCircleLoader size="sm" className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </button>
                </div>
              </div>
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

              {/* Datalist of existing rooms in this quote, for the per-line input. */}
              <datalist id={`rooms-${quoteId}`}>
                {Array.from(new Set(items.map((i) => (i.room || "").trim()).filter(Boolean))).map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>

              {/* Items — grouped by room. Items with no room go under "Unassigned". */}
              {(() => {
                const groups = new Map<string, typeof items>();
                for (const it of items) {
                  const k = (it.room || "").trim() || "Unassigned";
                  if (!groups.has(k)) groups.set(k, [] as any);
                  groups.get(k)!.push(it);
                }
                // Stable order: known rooms in first-appearance order, then "Unassigned" last.
                const keys = Array.from(groups.keys()).sort((a, b) => {
                  if (a === "Unassigned") return 1;
                  if (b === "Unassigned") return -1;
                  return 0;
                });
                return keys.map((roomKey) => {
                  const groupItems = groups.get(roomKey)!;
                  const groupSubtotal = groupItems.reduce((sum, it) => {
                    const p = it.trade_products;
                    const raw = it.unit_price_cents ?? catalogSourcePriceCents(it) ?? null;
                    const fc = it.unit_price_cents != null ? currency : (p?.currency || currency);
                    const u = convertCents(raw, fc, currency);
                    return sum + (u ? u * it.quantity : 0);
                  }, 0);
                  return (
                    <div key={roomKey} className="border-t border-border first:border-t-0">
                      <div className="flex items-center justify-between gap-3 pt-4 pb-2">
                        <h3 className="font-display text-[11px] md:text-xs text-foreground uppercase tracking-widest">
                          {roomKey}
                          <span className="ml-2 font-body text-[10px] text-muted-foreground normal-case tracking-normal">
                            · {groupItems.length} {groupItems.length === 1 ? "item" : "items"}
                          </span>
                        </h3>
                        <span className="font-body text-[10px] md:text-[11px] text-muted-foreground tabular-nums">
                          {groupSubtotal > 0 ? `${currencySymbol(currency)} ${formatPriceRaw(groupSubtotal, currency)}` : ""}
                        </span>
                      </div>
                      <div className="divide-y divide-border">
                        {groupItems.map((item) => {
                  const product = item.trade_products;
                  const rawUnitPrice = item.unit_price_cents ?? catalogSourcePriceCents(item) ?? null;
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
                          {item.variant_label && <p className="font-body text-[10px] md:text-[11px] text-foreground/90 mt-1 break-words"><span className="text-muted-foreground">Finish:</span> {item.variant_label}</p>}
                          {product?.dimensions && !(item.variant_label && item.variant_label.toLowerCase().includes(String(product.dimensions).toLowerCase().slice(0, 8))) && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground mt-1 break-words">{product.dimensions}</p>}
                          {!item.variant_label && product?.materials && <p className="font-body text-[10px] md:text-[11px] text-muted-foreground break-words">{product.materials}</p>}
                          {item.edition && <p className="font-body text-[10px] md:text-[11px] text-foreground/80 italic mt-0.5 break-words">Edition: {String(item.edition).replace(/^edition\s*[:\-—]?\s*/i, "").trim()}</p>}
                          {(() => {
                            const ov = getLeadWeeksOverride(item.lead_time_weeks_override);
                            if (ov === 0) return <p className="font-body text-[10px] md:text-[11px] text-emerald-700 font-medium break-words">In stock</p>;
                            if (ov && ov > 0) return <p className="font-body text-[10px] md:text-[11px] text-muted-foreground break-words">{ov} weeks</p>;
                            return product?.lead_time ? <p className="font-body text-[10px] md:text-[11px] text-muted-foreground break-words">{product.lead_time}</p> : null;
                          })()}
                          {editingNotesId === item.id ? (
                            <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                ref={notesTextareaRef}
                                rows={2}
                                value={editingNotesValue}
                                onChange={(e) => setEditingNotesValue(e.target.value)}
                                onBlur={() => commitEditNotes(item.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault();
                                    commitEditNotes(item.id);
                                  } else if (e.key === "Escape") {
                                    cancelEditNotes();
                                  }
                                }}
                                placeholder="Exception or spec note…"
                                className="w-full font-body text-[11px] text-foreground bg-background border border-border rounded px-2 py-1.5 focus:border-foreground/50 outline-none resize-y"
                                autoFocus
                              />
                              <span className="font-body text-[9px] text-muted-foreground/60">Ctrl+Enter to save · Esc to cancel</span>
                            </div>
                          ) : (
                            <>
                              {item.notes ? (
                                <button
                                  onClick={() => canEditLines ? startEditNotes(item.id, item.notes) : undefined}
                                  className={`block text-left w-full font-body text-[10px] md:text-[11px] text-muted-foreground/70 italic mt-1 break-words ${canEditLines ? "cursor-text hover:text-muted-foreground" : ""}`}
                                  title={canEditLines ? "Click to edit notes" : undefined}
                                >
                                  {item.notes}
                                </button>
                              ) : canEditLines ? (
                                <button
                                  onClick={() => startEditNotes(item.id, item.notes)}
                                  className="inline-flex items-center gap-1 font-body text-[10px] text-muted-foreground/60 hover:text-muted-foreground mt-1.5 transition-colors"
                                >
                                  <Edit3 className="h-3 w-3" /> Add notes
                                </button>
                              ) : null}
                            </>
                          )}
                          {(() => {
                            const internalNotes = (item as any).internal_notes as string | null | undefined;
                            if (editingInternalNotesId === item.id) {
                              return (
                                <div className="mt-1.5 rounded border border-amber-500/30 bg-amber-500/5 p-1.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1 mb-1">
                                    <Lock className="h-2.5 w-2.5 text-amber-600" />
                                    <span className="font-body text-[9px] uppercase tracking-wider text-amber-700">Internal note · not shown to client</span>
                                  </div>
                                  <textarea
                                    ref={internalNotesTextareaRef}
                                    rows={2}
                                    value={editingInternalNotesValue}
                                    onChange={(e) => setEditingInternalNotesValue(e.target.value)}
                                    onBlur={() => commitEditInternalNotes(item.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        commitEditInternalNotes(item.id);
                                      } else if (e.key === "Escape") {
                                        cancelEditInternalNotes();
                                      }
                                    }}
                                    placeholder="Private exception, margin note, supplier issue…"
                                    className="w-full font-body text-[11px] text-foreground bg-background border border-amber-500/30 rounded px-2 py-1.5 focus:border-amber-500/60 outline-none resize-y"
                                    autoFocus
                                  />
                                  <span className="font-body text-[9px] text-muted-foreground/60">Ctrl+Enter to save · Esc to cancel</span>
                                </div>
                              );
                            }
                            if (internalNotes) {
                              return (
                                <button
                                  onClick={() => canEditLines ? startEditInternalNotes(item.id, internalNotes) : undefined}
                                  className={`mt-1.5 flex items-start gap-1 text-left w-full rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-1 ${canEditLines ? "cursor-text hover:bg-amber-500/10" : ""}`}
                                  title={canEditLines ? "Internal note — click to edit" : "Internal note"}
                                >
                                  <Lock className="h-2.5 w-2.5 text-amber-600 mt-0.5 shrink-0" />
                                  <span className="font-body text-[10px] md:text-[11px] text-amber-900/80 italic break-words">{internalNotes}</span>
                                </button>
                              );
                            }
                            if (canEditLines) {
                              return (
                                <button
                                  onClick={() => startEditInternalNotes(item.id, null)}
                                  className="inline-flex items-center gap-1 font-body text-[10px] text-amber-700/70 hover:text-amber-700 mt-1.5 transition-colors"
                                >
                                  <Lock className="h-3 w-3" /> Add internal note
                                </button>
                              );
                            }
                            return null;
                          })()}
                          {canEditLines && (
                            <button onClick={() => handleRemoveItem(item.id)} className="inline-flex items-center gap-1 font-body text-[10px] text-destructive hover:text-destructive/80 mt-1.5 md:mt-2 transition-colors">
                              <Trash2 className="h-3 w-3" /> Remove
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Mobile: qty + prices in a row */}
                      <div className="flex items-center justify-between mt-2 md:hidden">
                        <div className="flex items-center gap-1">
                          {canEditLines ? (
                            <>
                              <button onClick={() => item.quantity <= 1 ? handleRemoveItem(item.id) : handleUpdateQuantity(item.id, item.quantity - 1)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" aria-label={item.quantity <= 1 ? "Remove item" : "Decrease quantity"} title={item.quantity <= 1 ? "Remove item" : "Decrease quantity"}>
                                {item.quantity <= 1 ? <Trash2 className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3" />}
                              </button>
                              {editingQtyId === item.id ? (
                                <div className="flex flex-col items-center">
                                  <input
                                    ref={qtyInputRef}
                                    type="text"
                                    inputMode="numeric"
                                    value={editingQtyValue}
                                    onChange={(e) => { setEditingQtyValue(e.target.value.replace(/\D/g, "")); setEditingQtyError(null); }}
                                    onBlur={() => commitEditQty(item.id)}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitEditQty(item.id); } else if (e.key === "Escape") { cancelEditQty(); } }}
                                    className={`font-body text-xs text-foreground w-8 text-center bg-background border rounded px-1 py-0.5 focus:border-foreground/50 outline-none ${editingQtyError ? "border-destructive" : "border-border"}`}
                                    autoFocus
                                  />
                                  {editingQtyError && <span className="font-body text-[9px] text-destructive mt-0.5">{editingQtyError}</span>}
                                </div>
                              ) : (
                                <button onClick={() => startEditQty(item.id, item.quantity)} className="font-body text-xs text-foreground w-6 text-center cursor-text" title="Click to edit quantity">
                                  {item.quantity}
                                </button>
                              )}
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
                        {canEditLines ? (
                          <>
                            <button onClick={() => item.quantity <= 1 ? handleRemoveItem(item.id) : handleUpdateQuantity(item.id, item.quantity - 1)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" aria-label={item.quantity <= 1 ? "Remove item" : "Decrease quantity"} title={item.quantity <= 1 ? "Remove item" : "Decrease quantity"}>
                              {item.quantity <= 1 ? <Trash2 className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3" />}
                            </button>
                            {editingQtyId === item.id ? (
                              <div className="flex flex-col items-center">
                                <input
                                  ref={qtyInputRef}
                                  type="text"
                                  inputMode="numeric"
                                  value={editingQtyValue}
                                  onChange={(e) => { setEditingQtyValue(e.target.value.replace(/\D/g, "")); setEditingQtyError(null); }}
                                  onBlur={() => commitEditQty(item.id)}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitEditQty(item.id); } else if (e.key === "Escape") { cancelEditQty(); } }}
                                  className={`font-body text-sm text-foreground w-10 text-center bg-background border rounded px-1 py-0.5 focus:border-foreground/50 outline-none ${editingQtyError ? "border-destructive" : "border-border"}`}
                                  autoFocus
                                />
                                {editingQtyError && <span className="font-body text-[9px] text-destructive mt-0.5">{editingQtyError}</span>}
                              </div>
                            ) : (
                              <button onClick={() => startEditQty(item.id, item.quantity)} className="font-body text-sm text-foreground w-8 text-center cursor-text" title="Click to edit quantity">
                                {item.quantity}
                              </button>
                            )}
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
                      </div>
                      <div className="hidden md:block text-right">
                        <span className="font-body text-sm text-foreground font-medium tabular-nums">
                          {lineTotal ? `${currencySymbol(currency)} ${formatPriceRaw(lineTotal, currency)}` : "TBD"}
                        </span>
                      </div>

                      {/* Procurement metadata — editable on draft/priced quotes, read-only otherwise */}
                      <div className="md:col-span-4 mt-2 md:mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 print:hidden">
                        <label className="flex flex-col gap-0.5">
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">Room</span>
                          <input
                            type="text"
                            defaultValue={item.room || ""}
                            placeholder="e.g. Living Room"
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            tabIndex={isReadOnly ? -1 : 0}
                            aria-disabled={isReadOnly}
                            list={`rooms-${quoteId}`}
                            onBlur={(e) => {
                              if (isReadOnly) return;
                              const v = e.target.value.trim();
                              if (v !== (item.room || "")) updateItemField(item.id, { room: v || null });
                            }}
                            className="font-body text-[11px] text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
                          />
                        </label>
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
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">Lead (wks · 0 = stock)</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              key={`lead-${item.id}-${item.lead_time_weeks_override ?? "none"}`}
                              defaultValue={getLeadWeeksOverride(item.lead_time_weeks_override) ?? ""}
                              placeholder={parseLeadWeeks(product?.lead_time || null)?.toString() ?? "—"}
                              disabled={isReadOnly}
                              readOnly={isReadOnly}
                              tabIndex={isReadOnly ? -1 : 0}
                              aria-disabled={isReadOnly}
                              onBlur={(e) => {
                                if (isReadOnly) return;
                                const raw = e.target.value.trim();
                                const parsed = raw === "" ? null : parseInt(raw, 10);
                                const v = parsed != null && parsed >= 0 ? parsed : null;
                                if (v !== getLeadWeeksOverride(item.lead_time_weeks_override)) updateItemField(item.id, { lead_time_weeks_override: v });
                              }}
                              className="flex-1 min-w-0 font-body text-[11px] text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none tabular-nums"
                            />
                            <button
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => {
                                if (isReadOnly) return;
                                const next = item.lead_time_weeks_override === 0 ? null : 0;
                                updateItemField(item.id, { lead_time_weeks_override: next });
                              }}
                              title="Mark as in stock"
                              className={cn(
                                "shrink-0 font-body text-[9px] uppercase tracking-widest px-1.5 py-1 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                item.lead_time_weeks_override === 0
                                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                  : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
                              )}
                            >
                              Stock
                            </button>
                          </div>
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

                      {/* Per-line shipping — origin / mode / CBM / weight. Defaults inherit from product.origin and destination mode. */}
                      <div className="md:col-span-4 mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 print:hidden">
                        <label className="flex flex-col gap-0.5">
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">Ship From</span>
                          <input
                            type="text"
                            maxLength={2}
                            defaultValue={item.ship_origin_country || ""}
                            placeholder={(product?.origin || "FR").toString().slice(0, 2).toUpperCase()}
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            onBlur={(e) => {
                              if (isReadOnly) return;
                              const v = e.target.value.trim().toUpperCase().slice(0, 2);
                              const next = v || null;
                              if (next !== item.ship_origin_country) updateItemField(item.id, { ship_origin_country: next });
                            }}
                            className="font-body text-[11px] uppercase text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">Mode</span>
                          <select
                            value={item.ship_mode || ""}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              if (isReadOnly) return;
                              const v = e.target.value || null;
                              if (v !== item.ship_mode) updateItemField(item.id, { ship_mode: v });
                            }}
                            className="font-body text-[11px] text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <option value="">Auto</option>
                            <option value="road">Road</option>
                            <option value="sea_lcl">Sea LCL</option>
                            <option value="sea_fcl">Sea FCL</option>
                            <option value="air">Air freight</option>
                            <option value="courier">Courier</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">CBM / unit</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            defaultValue={item.ship_cbm != null ? Number(item.ship_cbm) : ""}
                            placeholder="0.50"
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            onBlur={(e) => {
                              if (isReadOnly) return;
                              const raw = e.target.value.trim();
                              const v = raw === "" ? null : Math.max(0, parseFloat(raw));
                              if (v !== (item.ship_cbm != null ? Number(item.ship_cbm) : null)) updateItemField(item.id, { ship_cbm: v });
                            }}
                            className="font-body text-[11px] text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed tabular-nums"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="font-body text-[9px] text-muted-foreground/70 uppercase tracking-widest">Kg / unit</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={item.ship_weight_kg != null ? Number(item.ship_weight_kg) : ""}
                            placeholder="auto"
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            onBlur={(e) => {
                              if (isReadOnly) return;
                              const raw = e.target.value.trim();
                              const v = raw === "" ? null : Math.max(0, parseFloat(raw));
                              if (v !== (item.ship_weight_kg != null ? Number(item.ship_weight_kg) : null)) updateItemField(item.id, { ship_weight_kg: v });
                            }}
                            className="font-body text-[11px] text-foreground bg-transparent border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none disabled:opacity-60 disabled:cursor-not-allowed tabular-nums"
                          />
                        </label>
                      </div>
                    </div>
                  );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Add another product to this quote */}
              <div className="border-t border-dashed border-border mt-3 pt-4 print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block font-body text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                      Add another product
                    </label>
                    <AlphabetProductPicker
                      items={productOptions}
                      value={pendingProductId}
                      onChange={setPendingProductId}
                      placeholder={productOptions.length === 0 ? "Loading catalogue…" : "Pick a product (A → Designer → Item)"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddProduct(pendingProductId)}
                    disabled={!pendingProductId || addingProduct}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-background rounded-md font-body text-xs uppercase tracking-wider hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {addingProduct ? <DotCircleLoader size="sm" className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    Add to quote
                  </button>
                </div>
                <p className="font-body text-[10px] text-muted-foreground/70 mt-1.5">
                  Forgot a piece? Add it here without leaving the quote — quantity, price and PO can be edited above.
                </p>
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

              {/* Additional charges (crating, surcharges, manual fees) */}
              <QuoteExtrasEditor
                quoteId={quoteId}
                currency={currency}
                isReadOnly={isReadOnly}
                onTotalChange={setExtrasTotalCents}
              />

              {/* Totals */}
              <div className="border-t border-border mt-2 pt-4">
                {subtotalCents > 0 && isUkDestination && (
                  <div className="flex justify-end">
                    <div className="w-72">
                      <QuoteDisplayCurrencyToggle
                        value={displayCcy}
                        onChange={setDisplayCcy}
                        quoteCurrency={currency}
                        disabled={displayCcy === "quote" ? false : !gbp.ready}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  {displayCcy === "gbp" && subtotalCents > 0 && isUkDestination ? (
                    <div className="w-72 space-y-1">
                      <div className="flex justify-between font-body text-xs text-muted-foreground">
                        <span>Goods (after discount)</span>
                        <span>{gbp.ready ? fmtGbp(gbp.goodsGbpCents) : "…"}</span>
                      </div>
                      <div className="flex justify-between font-body text-xs text-muted-foreground">
                        <span>Shipping FR → GB</span>
                        <span>{gbp.ready ? fmtGbp(gbp.shippingGbpCents) : "…"}</span>
                      </div>
                      {gbp.dutyGbpCents > 0 && (
                        <div className="flex justify-between font-body text-xs text-muted-foreground">
                          <span>Import duty</span>
                          <span>{fmtGbp(gbp.dutyGbpCents)}</span>
                        </div>
                      )}
                      {gbp.vatGbpCents > 0 && (
                        <div className="flex justify-between font-body text-xs text-muted-foreground">
                          <span>UK VAT</span>
                          <span>{fmtGbp(gbp.vatGbpCents)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-display text-sm text-foreground pt-2 border-t border-border">
                        <span className="uppercase tracking-wider">Total GBP · DDP London</span>
                        <span className="font-medium">{gbp.ready ? fmtGbp(gbp.totalGbpCents) : "…"}</span>
                      </div>
                      <p className="font-body text-[10px] text-muted-foreground/80 leading-relaxed pt-1">
                        Indicative. EUR→GBP @ {gbp.fxEurGbp?.toFixed(4)} (+2% FX buffer). DDP — UK customs, duty &amp; VAT included. Payments &amp; deposits remain in {currency}.
                      </p>
                      {gbp.fxIsFallback && (
                        <p className="font-body text-[10px] text-amber-700 leading-relaxed">
                          ⚠ Live FX unavailable — figures use a fallback indicative rate. Treat the GBP total as approximate (≈).
                        </p>
                      )}
                    </div>
                  ) : (
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
                      const goodsTotal = gstEnabled && taxable > 0
                        ? taxable + Math.round(taxable * gstRate / 100)
                        : taxable;
                      const shippingQuoteCents = (fxQuoteEur && perLine.totalShippingEurCents > 0)
                        ? Math.round(perLine.totalShippingEurCents / fxQuoteEur)
                        : 0;
                      const total = goodsTotal + shippingQuoteCents + extrasTotalCents;
                      const depositCents = Math.round(total * 0.6);
                      const balanceCents = total - depositCents;
                      return (
                        <>
                          {shippingQuoteCents > 0 && (
                            <div className="flex justify-between font-body text-xs text-muted-foreground">
                              <span>Shipping (estimate, {perLine.shipments.length} shipment{perLine.shipments.length > 1 ? "s" : ""})</span>
                              <span>{formatPriceRaw(shippingQuoteCents, currency)}</span>
                            </div>
                          )}
                          {extrasTotalCents > 0 && (
                            <div className="flex justify-between font-body text-xs text-muted-foreground">
                              <span>Additional charges</span>
                              <span>{formatPriceRaw(extrasTotalCents, currency)}</span>
                            </div>
                          )}
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
                              {shippingQuoteCents > 0 && (
                                <p className="font-body text-[10px] text-muted-foreground leading-relaxed pt-1.5 italic">
                                  Shipping &amp; FX are estimates valid today. Final freight is re-quoted with live carrier rates and FX ~2 weeks before delivery; any variance is settled with the balance invoice.
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  )}
                </div>
                {subtotalCents > 0 && destIso && perLine.shipments.length > 0 && (
                  <div className="mt-4">
                    <PerOriginShippingRecap
                      result={perLine}
                      destCountry={destIso}
                      loading={perLineLoading}
                    />
                  </div>
                )}


                {/* UK landed cost (DDP, GBP) — only shown when the linked client's billing country is UK */}
                {subtotalCents > 0 && isUkDestination && (
                  <div className="mt-4">
                    <UkLandedCostPanel
                      goodsAfterDiscountCents={
                        tradeDiscount
                          ? subtotalCents - Math.round(subtotalCents * tradeDiscountPct)
                          : subtotalCents
                      }
                      quoteCurrency={currency}
                      defaultExpanded={false}
                      quoteRef={quoteNumber}
                      clientName={clientName || null}
                      initialCbm={landedCostSettings.cbm}
                      initialKg={landedCostSettings.kg}
                      initialMode={landedCostSettings.mode}
                      onSettingsChange={handleLandedCostSettingsChange}
                      overrideShipping={overrideShipping}
                      extrasQuoteCents={extrasTotalCents}
                    />
                  </div>
                )}
                {subtotalCents > 0 && isHkDestination && (
                  <div className="mt-4">
                    <HkLandedCostPanel
                      goodsAfterDiscountCents={
                        tradeDiscount
                          ? subtotalCents - Math.round(subtotalCents * tradeDiscountPct)
                          : subtotalCents
                      }
                      quoteCurrency={currency}
                      defaultExpanded={false}
                      quoteRef={quoteNumber}
                      clientName={clientName || null}
                      initialCbm={hkLandedSettings.cbm}
                      initialKg={hkLandedSettings.kg}
                      initialMode={hkLandedSettings.mode}
                      onSettingsChange={handleHkLandedSettingsChange}
                      overrideShipping={overrideShipping}
                      extrasQuoteCents={extrasTotalCents}
                      shipmentOrigins={perLine.shipments.map((s) => ({
                        country: s.origin,
                        modeLabel: labelForMode(s.mode),
                        totalCbm: s.totalCbm,
                        totalKg: s.totalKg,
                        eurCents: s.shippingEurCents + s.dutyEurCents + s.vatEurCents,
                      }))}
                    />
                  </div>
                )}
                {subtotalCents > 0 && !clientCountry && !isHkDestination && !isUkDestination && (
                  <div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Select a delivery country</p>
                    <p className="mt-1">
                      Add a billing country to the linked client (or fill in a ship-to country) to calculate landed costs (UK DDP in GBP, HK DAP in HKD, …).
                      Until then, destination-specific duties and taxes can't be estimated.
                    </p>
                  </div>
                )}

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
                onBlur={handleSaveNotes}
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
              <p className="font-medium text-foreground">AFFLUENCY ETC PTE LTD</p>
              <p>1 Grange Garden, #16-05, Singapore, 249631, Singapore</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="font-body text-[10px] md:text-[11px] leading-relaxed text-foreground/80 space-y-0.5">
                <p className="font-medium text-foreground uppercase tracking-wider text-[9px] md:text-[10px]">Main · EUR (SEPA)</p>
                <p>IBAN: LT73 3250 0692 1856 8740</p>
                <p>BIC: REVOLT21</p>
                <p>Bank: Revolut Bank UAB</p>
                <p className="text-muted-foreground">Konstitucijos ave. 21B, 08130, Vilnius, Lithuania</p>
              </div>
              <div className="font-body text-[10px] md:text-[11px] leading-relaxed text-foreground/80 space-y-0.5">
                <p className="font-medium text-foreground uppercase tracking-wider text-[9px] md:text-[10px]">Global · SWIFT (outside EEA)</p>
                <p>Account: 885111609218375</p>
                <p>SWIFT/BIC: REVOSGS2</p>
                <p>Intermediary BIC: BARCDEFF</p>
                <p>Bank: Revolut Technologies Singapore Pte. Ltd</p>
                <p className="text-muted-foreground">6 Battery Road, Floor 6-01, 049909, Singapore</p>
              </div>
            </div>
            <p className="font-body text-[9px] md:text-[10px] text-muted-foreground italic mt-2">
              Please reference the quote number on your transfer. EUR transfers preferred to avoid FX conversion.
            </p>
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

        {/* Request changes / Cancel — shown for submitted or priced quotes */}
        {(quoteStatus === "submitted" || quoteStatus === "priced") && (
          <div className="border-t border-border p-4 md:p-6 lg:p-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <p className="font-body text-[10px] text-muted-foreground max-w-xs">
              {isSuperAdmin
                ? "Reopen as draft to edit lines directly on the client's behalf — the quote returns to draft and can be re-priced after."
                : "Need adjustments? Request changes reopens the quote as a draft with your note attached for our team."}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setCancelOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-destructive/30 text-destructive font-body text-[10px] uppercase tracking-[0.1em] rounded-md hover:bg-destructive/10 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel Quote
              </button>
              <button
                onClick={handleCancelAndRecreate}
                disabled={recreating}
                title="Cancel this quote and open a fresh draft pre-filled with the same lines, client, ship-to and Incoterm."
                className="inline-flex items-center gap-2 px-3 py-2 border border-border font-body text-[10px] uppercase tracking-[0.1em] rounded-md hover:bg-muted transition-colors text-foreground disabled:opacity-50"
              >
                {recreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                {recreating ? "Recreating…" : "Cancel & Recreate"}
              </button>
              <button
                onClick={() => setReviseOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 border border-border font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-muted transition-colors text-foreground"
              >
                <Edit3 className="h-3.5 w-3.5" /> {isSuperAdmin ? "Reopen as Draft" : "Request Changes"}
              </button>
            </div>
          </div>
        )}

        {isPriced && (() => {
          const afterDiscount = tradeDiscount && subtotalCents > 0 ? subtotalCents - Math.round(subtotalCents * tradeDiscountPct) : subtotalCents;
          const withGst = gstEnabled && afterDiscount > 0 ? afterDiscount + Math.round(afterDiscount * gstRate / 100) : afterDiscount;
          const shippingQuoteCents = (fxQuoteEur && perLine.totalShippingEurCents > 0)
            ? Math.round(perLine.totalShippingEurCents / fxQuoteEur)
            : 0;
          const orderTotal = withGst + shippingQuoteCents;
          const depositCents = Math.round(orderTotal * 0.6);
          const fixedFees: Record<string, number> = { SGD: 50, USD: 30, EUR: 25, GBP: 20 };
          const fixedFee = fixedFees[currency] ?? 50;
          const chargeTotal = Math.ceil((depositCents + fixedFee) / (1 - 0.034));
          return (
            <div className="border-t border-border p-4 md:p-6 lg:p-8 print:hidden space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-display text-xs uppercase tracking-[0.15em] text-foreground">Confirm &amp; Pay</p>
                    <StatusBadge />
                  </div>
                  <p className="font-body text-[11px] text-muted-foreground">
                    Pay your 60% deposit by card to confirm this order, or click Confirm Order to pay later by bank transfer.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  {subtotalCents > 0 && (
                    <button
                      onClick={() => handleStripePayment("deposit")}
                      disabled={payingStripe}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50"
                    >
                      {payingStripe ? <DotCircleLoader size="sm" className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                      {payingStripe ? "Redirecting…" : "Pay 60% Deposit"}
                    </button>
                  )}
                  <button
                    onClick={handleConfirmOrder}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-foreground text-foreground font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/5 transition-colors"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Confirm Order
                  </button>
                </div>
              </div>
              {subtotalCents > 0 && (() => {
                const sym = currencySymbol(currency);
                const fmt = (c: number) => `${sym}${formatPriceRaw(c, currency)}`;
                const discountCents = tradeDiscount ? Math.round(subtotalCents * tradeDiscountPct) : 0;
                const gstCents = gstEnabled ? Math.round(afterDiscount * gstRate / 100) : 0;
                const processingFee = chargeTotal - depositCents;
                const Row = ({ label, value, strong = false, muted = false }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean }) => (
                  <div className={`flex items-baseline justify-between gap-4 ${strong ? "font-medium text-foreground" : muted ? "text-muted-foreground" : "text-foreground/80"}`}>
                    <span>{label}</span>
                    <span className="tabular-nums">{value}</span>
                  </div>
                );
                return (
                  <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                    <p className="font-display text-[10px] uppercase tracking-[0.15em] text-foreground/70 mb-2">60% Deposit Breakdown</p>
                    <div className="font-body text-[11px] space-y-1">
                      <Row label="Item subtotal" value={`${fmt(subtotalCents)} ${currency}`} />
                      {tradeDiscount && discountCents > 0 && (
                        <Row label={`Trade discount (${Math.round(tradeDiscountPct * 100)}%)`} value={`− ${fmt(discountCents)} ${currency}`} muted />
                      )}
                      <Row label="Net subtotal" value={`${fmt(afterDiscount)} ${currency}`} />
                      {gstEnabled && (
                        <Row label={`GST (${gstRate}%)`} value={`+ ${fmt(gstCents)} ${currency}`} muted />
                      )}
                      {shippingQuoteCents > 0 && (
                        <Row label={`Shipping estimate (${perLine.shipments.length} shipment${perLine.shipments.length > 1 ? "s" : ""})`} value={`+ ${fmt(shippingQuoteCents)} ${currency}`} muted />
                      )}
                      <div className="border-t border-border my-1.5" />
                      <Row label="Order total" value={`${fmt(orderTotal)} ${currency}`} strong />
                      <Row label="60% deposit due now" value={`${fmt(depositCents)} ${currency}`} strong />
                      <div className="border-t border-border my-1.5" />
                      <Row label="Stripe processing fee (3.4% + fixed)" value={`+ ${fmt(processingFee)} ${currency}`} muted />
                      <Row label="Total charge to your card" value={`${fmt(chargeTotal)} ${currency}`} strong />
                    </div>
                    {shippingQuoteCents > 0 && (
                      <p className="font-body text-[10px] text-muted-foreground mt-2 leading-relaxed">
                        <strong className="text-foreground/70">Note on shipping &amp; FX:</strong> the freight figure above reflects today's carrier rates and FX. Production lead times run 18–20 weeks, during which rates and exchange rates will move. Two weeks before delivery we'll re-quote freight at the live rate and email you a balance invoice reflecting any difference. The 40% balance is therefore indicative until that point.
                      </p>
                    )}
                    <p className="font-body text-[10px] text-muted-foreground mt-2 leading-relaxed">
                      Card-denominated foreign transaction fees (~1–2%) may apply separately. To avoid the processing fee, pay {fmt(depositCents)} {currency} via bank transfer using the details above.
                    </p>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {isConfirmed && !isFullyPaid && (() => {
          const afterDiscount = tradeDiscount && subtotalCents > 0 ? subtotalCents - Math.round(subtotalCents * tradeDiscountPct) : subtotalCents;
          const withGst = gstEnabled && afterDiscount > 0
            ? afterDiscount + Math.round(afterDiscount * gstRate / 100)
            : afterDiscount;
          const shippingQuoteCents = (fxQuoteEur && perLine.totalShippingEurCents > 0)
            ? Math.round(perLine.totalShippingEurCents / fxQuoteEur)
            : 0;
          const orderTotal = withGst + shippingQuoteCents;

          const isPayingDeposit = quoteStatus === "confirmed";
          const isPayingBalance = quoteStatus === "deposit_paid";
          const portionCents = isPayingDeposit ? Math.round(orderTotal * 0.6) : Math.round(orderTotal * 0.4);
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
                    <StatusBadge />
                  </div>
                  {isPayingBalance && (
                    <p className="font-body text-[10px] text-muted-foreground">
                      60% deposit received. Please pay the remaining 40% balance to complete your order.
                      {shippingQuoteCents > 0 && " Freight has been re-quoted at live rates; the balance below reflects the final figure."}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => handleStripePayment(paymentType)}
                    disabled={payingStripe}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    {payingStripe ? <DotCircleLoader size="sm" className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
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
                    <li>You are paying the <span className="font-medium text-foreground/70">{isPayingDeposit ? "60% deposit" : "40% balance"}</span> of {currencySymbol(currency)}{formatPriceRaw(portionCents, currency)} {currency} (on an order total of {currencySymbol(currency)}{formatPriceRaw(orderTotal, currency)} {currency}{shippingQuoteCents > 0 ? ", goods + shipping" : ""}).</li>
                    <li>A processing fee of 3.4% + {feeDisplay} is included in the Stripe charge above.</li>
                    {gstEnabled && <li>{gstRate}% GST is included.</li>}
                    {isPayingDeposit && shippingQuoteCents > 0 && (
                      <li>Shipping &amp; FX shown are estimates. Two weeks before delivery we'll re-quote freight at live carrier rates and FX, then email you the adjusted balance invoice.</li>
                    )}
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
              <StatusBadge />
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

      {/* Request changes dialog */}
      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base">{isSuperAdmin ? "Reopen as draft" : "Request changes"}</DialogTitle>
          </DialogHeader>
          <p className="font-body text-xs text-muted-foreground">
            {isSuperAdmin
              ? "Reopen this quote as a draft so you can edit lines on the client's behalf. Optionally log a note for the audit trail."
              : "Tell our team what you'd like adjusted. The quote will be reopened as a draft and your note attached for the concierge."}
          </p>
          <textarea
            value={reviseReason}
            onChange={(e) => setReviseReason(e.target.value)}
            rows={5}
            placeholder={isSuperAdmin
              ? "Optional — e.g. Client called to remove all items except Lady Bud side table."
              : "e.g. Please swap the sofa for the linen variant and remove item 3…"}
            className="w-full border border-border rounded-md p-3 font-body text-sm focus:outline-none focus:border-primary"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setReviseOpen(false)} className="px-3 py-1.5 border border-border rounded-md font-body text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleSubmitRevise} className="px-3 py-1.5 bg-foreground text-background rounded-md font-body text-xs hover:opacity-90">{isSuperAdmin ? "Reopen as draft" : "Send & reopen as draft"}</button>
          </div>
        </DialogContent>
      </Dialog>


      {/* Cancel quote dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Cancel this quote?</DialogTitle>
          </DialogHeader>
          <p className="font-body text-xs text-muted-foreground">
            This marks the quote as cancelled. Please share a brief reason so our team can follow up appropriately.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={4}
            placeholder="e.g. Project on hold, client changed direction…"
            className="w-full border border-border rounded-md p-3 font-body text-sm focus:outline-none focus:border-primary"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCancelOpen(false)} className="px-3 py-1.5 border border-border rounded-md font-body text-xs hover:bg-muted">Keep quote</button>
            <button onClick={handleSubmitCancel} className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md font-body text-xs hover:opacity-90">Cancel quote</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF preview dialog */}
      <Dialog open={previewOpen} onOpenChange={(o) => { if (!o) closePreview(); else setPreviewOpen(true); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle className="font-body text-sm">PDF preview · {quoteNumber}</DialogTitle>
          </DialogHeader>
          {previewError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center font-body text-xs text-muted-foreground bg-muted/20">
              <p className="text-destructive">Preview failed.</p>
              <p>{previewError}</p>
            </div>
          ) : (
            <QuotePdfPreviewPages blobUrl={previewUrl} />
          )}
          <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
            <button
              onClick={closePreview}
              className="px-3 py-1.5 border border-border rounded-md font-body text-xs text-foreground hover:bg-muted"
            >
              Close
            </button>
            <button
              onClick={async () => { await handleDownloadPdf(); }}
              className="px-3 py-1.5 bg-foreground text-background rounded-md font-body text-xs hover:opacity-90"
            >
              Download
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email preview & confirm dialog */}
      <Dialog
        open={emailPreviewOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEmailPreviewOpen(false);
            if (emailPreviewUrl) URL.revokeObjectURL(emailPreviewUrl);
            setEmailPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle className="font-body text-sm">Send quote · {quoteNumber}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="grid grid-cols-[80px_1fr] gap-y-2 gap-x-3 items-baseline font-body text-xs">
              <span className="uppercase tracking-[0.12em] text-muted-foreground">From</span>
              <span className="text-foreground">Maison Affluency &lt;notify@maisonaffluency.com&gt;</span>
              <span className="uppercase tracking-[0.12em] text-muted-foreground">To</span>
              <div>
                <span className="text-foreground">{clientName ? `${clientName} <${clientApproval.email ?? "—"}>` : (clientApproval.email ?? "—")}</span>
                {(() => {
                  const email = (clientApproval.email ?? "").trim();
                  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
                  if (!email) return <p className="mt-1 text-destructive text-[11px]">No recipient email on file for this client.</p>;
                  if (!ok) return <p className="mt-1 text-destructive text-[11px]">Recipient email is not a valid address.</p>;
                  return null;
                })()}
              </div>
              <span className="uppercase tracking-[0.12em] text-muted-foreground">Subject</span>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full border border-border rounded-md px-2 py-1.5 text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="uppercase tracking-[0.12em] text-muted-foreground pt-1">Message</span>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={7}
                className="w-full border border-border rounded-md px-2 py-1.5 text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-ring font-body text-xs leading-relaxed resize-y"
              />
              <span className="uppercase tracking-[0.12em] text-muted-foreground">Attachment</span>
              <a
                href={emailPreviewUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-1"
              >
                <Printer className="h-3.5 w-3.5" /> {quoteNumber}.pdf
              </a>
            </div>
            <div className="border border-border rounded-md overflow-hidden bg-muted/20" style={{ height: "45vh" }}>
              {emailPreviewUrl ? (
                <iframe src={emailPreviewUrl} title="Quote PDF preview" className="w-full h-full" />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Loading preview…</div>
              )}
            </div>
          </div>
          <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
            <button
              onClick={() => {
                setEmailPreviewOpen(false);
                if (emailPreviewUrl) URL.revokeObjectURL(emailPreviewUrl);
                setEmailPreviewUrl(null);
              }}
              className="px-3 py-1.5 border border-border rounded-md font-body text-xs text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              disabled={(() => {
                const email = (clientApproval.email ?? "").trim();
                const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
                return sendingEmail || !validEmail || !emailSubject.trim();
              })()}
              onClick={async () => {
                if (sendingEmail) return;
                setSendingEmail(true);
                try {
                  const { data: u } = await supabase.auth.getUser();
                  const uid = u?.user?.id;
                  const uemail = u?.user?.email ?? null;
                  if (!uid) throw new Error("Not authenticated");
                  const { error } = await (supabase as any).from("quote_email_log").insert({
                    quote_id: quoteId,
                    sent_by: uid,
                    sent_by_email: uemail,
                    recipient_email: clientApproval.email,
                    client_id: clientId,
                    note: `Subject: ${emailSubject}`,
                  });
                  if (error) throw error;
                  await loadEmailLog();
                  toast({
                    title: "Logged email send",
                    description: `Recorded send of ${quoteNumber} to ${clientApproval.email}.`,
                  });
                  setEmailPreviewOpen(false);
                  if (emailPreviewUrl) URL.revokeObjectURL(emailPreviewUrl);
                  setEmailPreviewUrl(null);
                } catch (err: any) {
                  toast({ title: "Could not log email", description: err?.message ?? "Unknown error", variant: "destructive" });
                } finally {
                  setSendingEmail(false);
                }
              }}
              className="px-3 py-1.5 bg-foreground text-background rounded-md font-body text-xs hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuoteDetail;
