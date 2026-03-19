import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

// Register fonts with error handling — use try/catch so PDF still renders if fonts fail
let fontsRegistered = false;
try {
  Font.register({
    family: "Inter",
    fonts: [
      { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf", fontWeight: 300 },
    ],
  });
  Font.register({
    family: "Cormorant",
    fonts: [
      { src: "https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjQAllvuQWJ5heb_w.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/cormorantgaramond/v16/co3YmX5slCNuHLi8bLeY9MK7whWMhyjYrEPjuw-NxBKL_y94.ttf", fontWeight: 300 },
    ],
  });
  fontsRegistered = true;
} catch (e) {
  console.warn("Failed to register fonts:", e);
}

// Disable hyphenation to avoid crash
Font.registerHyphenationCallback((word) => [word]);

// Use safe font families that fall back to Helvetica if custom fonts failed to load
const fontBody = fontsRegistered ? "Inter" : "Helvetica";
const fontDisplay = fontsRegistered ? "Cormorant" : "Helvetica";

const s = StyleSheet.create({
  page: { backgroundColor: "#FFFFFF", position: "relative" },
  // Cover page
  coverPage: { backgroundColor: "#1a1a1a", flex: 1, justifyContent: "center", alignItems: "center", padding: 60 },
  coverBorder: { position: "absolute", top: 24, left: 24, right: 24, bottom: 24, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.15)" },
  coverPrepared: { fontFamily: "Inter", fontSize: 7, color: "rgba(255,255,255,0.35)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 },
  coverBrand: { fontFamily: "Cormorant", fontSize: 36, color: "#FFFFFF", letterSpacing: 2, marginBottom: 8 },
  coverDivider: { width: 50, height: 0.5, backgroundColor: "rgba(255,255,255,0.25)", marginVertical: 24 },
  coverTitle: { fontFamily: "Cormorant", fontSize: 20, color: "rgba(255,255,255,0.85)", marginBottom: 10, textAlign: "center" },
  coverMeta: { fontFamily: "Inter", fontSize: 9, color: "rgba(255,255,255,0.5)", marginBottom: 4 },
  coverDate: { fontFamily: "Inter", fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 16 },
  // Slide page
  slideContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
  slideImage: { maxWidth: "100%", maxHeight: "85%", objectFit: "contain" },
  slideInfo: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center" },
  slideTitle: { fontFamily: "Cormorant", fontSize: 14, color: "#1a1a1a", marginBottom: 3 },
  slideDesc: { fontFamily: "Inter", fontSize: 8, color: "#888888" },
  slideMeta: { fontFamily: "Inter", fontSize: 6.5, color: "#bbbbbb", marginTop: 4 },
  // Footer
  footer: { position: "absolute", bottom: 12, right: 20, fontFamily: "Inter", fontSize: 6, color: "#cccccc" },
  footerBrand: { position: "absolute", bottom: 12, left: 20, fontFamily: "Cormorant", fontSize: 7, color: "#cccccc", letterSpacing: 1 },
  // Product grid
  gridHeader: { fontFamily: "Cormorant", fontSize: 16, color: "#1a1a1a", marginBottom: 4, textAlign: "center" },
  gridSection: { fontFamily: "Inter", fontSize: 8, color: "#888888", marginBottom: 16, textAlign: "center", textTransform: "uppercase", letterSpacing: 2 },
  gridRow: { flexDirection: "row", gap: 20, justifyContent: "center", alignItems: "flex-start", paddingHorizontal: 40 },
  gridCard: { width: "45%", borderWidth: 0.5, borderColor: "#e0e0e0", borderRadius: 4, overflow: "hidden" },
  gridCardImage: { width: "100%", height: 160, objectFit: "cover", backgroundColor: "#f5f5f5" },
  gridCardBody: { padding: 12 },
  gridCardName: { fontFamily: "Cormorant", fontSize: 11, color: "#1a1a1a", marginBottom: 2 },
  gridCardBrand: { fontFamily: "Inter", fontSize: 7, color: "#888888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.5 },
  gridCardDetail: { fontFamily: "Inter", fontSize: 7, color: "#aaaaaa", marginBottom: 2 },
  // Quote summary
  quoteContainer: { flex: 1, justifyContent: "center", padding: 60 },
  quoteHeader: { fontFamily: "Cormorant", fontSize: 22, color: "#1a1a1a", marginBottom: 6, textAlign: "center" },
  quoteSub: { fontFamily: "Inter", fontSize: 8, color: "#888888", marginBottom: 24, textAlign: "center" },
  quoteDivider: { width: "100%", height: 0.5, backgroundColor: "#e0e0e0", marginVertical: 12 },
  quoteRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 30, marginBottom: 6 },
  quoteLabel: { fontFamily: "Inter", fontSize: 8, color: "#666666" },
  quoteValue: { fontFamily: "Inter", fontSize: 8, color: "#1a1a1a" },
  quoteTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 30, marginTop: 8 },
  quoteTotalLabel: { fontFamily: "Cormorant", fontSize: 14, color: "#1a1a1a" },
  quoteTotalValue: { fontFamily: "Cormorant", fontSize: 14, color: "#1a1a1a" },
  quoteTerms: { fontFamily: "Inter", fontSize: 7, color: "#aaaaaa", textAlign: "center", marginTop: 24, lineHeight: 1.6 },
  quoteNote: { fontFamily: "Inter", fontSize: 7.5, color: "#666666", textAlign: "center", marginTop: 16, fontStyle: "italic" },
});

interface ProductData {
  id?: string;
  product_name: string;
  brand_name: string;
  image_url?: string;
  dimensions?: string | null;
  materials?: string | null;
  trade_price_cents?: number | null;
  currency?: string;
}

interface PresentationSlide {
  image_url: string;
  title: string;
  description?: string | null;
  project_name?: string | null;
  style_preset?: string | null;
  slide_type?: string;
  room_section?: string | null;
  linked_product_ids?: any;
  linked_quote_id?: string | null;
}

interface PresentationPDFProps {
  title: string;
  clientName?: string;
  projectName?: string;
  createdAt: string;
  slides: PresentationSlide[];
}

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

const formatPrice = (cents: number, currency = "SGD") => {
  const amt = (cents / 100).toLocaleString("en-SG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${currency} ${amt}`;
};

const parseProducts = (linked: any): ProductData[] => {
  if (!linked) return [];
  if (Array.isArray(linked)) return linked;
  try { return JSON.parse(linked); } catch { return []; }
};

/* ---- Product Grid Page ---- */
const ProductGridPage = ({ slide, pageNum, totalPages }: { slide: PresentationSlide; pageNum: number; totalPages: number }) => {
  const products = parseProducts(slide.linked_product_ids);
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={s.slideContainer}>
        <Text style={s.gridHeader}>{slide.title || "Product Specifications"}</Text>
        {slide.room_section && <Text style={s.gridSection}>{slide.room_section}</Text>}
        <View style={s.gridRow}>
          {products.map((p, idx) => (
            <View key={idx} style={s.gridCard}>
              {p.image_url && <Image src={p.image_url} style={s.gridCardImage} />}
              <View style={s.gridCardBody}>
                <Text style={s.gridCardName}>{p.product_name}</Text>
                <Text style={s.gridCardBrand}>{p.brand_name}</Text>
                {p.dimensions && <Text style={s.gridCardDetail}>Dimensions: {p.dimensions}</Text>}
                {p.materials && <Text style={s.gridCardDetail}>Materials: {p.materials}</Text>}
                {p.trade_price_cents && (
                  <Text style={{ ...s.gridCardDetail, color: "#1a1a1a", marginTop: 4 }}>
                    {formatPrice(p.trade_price_cents, p.currency)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
      <Text style={s.footerBrand}>Maison Affluency</Text>
      <Text style={s.footer}>{pageNum} / {totalPages}</Text>
    </Page>
  );
};

/* ---- Quote Summary Page ---- */
const QuoteSummaryPage = ({ slide, pageNum, totalPages }: { slide: PresentationSlide; pageNum: number; totalPages: number }) => {
  const products = parseProducts(slide.linked_product_ids);
  const totalCents = products.reduce((sum, p) => sum + (p.trade_price_cents || 0), 0);
  const currency = products.find(p => p.currency)?.currency || "SGD";
  const deposit = Math.round(totalCents * 0.6);
  const balance = totalCents - deposit;

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={s.quoteContainer}>
        <Text style={s.quoteHeader}>{slide.title || "Quote Summary"}</Text>
        <Text style={s.quoteSub}>{slide.room_section || "All Items"}</Text>

        {/* Line items */}
        {products.map((p, idx) => (
          <View key={idx} style={s.quoteRow}>
            <Text style={s.quoteLabel}>{p.product_name} — {p.brand_name}</Text>
            <Text style={s.quoteValue}>{p.trade_price_cents ? formatPrice(p.trade_price_cents, p.currency) : "On request"}</Text>
          </View>
        ))}

        <View style={s.quoteDivider} />

        {/* Total */}
        <View style={s.quoteTotalRow}>
          <Text style={s.quoteTotalLabel}>Total</Text>
          <Text style={s.quoteTotalValue}>{totalCents > 0 ? formatPrice(totalCents, currency) : "On request"}</Text>
        </View>

        {/* Payment terms */}
        {totalCents > 0 && (
          <>
            <View style={s.quoteDivider} />
            <View style={s.quoteRow}>
              <Text style={s.quoteLabel}>60% Deposit</Text>
              <Text style={s.quoteValue}>{formatPrice(deposit, currency)}</Text>
            </View>
            <View style={s.quoteRow}>
              <Text style={s.quoteLabel}>40% Balance on Delivery</Text>
              <Text style={s.quoteValue}>{formatPrice(balance, currency)}</Text>
            </View>
          </>
        )}

        <Text style={s.quoteTerms}>
          Payment terms: 60% deposit upon confirmation · 40% balance due prior to delivery.
        </Text>
        <Text style={s.quoteNote}>
          This quote is available for review in your Quote Builder with full payment details.
        </Text>

        {slide.description && (
          <Text style={{ ...s.quoteTerms, marginTop: 10 }}>{slide.description}</Text>
        )}
      </View>
      <Text style={s.footerBrand}>Maison Affluency</Text>
      <Text style={s.footer}>{pageNum} / {totalPages}</Text>
    </Page>
  );
};

/* ---- Default Image Slide ---- */
const ImageSlidePage = ({ slide, pageNum, totalPages }: { slide: PresentationSlide; pageNum: number; totalPages: number }) => (
  <Page size="A4" orientation="landscape" style={s.page}>
    <View style={s.slideContainer}>
      {slide.image_url && <Image src={slide.image_url} style={s.slideImage} />}
    </View>
    {(slide.title || slide.description) && (
      <View style={s.slideInfo}>
        {slide.title && <Text style={s.slideTitle}>{slide.title}</Text>}
        {slide.description && <Text style={s.slideDesc}>{slide.description}</Text>}
        {(slide.project_name || slide.style_preset) && (
          <Text style={s.slideMeta}>
            {[slide.project_name && `Project: ${slide.project_name}`, slide.style_preset && `Style: ${slide.style_preset}`].filter(Boolean).join("  ·  ")}
          </Text>
        )}
      </View>
    )}
    <Text style={s.footerBrand}>Maison Affluency</Text>
    <Text style={s.footer}>{pageNum} / {totalPages}</Text>
  </Page>
);

const PresentationPDF = ({ title, clientName, projectName, createdAt, slides }: PresentationPDFProps) => {
  const totalPages = slides.length + 1;

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.coverPage}>
          <View style={s.coverBorder} />
          <Text style={s.coverPrepared}>Prepared by</Text>
          <Text style={s.coverBrand}>Maison Affluency</Text>
          <View style={s.coverDivider} />
          {title && <Text style={s.coverTitle}>{title}</Text>}
          {clientName && <Text style={s.coverMeta}>For {clientName}</Text>}
          {projectName && <Text style={s.coverMeta}>{projectName}</Text>}
          <Text style={s.coverDate}>{formatDate(createdAt)}</Text>
        </View>
      </Page>

      {/* Slide Pages — rendered by type */}
      {slides.map((slide, i) => {
        const pageNum = i + 2;
        const type = slide.slide_type || "image";

        if (type === "product_grid") {
          return <ProductGridPage key={i} slide={slide} pageNum={pageNum} totalPages={totalPages} />;
        }
        if (type === "quote_summary") {
          return <QuoteSummaryPage key={i} slide={slide} pageNum={pageNum} totalPages={totalPages} />;
        }
        return <ImageSlidePage key={i} slide={slide} pageNum={pageNum} totalPages={totalPages} />;
      })}
    </Document>
  );
};

export default PresentationPDF;
