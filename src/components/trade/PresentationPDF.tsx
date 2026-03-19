import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

// Register fonts with error handling — use try/catch so PDF still renders if fonts fail
try {
  Font.register({
    family: "Inter",
    fonts: [
      { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf", fontWeight: 300 },
    ],
  });
} catch (e) {
  console.warn("Failed to register Inter font:", e);
}

try {
  Font.register({
    family: "Cormorant",
    fonts: [
      { src: "https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjQAllvuQWJ5heb_w.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/cormorantgaramond/v16/co3YmX5slCNuHLi8bLeY9MK7whWMhyjYrEPjuw-NxBKL_y94.ttf", fontWeight: 300 },
    ],
  });
} catch (e) {
  console.warn("Failed to register Cormorant font:", e);
}

// Disable hyphenation to avoid crash
Font.registerHyphenationCallback((word) => [word]);

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
});

interface PresentationPDFProps {
  title: string;
  clientName?: string;
  projectName?: string;
  createdAt: string;
  slides: {
    image_url: string;
    title: string;
    description?: string | null;
    project_name?: string | null;
    style_preset?: string | null;
  }[];
}

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

const PresentationPDF = ({ title, clientName, projectName, createdAt, slides }: PresentationPDFProps) => (
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

    {/* Slide Pages */}
    {slides.map((slide, i) => (
      <Page key={i} size="A4" orientation="landscape" style={s.page}>
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
        <Text style={s.footer}>{i + 2} / {slides.length + 1}</Text>
      </Page>
    ))}
  </Document>
);

export default PresentationPDF;
