import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { fetchCatalogueData, type GalleryRoomGroup, type CatalogueProduct } from "@/lib/catalogueData";
import { getBrandCatalogueData, type BrandCatalogueCategory, type BrandCatalogueDesigner } from "@/lib/brandCatalogueData";
import { syncHotspotMaterials } from "@/lib/syncHotspotMaterials";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { Lock, FileDown, Loader2, ArrowLeft, RefreshCw, LayoutGrid, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Full-size gallery room images (matching Gallery.tsx Cloudinary IDs).
 */
const g = (id: string) => cloudinaryUrl(id, { width: 1200, quality: "auto:good", crop: "fill" });

const ROOM_IMAGES: Record<string, string> = {
  "An Inviting Lounge Area": g("bespoke-sofa_gxidtx"),
  "A Sophisticated Living Room": g("living-room-hero_zxfcxl"),
  "Panoramic Cityscape Views": g("dining-room_ey0bu5"),
  "A Sun Lit Reading Corner": g("IMG_2402_y3atdm"),
  "A Dreamy Tuscan Landscape": g("intimate-dining_ux4pee"),
  "A Highly Customised Dining Room": g("intimate-table-detail_aqxvvm"),
  "A Relaxed Setting": g("intimate-lounge_tf4sm1"),
  "A Colourful Nook": g("IMG_2133_wtxd62"),
  "A Sophisticated Boudoir": g("boudoir_ll5spn"),
  "A Jewelry Box Like Setting": g("70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq"),
  "A Serene Decor": g("bedroom-second_cyfmdj"),
  "A Design Treasure Trove": g("art-master-bronze_hf6bad"),
  "A Masterful Suite": g("master-suite_y6jaix"),
  "Design Tableau": g("bedroom-third_ol56sx"),
  "A Venitian Cocoon": g("calming-2"),
  "Unique By Design Vignette": g("bedroom-alt_yk0j0d"),
  "An Artistic Statement": g("small-room-bedroom_mp8mdd"),
  "Compact Elegance": g("small-room-personality_wvxz6y"),
  "Yellow Crystalline": g("small-room-vase_s3nz5o"),
  "Golden Hour": g("small-room-chair_aobzyb"),
  "A Workspace of Distinction": g("home-office-desk_g0ywv2"),
  "Refined Details": g("home-office-desk-2_gb1nlb"),
  "Light & Focus": g("home-office-3_t39msw"),
  "Design & Fine Art Books Corner": g("AffluencySG_143_1_f9iihg"),
  "Curated Vignette": g("details-section_u6rwbu"),
  "The Details Make The Design": g("details-console_hk6uxt"),
  "Light & Texture": g("details-lamp_clzcrk"),
  "Craftsmanship At Every Corner": g("AffluencySG_204_1_qbbpqb"),
};

/**
 * Apply c_pad,b_white,w_500,h_500 to a Cloudinary product image URL.
 * Inserts the transformation after /upload/.
 */
function padProductImage(url: string): string {
  return url.replace("/image/upload/", "/image/upload/c_pad,b_white,w_500,h_500/");
}

const CATALOGUE_PASSWORD = "maison-affluency";

/* ─── Gallery Room PDF generation (existing) ─── */
async function generateGalleryPDF(groups: GalleryRoomGroup[]) {
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
    foreground: "#1a1a1a", muted: "#6b6b6b", mutedLight: "#999999",
    accent: "#b8965a", border: "#e0e0e0", borderLight: "#eeeeee",
    bg: "#ffffff", bgWarm: "#f5f0eb",
  };

  const s = StyleSheet.create({
    coverPage: { padding: 60, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgWarm },
    coverRule: { width: 40, height: 1, backgroundColor: colors.accent, marginBottom: 24 },
    coverTitle: { fontFamily: "Cinzel", fontSize: 28, fontWeight: 700, letterSpacing: 6, color: colors.foreground, textTransform: "uppercase" as const, marginBottom: 6 },
    coverSubtitle: { fontFamily: "PlayfairDisplay", fontSize: 13, fontStyle: "italic", color: colors.muted, marginBottom: 4 },
    coverDate: { fontFamily: "Lora", fontSize: 9, color: colors.mutedLight, marginTop: 28 },
    page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 48, fontFamily: "Lora", fontSize: 9, color: colors.foreground, backgroundColor: colors.bg },
    sectionHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    experienceLabel: { fontFamily: "Lora", fontSize: 7, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: 3, color: colors.mutedLight, marginBottom: 3 },
    roomTitle: { fontFamily: "PlayfairDisplay", fontSize: 16, fontStyle: "italic", color: colors.foreground },
    productCard: { flexDirection: "row" as const, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
    productImage: { width: 110, height: 110, objectFit: "contain" as const, backgroundColor: colors.bgWarm, marginRight: 20 },
    noImage: { width: 110, height: 110, backgroundColor: colors.bgWarm, justifyContent: "center" as const, alignItems: "center" as const, marginRight: 20 },
    noImageText: { fontFamily: "Lora", fontSize: 7, color: colors.mutedLight },
    productInfo: { flex: 1, paddingTop: 2 },
    productHeading: { fontFamily: "PlayfairDisplay", fontSize: 11, color: colors.foreground, marginBottom: 4 },
    productMaterials: { fontFamily: "Lora", fontSize: 8, color: colors.muted, lineHeight: 1.5, marginBottom: 6 },
    productDimensions: { fontFamily: "Lora", fontSize: 8, color: colors.foreground, marginBottom: 2 },
    productDimensionsLabel: { fontFamily: "Lora", fontSize: 7, fontWeight: 500, color: colors.mutedLight, textTransform: "uppercase" as const, letterSpacing: 1.5, marginTop: 6, marginBottom: 2 },
    footer: { position: "absolute" as const, bottom: 20, left: 48, right: 48, alignItems: "center" as const },
    footerRule: { width: "100%" as const, height: 0.5, backgroundColor: colors.borderLight, marginBottom: 8 },
    footerBrand: { fontFamily: "Cinzel", fontSize: 7, letterSpacing: 3, color: colors.mutedLight, textTransform: "uppercase" as const },
    footerUrl: { fontFamily: "Lora", fontSize: 6, color: colors.mutedLight, marginTop: 2 },
    tocRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "baseline" as const, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
    tocRoom: { fontFamily: "Lora", fontSize: 10, fontWeight: 500, color: colors.foreground },
    tocExperience: { fontFamily: "Lora", fontSize: 7, color: colors.mutedLight, marginTop: 1, textTransform: "uppercase" as const, letterSpacing: 2 },
    tocCount: { fontFamily: "Lora", fontSize: 8, color: colors.muted },
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
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverRule} />
        <Text style={s.coverTitle}>Maison Affluency</Text>
        <Text style={s.coverSubtitle}>Gallery Collection Catalogue</Text>
        <Text style={s.coverDate}>{dateStr}</Text>
      </Page>
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
                  <View style={s.noImage}><Text style={s.noImageText}>No image</Text></View>
                )}
                <View style={s.productInfo}>
                  <Text style={s.productHeading}>{heading}</Text>
                  {product.materials && <Text style={s.productMaterials}>{product.materials}</Text>}
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

