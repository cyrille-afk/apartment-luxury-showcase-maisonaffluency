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
      {/* Cover Page */}
      <Page size="A4" style={s.coverPage}>
        <Text style={s.coverTitle}>Maison Affluency</Text>
        <Text style={s.coverSubtitle}>Curated Collection Catalogue</Text>
        <Text style={s.coverDate}>{dateStr}</Text>
      </Page>

      {/* Product Pages */}
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
    <div className="min-h-screen bg-[#f5f0eb]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#f5f0eb]/95 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center">
            <h1 className="text-lg font-serif tracking-wider uppercase">Product Catalogue</h1>
            <p className="text-xs text-muted-foreground">{totalProducts} products across {groups.length} gallery rooms</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {generating ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {groups.map((group, gi) => (
          <div key={gi} className="mb-12">
            <div className="mb-6 border-b border-border/40 pb-3">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{group.experience}</h2>
              <h3 className="text-xl font-serif italic text-foreground">{group.room}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.products.map((product, pi) => (
                <ProductCard key={pi} product={product} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: CatalogueProduct }) {
  return (
    <div className="bg-background rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {product.image ? (
        <div className="aspect-square bg-[#f5f0eb] flex items-center justify-center p-4">
          <img
            src={product.image}
            alt={product.title}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="aspect-square bg-[#f0ebe5] flex items-center justify-center">
          <span className="text-xs text-muted-foreground">No image</span>
        </div>
      )}
      <div className="p-4 space-y-1.5">
        <h4 className="text-sm font-medium text-foreground leading-tight">
          {product.title}
          {product.subtitle ? <span className="text-muted-foreground"> — {product.subtitle}</span> : null}
        </h4>
        <p className="text-xs italic text-muted-foreground">{product.designerName}</p>
        {product.category && (
          <p className="text-xs text-muted-foreground">
            {product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}
          </p>
        )}
        {product.materials && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Materials:</span>{" "}
            {product.materials.replace(/\n/g, ", ")}
          </p>
        )}
        {product.dimensions && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Dimensions:</span>{" "}
            {product.dimensions.replace(/\n/g, " ")}
          </p>
        )}
        {product.edition && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Edition:</span> {product.edition}
          </p>
        )}
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
