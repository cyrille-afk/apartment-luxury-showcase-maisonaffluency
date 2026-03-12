import { useState, useMemo, useCallback, useEffect } from "react";
import { fetchCatalogueData, type GalleryRoomGroup, type CatalogueProduct } from "@/lib/catalogueData";
import { syncHotspotMaterials } from "@/lib/syncHotspotMaterials";
import { Lock, FileDown, Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CATALOGUE_PASSWORD = "maison-affluency";

/* ─── PDF generation (lazy-loaded) ─── */
async function generatePDF(groups: GalleryRoomGroup[]) {
  const { pdf, Document, Page, Text, View, Image, StyleSheet, Font } = await import("@react-pdf/renderer");

  Font.register({
    family: "Cinzel",
    fonts: [
      { src: "https://fonts.gstatic.com/s/cinzel/v23/8vIU7ww63mVu7gtR-kwKxNvkNOjw-tbnfY3lCA.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/cinzel/v23/8vIU7ww63mVu7gtR-kwKxNvkNOjw-n7gfY3lCA.ttf", fontWeight: 700 },
    ],
  });
  Font.register({
    family: "PlayfairDisplay",
    fonts: [
      { src: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd1tnDXbtM.ttf", fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "Lora",
    fonts: [
      { src: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkq0.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787z5vBJBkq0.ttf", fontWeight: 500 },
      { src: "https://fonts.gstatic.com/s/lora/v35/0QI8MX1D_JOuMw_hLdO6T2wV9KnW-MoFoq92nA.ttf", fontWeight: 400, fontStyle: "italic" },
    ],
  });

  const colors = {
    foreground: "#1a1a1a",
    muted: "#6b6b6b",
    mutedLight: "#999999",
    accent: "#b8965a",
    border: "#e0e0e0",
    borderLight: "#eeeeee",
    bg: "#ffffff",
    bgWarm: "#f5f0eb",
  };

  const s = StyleSheet.create({
    coverPage: {
      padding: 60,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.bgWarm,
    },
    coverRule: { width: 40, height: 1, backgroundColor: colors.accent, marginBottom: 24 },
    coverTitle: {
      fontFamily: "Cinzel",
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: 6,
      color: colors.foreground,
      textTransform: "uppercase" as const,
      marginBottom: 6,
    },
    coverSubtitle: {
      fontFamily: "PlayfairDisplay",
      fontSize: 13,
      fontStyle: "italic",
      color: colors.muted,
      marginBottom: 4,
    },
    coverDate: { fontFamily: "Lora", fontSize: 9, color: colors.mutedLight, marginTop: 28 },

    page: {
      paddingTop: 40,
      paddingBottom: 56,
      paddingHorizontal: 48,
      fontFamily: "Lora",
      fontSize: 9,
      color: colors.foreground,
      backgroundColor: colors.bg,
    },

    /* Section header — experience + room */
    sectionHeader: {
      marginBottom: 16,
      paddingBottom: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    experienceLabel: {
      fontFamily: "Lora",
      fontSize: 7,
      fontWeight: 500,
      textTransform: "uppercase" as const,
      letterSpacing: 3,
      color: colors.mutedLight,
      marginBottom: 3,
    },
    roomTitle: {
      fontFamily: "PlayfairDisplay",
      fontSize: 16,
      fontStyle: "italic",
      color: colors.foreground,
    },

    /* Product card — image left, text right (like Invisible Collection) */
    productCard: {
      flexDirection: "row" as const,
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.borderLight,
    },
    productImage: {
      width: 110,
      height: 110,
      objectFit: "contain" as const,
      backgroundColor: colors.bgWarm,
      marginRight: 20,
    },
    noImage: {
      width: 110,
      height: 110,
      backgroundColor: colors.bgWarm,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: 20,
    },
    noImageText: { fontFamily: "Lora", fontSize: 7, color: colors.mutedLight },
    productInfo: { flex: 1, paddingTop: 2 },
    productHeading: {
      fontFamily: "PlayfairDisplay",
      fontSize: 11,
      color: colors.foreground,
      marginBottom: 4,
    },
    productMaterials: {
      fontFamily: "Lora",
      fontSize: 8,
      color: colors.muted,
      lineHeight: 1.5,
      marginBottom: 6,
    },
    productDimensions: {
      fontFamily: "Lora",
      fontSize: 8,
      color: colors.foreground,
      marginBottom: 2,
    },
    productDimensionsLabel: {
      fontFamily: "Lora",
      fontSize: 7,
      fontWeight: 500,
      color: colors.mutedLight,
      textTransform: "uppercase" as const,
      letterSpacing: 1.5,
      marginTop: 6,
      marginBottom: 2,
    },

    /* Footer */
    footer: {
      position: "absolute" as const,
      bottom: 20,
      left: 48,
      right: 48,
      alignItems: "center" as const,
    },
    footerRule: {
      width: "100%" as const,
      height: 0.5,
      backgroundColor: colors.borderLight,
      marginBottom: 8,
    },
    footerBrand: {
      fontFamily: "Cinzel",
      fontSize: 7,
      letterSpacing: 3,
      color: colors.mutedLight,
      textTransform: "uppercase" as const,
    },
    footerUrl: {
      fontFamily: "Lora",
      fontSize: 6,
      color: colors.mutedLight,
      marginTop: 2,
    },

    /* TOC */
    tocRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "baseline" as const,
      paddingVertical: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.borderLight,
    },
    tocRoom: {
      fontFamily: "Lora",
      fontSize: 10,
      fontWeight: 500,
      color: colors.foreground,
    },
    tocExperience: {
      fontFamily: "Lora",
      fontSize: 7,
      color: colors.mutedLight,
      marginTop: 1,
      textTransform: "uppercase" as const,
      letterSpacing: 2,
    },
    tocCount: {
      fontFamily: "Lora",
      fontSize: 8,
      color: colors.muted,
    },
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const FooterBlock = () => (
    <View style={s.footer} fixed>
      <View style={s.footerRule} />
      <Text style={s.footerBrand}>Maison Affluency</Text>
      <Text style={s.footerUrl}>www.maisonaffluency.com</Text>
    </View>
  );

  const doc = (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverRule} />
        <Text style={s.coverTitle}>Maison Affluency</Text>
        <Text style={s.coverSubtitle}>Gallery Collection Catalogue</Text>
        <Text style={s.coverDate}>{dateStr}</Text>
      </Page>

      {/* Table of Contents */}
      <Page size="A4" style={s.page}>
        <View style={s.sectionHeader}>
          <Text style={s.roomTitle}>Contents</Text>
        </View>
        {groups.map((group, gi) => (
          <View key={gi} style={s.tocRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.tocRoom}>{group.room}</Text>
              <Text style={s.tocExperience}>{group.experience}</Text>
            </View>
            <Text style={s.tocCount}>
              {group.products.length} {group.products.length === 1 ? "piece" : "pieces"}
            </Text>
          </View>
        ))}
        <FooterBlock />
      </Page>

      {/* Product Pages — one page per gallery room */}
      {groups.map((group, gi) => (
        <Page key={gi} size="A4" style={s.page} wrap>
          <View style={s.sectionHeader}>
            <Text style={s.experienceLabel}>{group.experience}</Text>
            <Text style={s.roomTitle}>{group.room}</Text>
          </View>

          {group.products.map((product) => {
            const heading = product.designer_name
              ? `${product.product_name} by ${product.designer_name}`
              : product.product_name;

            return (
              <View key={product.id} style={s.productCard} wrap={false}>
                {product.product_image_url ? (
                  <Image style={s.productImage} src={product.product_image_url} />
                ) : (
                  <View style={s.noImage}>
                    <Text style={s.noImageText}>No image</Text>
                  </View>
                )}
                <View style={s.productInfo}>
                  <Text style={s.productHeading}>{heading}</Text>
                  {product.materials && (
                    <Text style={s.productMaterials}>{product.materials}</Text>
                  )}
                  {product.dimensions && (
                    <>
                      <Text style={s.productDimensionsLabel}>Dimensions</Text>
                      <Text style={s.productDimensions}>{product.dimensions}</Text>
                    </>
                  )}
                </View>
              </View>
            );
          })}

          <FooterBlock />
        </Page>
      ))}
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Maison_Affluency_Gallery_Catalogue_${now.toISOString().slice(0, 10)}.pdf`;
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
          <h1 className="text-2xl font-serif tracking-wider uppercase text-foreground">Gallery Catalogue</h1>
          <p className="text-sm text-muted-foreground mt-2">Enter the password to access the gallery catalogue</p>
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

/* ─── Product Row (editorial layout matching Invisible Collection) ─── */
function ProductRow({ product }: { product: CatalogueProduct }) {
  const heading = product.designer_name
    ? `${product.product_name} by ${product.designer_name}`
    : product.product_name;

  return (
    <div className="flex gap-5 py-5 border-b border-[#e8e2db] last:border-b-0">
      {/* Thumbnail */}
      {product.product_image_url ? (
        <div className="w-28 h-28 md:w-36 md:h-36 flex-shrink-0 bg-[#f5f0eb] flex items-center justify-center overflow-hidden">
          <img
            src={product.product_image_url}
            alt={product.product_name}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="w-28 h-28 md:w-36 md:h-36 flex-shrink-0 bg-[#f0ebe5] flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">No image</span>
        </div>
      )}

      {/* Details */}
      <div className="flex flex-col justify-center min-w-0">
        <h4 className="text-sm md:text-[15px] font-serif italic text-foreground leading-snug">
          {heading}
        </h4>
        {product.materials && (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {product.materials}
          </p>
        )}
        {product.dimensions && (
          <div className="mt-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Dimensions</p>
            <p className="text-xs text-foreground">{product.dimensions}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Catalogue View ─── */
function CatalogueView() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GalleryRoomGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchCatalogueData().then((data) => {
      setGroups(data);
      setLoading(false);
    });
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf7f4] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            disabled={generating || groups.length === 0}
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
          Gallery Collection Catalogue
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
              {group.products.map((product) => (
                <ProductRow key={product.id} product={product} />
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
