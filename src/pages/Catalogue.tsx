import { useState, useMemo, useCallback } from "react";
import { getCatalogueData, type GalleryRoomGroup, type CatalogueProduct } from "@/lib/catalogueData";
import { Lock, FileDown, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CATALOGUE_PASSWORD = "maison-affluency";

/* ─── PDF generation (lazy-loaded) ─── */
async function generatePDF(groups: GalleryRoomGroup[]) {
  const { pdf, Document, Page, Text, View, Image, StyleSheet, Font } = await import("@react-pdf/renderer");

  Font.register({
    family: "Helvetica",
    fonts: [
      { src: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf", fontWeight: 400 },
      { src: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf", fontWeight: 500 },
      { src: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf", fontStyle: "italic" },
    ],
  });

  const s = StyleSheet.create({
    page: { padding: 40, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a" },
    coverPage: { padding: 0, fontFamily: "Helvetica", justifyContent: "center", alignItems: "center", backgroundColor: "#f5f0eb" },
    coverTitle: { fontSize: 32, fontWeight: 500, letterSpacing: 4, color: "#1a1a1a", marginBottom: 8, textTransform: "uppercase" as const },
    coverSubtitle: { fontSize: 14, color: "#6b6b6b", fontStyle: "italic", marginBottom: 4 },
    coverDate: { fontSize: 10, color: "#999", marginTop: 20 },
    sectionHeader: { marginBottom: 16, marginTop: 8, borderBottomWidth: 1, borderBottomColor: "#e0d8cf", paddingBottom: 8 },
    experience: { fontSize: 16, fontWeight: 500, color: "#1a1a1a", marginBottom: 2, textTransform: "uppercase" as const, letterSpacing: 2 },
    room: { fontSize: 11, color: "#8a7e72", fontStyle: "italic" },
    productRow: { flexDirection: "row" as const, marginBottom: 14, borderBottomWidth: 0.5, borderBottomColor: "#eee", paddingBottom: 10 },
    productImage: { width: 120, height: 120, objectFit: "contain" as const, marginRight: 16, backgroundColor: "#f5f0eb" },
    productInfo: { flex: 1, justifyContent: "flex-start" as const },
    productTitle: { fontSize: 11, fontWeight: 500, marginBottom: 2, color: "#1a1a1a" },
    productDesigner: { fontSize: 9, color: "#8a7e72", marginBottom: 4, fontStyle: "italic" },
    productDetail: { fontSize: 8, color: "#555", marginBottom: 1.5 },
    label: { fontWeight: 500, color: "#1a1a1a" },
    footer: { position: "absolute" as const, bottom: 20, left: 40, right: 40, flexDirection: "row" as const, justifyContent: "space-between" as const, fontSize: 7, color: "#bbb" },
    noImage: { width: 120, height: 120, backgroundColor: "#f0ebe5", justifyContent: "center" as const, alignItems: "center" as const, marginRight: 16 },
    noImageText: { fontSize: 8, color: "#ccc" },
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const doc = (
    <Document>
      <Page size="A4" style={s.coverPage}>
        <Text style={s.coverTitle}>Maison Affluency</Text>
        <Text style={s.coverSubtitle}>Curated Collection Catalogue</Text>
        <Text style={s.coverDate}>{dateStr}</Text>
      </Page>

      {groups.map((group, gi) => (
        <Page key={gi} size="A4" style={s.page} wrap>
          <View style={s.sectionHeader}>
            <Text style={s.experience}>{group.experience}</Text>
            <Text style={s.room}>{group.room}</Text>
          </View>

          {group.products.map((product, pi) => (
            <View key={pi} style={s.productRow} wrap={false}>
              {product.image ? (
                <Image style={s.productImage} src={product.image} />
              ) : (
                <View style={s.noImage}>
                  <Text style={s.noImageText}>No image</Text>
                </View>
              )}
              <View style={s.productInfo}>
                <Text style={s.productTitle}>
                  {product.title}
                  {product.subtitle ? ` — ${product.subtitle}` : ""}
                </Text>
                <Text style={s.productDesigner}>{product.designerName}</Text>
                {product.category && (
                  <Text style={s.productDetail}>
                    <Text style={s.label}>Category: </Text>
                    {product.category}
                    {product.subcategory ? ` / ${product.subcategory}` : ""}
                  </Text>
                )}
                {product.materials && (
                  <Text style={s.productDetail}>
                    <Text style={s.label}>Materials: </Text>
                    {product.materials.replace(/\n/g, " ")}
                  </Text>
                )}
                {product.dimensions && (
                  <Text style={s.productDetail}>
                    <Text style={s.label}>Dimensions: </Text>
                    {product.dimensions.replace(/\n/g, " ")}
                  </Text>
                )}
                {product.edition && (
                  <Text style={s.productDetail}>
                    <Text style={s.label}>Edition: </Text>
                    {product.edition}
                  </Text>
                )}
                {product.description && (
                  <Text style={s.productDetail}>
                    {product.description.replace(/\n/g, " ").substring(0, 200)}
                  </Text>
                )}
              </View>
            </View>
          ))}

          <View style={s.footer} fixed>
            <Text>Maison Affluency — Curated Collection</Text>
            <Text render={({ pageNumber }) => `${pageNumber}`} />
          </View>
        </Page>
      ))}
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Maison_Affluency_Catalogue_${now.toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Password Gate ─── */
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === CATALOGUE_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f0eb] flex flex-col items-center justify-center px-4">
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Lock className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-serif tracking-wider uppercase text-foreground">Catalogue Access</h1>
          <p className="text-sm text-muted-foreground mt-2">Enter the password to access the product catalogue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            className={`w-full px-4 py-3 border ${error ? "border-red-400 shake" : "border-border"} rounded-md bg-background text-foreground text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all`}
            autoFocus
          />
          {error && <p className="text-red-500 text-xs text-center">Incorrect password</p>}
          <button
            type="submit"
            className="w-full py-3 bg-foreground text-background rounded-md text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            Access Catalogue
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Product Row (editorial layout) ─── */
function ProductRow({ product }: { product: CatalogueProduct }) {
  return (
    <div className="flex gap-6 py-6 border-b border-[#e8e2db]">
      {/* Thumbnail */}
      {product.image ? (
        <div className="w-36 h-36 md:w-44 md:h-44 flex-shrink-0 bg-[#f5f0eb] flex items-center justify-center">
          <img
            src={product.image}
            alt={product.title}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="w-36 h-36 md:w-44 md:h-44 flex-shrink-0 bg-[#f0ebe5] flex items-center justify-center">
          <span className="text-xs text-muted-foreground">No image</span>
        </div>
      )}

      {/* Details */}
      <div className="flex flex-col justify-start min-w-0 pt-1">
        <h4 className="text-[15px] md:text-base font-medium text-foreground leading-snug">
          {product.title}
          {product.subtitle && (
            <span className="text-muted-foreground font-normal"> — {product.subtitle}</span>
          )}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5 italic">{product.designerName}</p>

        {/* Description / Materials block */}
        <div className="mt-3 space-y-1">
          {product.materials && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {product.materials.replace(/\n/g, ", ")}
            </p>
          )}
          {product.category && (
            <p className="text-[11px] text-muted-foreground">
              {product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}
            </p>
          )}
        </div>

        {/* Dimensions */}
        {product.dimensions && (
          <p className="text-[11px] text-foreground/70 mt-3">
            {product.dimensions.replace(/\n/g, " · ")}
          </p>
        )}

        {/* Edition */}
        {product.edition && (
          <p className="text-[11px] text-foreground/70 mt-1.5">
            <span className="font-medium text-foreground">Edition:</span> {product.edition}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Catalogue View ─── */
function CatalogueView() {
  const navigate = useNavigate();
  const groups = useMemo(() => getCatalogueData(), []);
  const [generating, setGenerating] = useState(false);

  const totalProducts = useMemo(() => groups.reduce((sum, g) => sum + g.products.length, 0), [groups]);

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    try {
      await generatePDF(groups);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [groups]);

  return (
    <div className="min-h-screen bg-[#faf7f4]">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#faf7f4]/95 backdrop-blur-sm border-b border-[#e8e2db]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            onClick={handleDownload}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 border border-foreground/20 text-foreground text-xs uppercase tracking-widest hover:bg-foreground hover:text-background transition-all disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            {generating ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Cover / Title Section */}
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
        <h1 className="text-3xl md:text-4xl font-serif tracking-[0.15em] uppercase text-foreground">
          Maison Affluency
        </h1>
        <p className="text-sm md:text-base text-muted-foreground italic mt-2">
          Curated Collection Catalogue
        </p>
        <div className="w-12 h-px bg-[#c9bfb3] mx-auto mt-6" />
        <p className="text-xs text-muted-foreground mt-4">
          {totalProducts} pieces across {groups.length} gallery rooms
        </p>
      </div>

      {/* Gallery Room Sections */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        {groups.map((group, gi) => (
          <section key={gi} className="mb-16">
            {/* Section header */}
            <div className="mb-2 pb-4 border-b border-[#d4ccc3]">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
                {group.experience}
              </p>
              <h2 className="text-xl md:text-2xl font-serif italic text-foreground">
                {group.room}
              </h2>
            </div>

            {/* Product rows */}
            <div>
              {group.products.map((product, pi) => (
                <ProductRow key={pi} product={product} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[#e8e2db] py-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Maison Affluency
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          www.maisonaffluency.com
        </p>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function Catalogue() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return <CatalogueView />;
}