/* ─── Brand Catalogue PDF generation ─── */
async function generateBrandPDF(categories: BrandCatalogueCategory[]) {
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
    ],
  });

  const colors = {
    foreground: "#1a1a1a", muted: "#6b6b6b", mutedLight: "#999999",
    accent: "#b8965a", border: "#e0e0e0", borderLight: "#eeeeee",
    bg: "#ffffff", bgWarm: "#f5f0eb",
  };

  const s = StyleSheet.create({
    coverPage: { padding: 60, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgWarm },
    coverRule: { width: 40, height: 1, backgroundColor: colors.accent, marginBottom: 24 },
    coverTitle: { fontFamily: "Cinzel", fontSize: 28, fontWeight: 700, letterSpacing: 6, color: colors.foreground, textTransform: "uppercase" as const, marginBottom: 6 },
    coverSubtitle: { fontFamily: "PlayfairDisplay", fontSize: 13, fontStyle: "italic", color: colors.muted, marginBottom: 4 },
    coverDate: { fontFamily: "Lora", fontSize: 9, color: colors.mutedLight, marginTop: 28 },
    page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 48, fontFamily: "Lora", fontSize: 9, color: colors.foreground, backgroundColor: colors.bg },
    categoryTitle: { fontFamily: "Cinzel", fontSize: 18, fontWeight: 700, letterSpacing: 4, color: colors.foreground, textTransform: "uppercase" as const, marginBottom: 4, textAlign: "center" as const },
    categorySubtitle: { fontFamily: "Lora", fontSize: 8, color: colors.mutedLight, textAlign: "center" as const, letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 20 },
    designerBlock: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
    designerRow: { flexDirection: "row" as const, marginBottom: 12 },
    designerImage: { width: 100, height: 100, objectFit: "cover" as const, marginRight: 16 },
    designerInfo: { flex: 1 },
    designerName: { fontFamily: "Cinzel", fontSize: 12, fontWeight: 700, letterSpacing: 2, color: colors.foreground, textTransform: "uppercase" as const, marginBottom: 6 },
    designerDesc: { fontFamily: "Lora", fontSize: 8, color: colors.muted, lineHeight: 1.6 },
    designerWebsite: { fontFamily: "Lora", fontSize: 7, color: colors.accent, marginTop: 6 },
    picksRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginTop: 8 },
    pickImage: { width: 80, height: 80, objectFit: "contain" as const, backgroundColor: colors.bgWarm },
    pickInfo: { marginTop: 2 },
    pickTitle: { fontFamily: "Lora", fontSize: 7, color: colors.foreground },
    pickMaterials: { fontFamily: "Lora", fontSize: 6, color: colors.mutedLight },
    footer: { position: "absolute" as const, bottom: 20, left: 48, right: 48, alignItems: "center" as const },
    footerRule: { width: "100%" as const, height: 0.5, backgroundColor: colors.borderLight, marginBottom: 8 },
    footerBrand: { fontFamily: "Cinzel", fontSize: 7, letterSpacing: 3, color: colors.mutedLight, textTransform: "uppercase" as const },
    footerUrl: { fontFamily: "Lora", fontSize: 6, color: colors.mutedLight, marginTop: 2 },
    tocRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "baseline" as const, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
    tocCategory: { fontFamily: "Cinzel", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: colors.foreground, textTransform: "uppercase" as const },
    tocCount: { fontFamily: "Lora", fontSize: 8, color: colors.muted },
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
      {/* Cover */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverRule} />
        <Text style={s.coverTitle}>Maison Affluency</Text>
        <Text style={s.coverSubtitle}>2026 Brand Catalogue</Text>
        <Text style={s.coverDate}>{dateStr}</Text>
      </Page>

      {/* TOC */}
      <Page size="A4" style={s.page}>
        <Text style={{ ...s.categoryTitle, fontSize: 14, marginBottom: 16 }}>Contents</Text>
        {categories.map((cat, ci) => (
          <View key={ci} style={s.tocRow}>
            <Text style={s.tocCategory}>{cat.title}</Text>
            <Text style={s.tocCount}>
              {cat.designers.length} {cat.designers.length === 1 ? "brand" : "brands"}
            </Text>
          </View>
        ))}
        <FooterBlock />
      </Page>

      {/* Category pages */}
      {categories.map((cat, ci) => (
        <Page key={ci} size="A4" style={s.page} wrap>
          <Text style={s.categoryTitle}>{cat.title}</Text>
          {cat.subtitle && <Text style={s.categorySubtitle}>{cat.subtitle}</Text>}

          {cat.designers.map((designer) => (
            <View key={designer.id} style={s.designerBlock} wrap={false}>
              <View style={s.designerRow}>
                {designer.profileImage && (
                  <Image style={s.designerImage} src={designer.profileImage} />
                )}
                <View style={s.designerInfo}>
                  <Text style={s.designerName}>{designer.name}</Text>
                  <Text style={s.designerDesc}>{designer.description}</Text>
                  {designer.website && (
                    <Text style={s.designerWebsite}>{designer.website}</Text>
                  )}
                </View>
              </View>

              {/* Top 3 curator picks */}
              {designer.curatorPicks.length > 0 && (
                <View style={s.picksRow}>
                  {designer.curatorPicks.slice(0, 3).map((pick, pi) => (
                    <View key={pi} style={{ width: 100 }}>
                      {pick.image && <Image style={s.pickImage} src={pick.image} />}
                      <View style={s.pickInfo}>
                        <Text style={s.pickTitle}>{pick.title}</Text>
                        {pick.materials && <Text style={s.pickMaterials}>{pick.materials.substring(0, 60)}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
          <FooterBlock />
        </Page>
      ))}
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Maison_Affluency_Brand_Catalogue_${now.toISOString().slice(0, 10)}.pdf`;
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
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4">
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Lock className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-serif tracking-wider uppercase text-foreground">Catalogue</h1>
          <p className="text-sm text-muted-foreground mt-2">Enter the password to access the catalogue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            className={`w-full px-4 py-3 border ${error ? "border-destructive" : "border-border"} rounded-md bg-background text-foreground text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all`}
            autoFocus
          />
          {error && <p className="text-destructive text-xs text-center">Incorrect password</p>}
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

/* ─── Shared product grid renderer ─── */
function ProductGrid({
  items,
  showAll,
  total,
  onShowAll,
  renderItem,
  label,
}: {
  items: React.ReactNode[];
  showAll: boolean;
  total: number;
  onShowAll: () => void;
  renderItem?: undefined;
  label: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">{label}</p>
      <div className="grid grid-cols-2 gap-3">{items}</div>
      {total > 4 && !showAll && (
        <button
          onClick={onShowAll}
          className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
        >
          Show all {total} pieces →
        </button>
      )}
    </div>
  );
}

/* ─── Hook to detect image orientation ─── */
function useImageOrientation(src: string | undefined) {
  const [isPortrait, setIsPortrait] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (!src || checked.current) return;
    const img = new Image();
    img.onload = () => {
      setIsPortrait(img.naturalHeight > img.naturalWidth);
      checked.current = true;
    };
    img.src = src;
  }, [src]);

  return isPortrait;
}

/* ─── Gallery Room Card ─── */
function RoomCard({ group }: { group: GalleryRoomGroup }) {
  const [showAll, setShowAll] = useState(false);
  const visibleProducts = showAll ? group.products : group.products.slice(0, 4);
  const roomImage = ROOM_IMAGES[group.room];
  const isPortrait = useImageOrientation(roomImage);

  const productItems = visibleProducts.map((product) => {
    const heading = product.designer_name
      ? `${product.product_name} by ${product.designer_name}`
      : product.product_name;
    return (
      <div key={product.id} className="group">
        {product.product_image_url ? (
          <div className="aspect-square bg-muted/20 overflow-hidden mb-2">
            <img
              src={product.product_image_url}
              alt={product.product_name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="aspect-square bg-muted/20 flex items-center justify-center mb-2">
            <span className="text-[10px] text-muted-foreground">No image</span>
          </div>
        )}
        <p className="text-xs font-serif text-foreground leading-tight">{heading}</p>
        {product.materials && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{product.materials}</p>
        )}
        {product.dimensions && (
          <p className="text-[10px] text-foreground mt-0.5">{product.dimensions}</p>
        )}
      </div>
    );
  });

  const titleBlock = (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
        {group.experience}
      </p>
      <h3 className="text-lg md:text-xl font-serif italic text-foreground leading-snug">
        {group.room}
      </h3>
      <p className="text-xs text-muted-foreground mt-1">
        {group.products.length} {group.products.length === 1 ? "piece" : "pieces"}
      </p>
    </div>
  );

  /* Portrait on desktop → side-by-side layout */
  if (isPortrait && roomImage) {
    return (
      <div className="mb-14 pb-8 border-b border-border/40 last:border-b-0">
        <div className="flex flex-col md:flex-row md:gap-8">
          {/* Left: image + title */}
          <div className="md:w-[45%] flex-shrink-0">
            <div className="overflow-hidden bg-muted/10 mb-4 md:mb-0 rounded-sm">
              <img
                src={roomImage}
                alt={group.room}
                className="w-full h-auto object-contain"
                style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                loading="lazy"
              />
            </div>
          </div>
          {/* Right: title + products */}
          <div className="flex-1 min-w-0">
            {titleBlock}
            {group.products.length > 0 && (
              <ProductGrid
                items={productItems}
                showAll={showAll}
                total={group.products.length}
                onShowAll={() => setShowAll(true)}
                label="Products in this room"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  /* Landscape / square → stacked layout */
  return (
    <div className="mb-14 pb-8 border-b border-border/40 last:border-b-0">
      {roomImage && (
        <div className="w-full max-w-3xl mx-auto overflow-hidden bg-muted/10 mb-6 rounded-sm">
          <img
            src={roomImage}
            alt={group.room}
            className="w-full h-auto object-contain"
            style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
            loading="lazy"
          />
        </div>
      )}
      {titleBlock}
      {group.products.length > 0 && (
        <ProductGrid
          items={productItems}
          showAll={showAll}
          total={group.products.length}
          onShowAll={() => setShowAll(true)}
          label="Products in this room"
        />
      )}
    </div>
  );
}


/* ─── Brand Designer Card ─── */
function DesignerCard({ designer }: { designer: BrandCatalogueDesigner }) {
  const [showAllPicks, setShowAllPicks] = useState(false);
  const visiblePicks = showAllPicks ? designer.curatorPicks : designer.curatorPicks.slice(0, 4);
  const isPortrait = useImageOrientation(designer.profileImage ?? undefined);

  const pickItems = visiblePicks.map((pick, i) => (
    <div key={i} className="group">
      {pick.image && (
        <div className="aspect-square bg-muted/20 overflow-hidden mb-2">
          <img
            src={pick.image}
            alt={pick.title}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}
      <p className="text-xs font-serif text-foreground leading-tight">{pick.title}</p>
      {pick.materials && (
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{pick.materials}</p>
      )}
      {pick.dimensions && (
        <p className="text-[10px] text-foreground mt-0.5">{pick.dimensions}</p>
      )}
    </div>
  ));

  const infoBlock = (
    <div className="mb-5">
      <h3 className="text-lg md:text-xl font-serif uppercase tracking-wider text-foreground leading-snug">
        {designer.name}
      </h3>
      <p className="text-xs md:text-sm text-muted-foreground mt-2 leading-relaxed">
        {designer.description}
      </p>
      {designer.website && (
        <p className="text-xs text-primary mt-2">{designer.website}</p>
      )}
    </div>
  );

  /* Portrait on desktop → side-by-side */
  if (isPortrait && designer.profileImage) {
    return (
      <div className="mb-10 pb-8 border-b border-border/40 last:border-b-0">
        <div className="flex flex-col md:flex-row md:gap-8">
          <div className="md:w-[45%] flex-shrink-0">
            <div className="overflow-hidden bg-muted/10 mb-4 md:mb-0 rounded-sm">
              <img
                src={designer.profileImage}
                alt={designer.name}
                className="w-full h-auto object-contain"
                loading="lazy"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {infoBlock}
            {designer.curatorPicks.length > 0 && (
              <ProductGrid
                items={pickItems}
                showAll={showAllPicks}
                total={designer.curatorPicks.length}
                onShowAll={() => setShowAllPicks(true)}
                label={`Curators' Picks · ${designer.curatorPicks.length} ${designer.curatorPicks.length === 1 ? "piece" : "pieces"}`}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  /* Landscape / square → stacked */
  return (
    <div className="mb-10 pb-8 border-b border-border/40 last:border-b-0">
      {designer.profileImage && (
        <div className="w-full max-w-3xl mx-auto overflow-hidden bg-muted/10 mb-6 rounded-sm">
          <img
            src={designer.profileImage}
            alt={designer.name}
            className="w-full h-auto object-contain"
            loading="lazy"
          />
        </div>
      )}
      {infoBlock}
      {designer.curatorPicks.length > 0 && (
        <ProductGrid
          items={pickItems}
          showAll={showAllPicks}
          total={designer.curatorPicks.length}
          onShowAll={() => setShowAllPicks(true)}
          label={`Curators' Picks · ${designer.curatorPicks.length} ${designer.curatorPicks.length === 1 ? "piece" : "pieces"}`}
        />
      )}
    </div>
  );
}

/* ─── Catalogue View ─── */
function CatalogueView() {
  const navigate = useNavigate();
  const [view, setView] = useState<"brands" | "gallery">("brands");
  const [groups, setGroups] = useState<GalleryRoomGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const brandCategories = useMemo(() => getBrandCatalogueData(), []);
  const totalBrands = useMemo(() => brandCategories.reduce((sum, c) => sum + c.designers.length, 0), [brandCategories]);
  const totalPicks = useMemo(() => brandCategories.reduce((sum, c) => sum + c.designers.reduce((s, d) => s + d.curatorPicks.length, 0), 0), [brandCategories]);

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
      if (view === "brands") {
        await generateBrandPDF(brandCategories);
      } else {
        await generateGalleryPDF(groups);
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [view, groups, brandCategories]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncHotspotMaterials();
      setSyncResult(`Updated ${result.updated} products. Skipped ${result.skipped}. ${result.noMatch.length} unmatched.`);
      const data = await fetchCatalogueData();
      setGroups(data);
    } catch (err) {
      console.error("Sync failed:", err);
      setSyncResult("Sync failed — check console.");
    } finally {
      setSyncing(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-muted/30 rounded-md p-0.5 border border-border/30">
            <button
              onClick={() => setView("brands")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded transition-all ${
                view === "brands" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-3 h-3" /> Brands
            </button>
            <button
              onClick={() => setView("gallery")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded transition-all ${
                view === "gallery" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3 h-3" /> Gallery
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {view === "gallery" && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="hidden md:flex items-center gap-2 px-3 py-2 border border-foreground/10 text-muted-foreground text-xs uppercase tracking-widest hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync"}
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={generating}
              className="flex items-center gap-2 px-3 md:px-4 py-2 border border-foreground/20 text-foreground text-xs uppercase tracking-widest hover:bg-foreground hover:text-background transition-all disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{generating ? "Generating…" : "Download PDF"}</span>
              <span className="md:hidden">{generating ? "…" : "PDF"}</span>
            </button>
          </div>
        </div>
        {syncResult && (
          <div className="max-w-5xl mx-auto px-6 pb-3">
            <p className="text-xs text-muted-foreground">{syncResult}</p>
          </div>
        )}
      </div>

      {/* Cover / Title Section */}
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-20 text-center">
        <h1 className="text-3xl md:text-4xl font-serif tracking-[0.15em] uppercase text-foreground">
          Maison Affluency
        </h1>
        <p className="text-sm md:text-base text-muted-foreground italic mt-2">
          {view === "brands" ? "2026 Brand Catalogue" : "Gallery Collection Catalogue"}
        </p>
        <div className="w-12 h-px bg-primary/50 mx-auto mt-6" />
        <p className="text-xs text-muted-foreground mt-4">
          {view === "brands"
            ? `${totalBrands} brands & makers · ${totalPicks} curated pieces`
            : `${totalProducts} pieces across ${groups.length} gallery rooms`}
        </p>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-20">
        {view === "brands" ? (
          /* ─── Brand Catalogue View ─── */
          <>
            {brandCategories.map((cat, ci) => (
              <section key={ci} className="mb-16">
                <div className="mb-6 pb-4 border-b border-border/50 text-center">
                  <h2 className="text-xl md:text-2xl font-serif uppercase tracking-[0.15em] text-foreground">
                    {cat.title}
                  </h2>
                  {cat.subtitle && (
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-2">
                      {cat.subtitle}
                    </p>
                  )}
                </div>
                {cat.designers.map((designer) => (
                  <DesignerCard key={designer.id} designer={designer} />
                ))}
              </section>
            ))}
          </>
        ) : (
          /* ─── Gallery Room View ─── */
          <>
            {groups.map((group, gi) => (
              <RoomCard key={gi} group={group} />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 py-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Maison Affluency</p>
        <p className="text-[10px] text-muted-foreground mt-1">www.maisonaffluency.com</p>
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
