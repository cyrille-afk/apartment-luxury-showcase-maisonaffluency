import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import AuthGateDialog from "@/components/AuthGateDialog";

const toSlug = (s: string) =>
  s.toLowerCase()
    .replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i").replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u").replace(/[ñ]/g, "n")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

interface PickWithBrand {
  title: string;
  pdf_url: string;
  image_url: string;
  materials: string | null;
  dimensions: string | null;
  brand: string;
  brandSlug: string;
  productSlug: string;
}

/**
 * /spec-sheets/:slug
 * If slug matches a designer → show all their PDFs
 * If slug matches a designer-product → redirect to spec sheet viewer
 */
export default function SpecSheetRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);

  const [mode, setMode] = useState<"loading" | "not-found" | "designer-index">("loading");
  const [picks, setPicks] = useState<PickWithBrand[]>([]);
  const [designerName, setDesignerName] = useState("");

  useEffect(() => {
    if (!slug) { setMode("not-found"); return; }

    const resolve = async () => {
      const { data: rawPicks } = await supabase
        .from("designer_curator_picks_public")
        .select("title, pdf_url, image_url, materials, dimensions, designer_id")
        .not("pdf_url", "is", null);

      if (!rawPicks?.length) { setMode("not-found"); return; }

      const designerIds = [...new Set(rawPicks.map(p => p.designer_id))];
      const { data: designers } = await supabase
        .from("designers")
        .select("id, name, slug")
        .in("id", designerIds);

      const designerMap = new Map(designers?.map(d => [d.id, d]) || []);

      // Check if slug matches a designer
      const matchedDesigner = designers?.find(d => d.slug === slug || toSlug(d.name) === slug);

      if (matchedDesigner) {
        const designerPicks = rawPicks
          .filter(p => p.designer_id === matchedDesigner.id)
          .map(p => ({
            title: p.title,
            pdf_url: p.pdf_url!,
            image_url: p.image_url,
            materials: p.materials,
            dimensions: p.dimensions,
            brand: matchedDesigner.name,
            brandSlug: toSlug(matchedDesigner.name),
            productSlug: toSlug(`${matchedDesigner.name}-${p.title}`),
          }));

        setDesignerName(matchedDesigner.name);
        setPicks(designerPicks);
        setMode("designer-index");
        return;
      }

      // Check if slug matches a specific product
      for (const pick of rawPicks) {
        const designer = designerMap.get(pick.designer_id);
        if (!designer) continue;
        const candidate = toSlug(`${designer.name}-${pick.title}`);
        if (candidate === slug) {
          navigate(
            `/trade/spec-sheet?brand=${encodeURIComponent(designer.name)}&product=${encodeURIComponent(pick.title)}`,
            { replace: true }
          );
          return;
        }
      }

      setMode("not-found");
    };

    resolve();
  }, [slug, navigate]);

  if (mode === "loading" || authLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (mode === "not-found") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="font-body text-sm text-muted-foreground">Spec sheets not found.</p>
      </div>
    );
  }

  /* ── Auth gate ── */
  if (!user) {
    return (
      <>
        <Helmet>
          <title>{designerName} — Spec Sheets | Maison & Ateliers</title>
        </Helmet>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-6 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl text-foreground mb-2">{designerName} — Spec Sheets</h1>
            <p className="font-body text-sm text-muted-foreground max-w-md">
              Register or sign in to view and download spec sheets.
            </p>
          </div>
          <Button
            className="gap-2 bg-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/90 text-white"
            onClick={() => setGateOpen(true)}
          >
            <FileDown className="w-4 h-4" />
            Sign in to view
          </Button>
        </div>
        <AuthGateDialog open={gateOpen} onClose={() => setGateOpen(false)} action="view spec sheets" />
      </>
    );
  }

  /* ── Designer index: list all spec sheets ── */
  return (
    <>
      <Helmet>
        <title>{designerName} — Spec Sheets | Maison & Ateliers</title>
        <meta name="description" content={`Download ${designerName} product spec sheets — materials, dimensions, and technical specifications.`} />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
        <div className="mb-10">
          <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Spec Sheets</p>
          <h1 className="font-display text-2xl md:text-3xl text-foreground">{designerName}</h1>
          <p className="font-body text-sm text-muted-foreground mt-2">
            {picks.length} spec sheet{picks.length !== 1 ? "s" : ""} available
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {picks.map((pick) => (
            <Link
              key={pick.productSlug}
              to={`/trade/spec-sheet?brand=${encodeURIComponent(pick.brand)}&product=${encodeURIComponent(pick.title)}`}
              className="group block rounded-xl border border-border bg-card hover:shadow-md transition-shadow overflow-hidden"
            >
              {pick.image_url && (
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={pick.image_url}
                    alt={pick.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-display text-sm text-foreground mb-1">{pick.title}</h2>
                {pick.materials && (
                  <p className="font-body text-[11px] text-muted-foreground truncate">{pick.materials}</p>
                )}
                {pick.dimensions && (
                  <p className="font-body text-[11px] text-muted-foreground">{pick.dimensions}</p>
                )}
                <div className="flex items-center gap-1.5 mt-3 text-[hsl(var(--pdf-red))]">
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="font-body text-xs font-medium">View Spec Sheet</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
