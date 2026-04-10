import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, Search, FolderOpen, FileText, BookOpen, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import SectionHero from "@/components/trade/SectionHero";
import BrandCarousel from "@/components/trade/BrandCarousel";
import { DocumentCardSkeleton } from "@/components/trade/skeletons";

const PdfThumbnail = lazy(() => import("@/components/trade/PdfThumbnail"));

interface TradeDocument {
  id: string;
  title: string;
  brand_name: string;
  document_type: string;
  file_url: string;
  file_size_bytes: number | null;
  cover_image_url: string | null;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  tearsheet: "Tearsheet",
  catalogue: "Catalogue",
  pricelist: "Price List",
  specification: "Specification",
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const TradeDocuments = () => {
  const [documents, setDocuments] = useState<TradeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();
  const initialBrand = searchParams.get("brand") || "all";
  const [selectedBrand, setSelectedBrand] = useState(initialBrand);
  const [selectedType, setSelectedType] = useState("all");
  const [atelierNames, setAtelierNames] = useState<Set<string>>(new Set());
  const [mobileCarouselMode, setMobileCarouselMode] = useState<"ateliers" | "designers">("ateliers");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [docsRes, designersRes] = await Promise.all([
        supabase
          .from("trade_documents")
          .select("*")
          .order("brand_name", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("designers")
          .select("name, founder")
          .eq("is_published", true),
      ]);
      setDocuments((docsRes.data as TradeDocument[]) || []);
      // Build atelier set from designers table:
      // 1. Any founder value (brands that have designers under them)
      // 2. Any name where founder === name (self-referencing atelier cards)
      const ateliers = new Set<string>();
      for (const d of designersRes.data || []) {
        if (d.founder) ateliers.add(d.founder);
      }
      // Also detect atelier-like brand names not yet in the designers table
      const atelierKeywords = ["editions", "collection", "atelier", "studio"];
      const docBrands = new Set((docsRes.data as TradeDocument[])?.map((doc) => doc.brand_name) || []);
      for (const brandName of docBrands) {
        if (!ateliers.has(brandName)) {
          const lower = brandName.toLowerCase();
          if (atelierKeywords.some((kw) => lower.includes(kw))) {
            ateliers.add(brandName);
          }
        }
      }
      setAtelierNames(ateliers);
      setLoading(false);
    };
    fetchData();
  }, []);

  const types = useMemo(() => [...new Set(documents.map((d) => d.document_type))].sort(), [documents]);

  // Build carousel entries split by atelier vs designer
  const { atelierEntries, designerEntries } = useMemo(() => {
    const map = new Map<string, { pdfUrl: string | null; docCount: number }>();
    for (const doc of documents) {
      const existing = map.get(doc.brand_name);
      if (!existing) {
        const isPdf = doc.file_url?.toLowerCase().endsWith(".pdf");
        map.set(doc.brand_name, { pdfUrl: isPdf ? doc.file_url : null, docCount: 1 });
      } else {
        existing.docCount++;
        if (!existing.pdfUrl && doc.file_url?.toLowerCase().endsWith(".pdf")) {
          existing.pdfUrl = doc.file_url;
        }
      }
    }
    const ateliers: { name: string; docCount: number; pdfUrl?: string | null; isAtelier?: boolean }[] = [];
    const designers: { name: string; docCount: number; pdfUrl?: string | null }[] = [];
    for (const [name, info] of map) {
      if (atelierNames.has(name)) {
        ateliers.push({ name, ...info, isAtelier: true });
      } else {
        designers.push({ name, ...info });
      }
    }
    ateliers.sort((a, b) => a.name.localeCompare(b.name));
    designers.sort((a, b) => a.name.localeCompare(b.name));
    return { atelierEntries: ateliers, designerEntries: designers };
  }, [documents, atelierNames]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchesSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.brand_name.toLowerCase().includes(search.toLowerCase());
      const matchesBrand = selectedBrand === "all" || d.brand_name === selectedBrand;
      const matchesType = selectedType === "all" || d.document_type === selectedType;
      return matchesSearch && matchesBrand && matchesType;
    });
  }, [documents, search, selectedBrand, selectedType]);

  // Group by brand
  const grouped = useMemo(() => {
    const map = new Map<string, TradeDocument[]>();
    for (const doc of filtered) {
      const list = map.get(doc.brand_name) || [];
      list.push(doc);
      map.set(doc.brand_name, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleCarouselSelect = (b: string) => {
    setSelectedBrand(b);
  };

  const inputClass =
    "px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

  return (
    <>
      <Helmet><title>Resources — Trade Portal — Maison Affluency</title></Helmet>
    <div className="max-w-5xl space-y-6">
      <SectionHero
        section="documents"
        title="Resources"
        subtitle="Access Catalogues, Price lists and Spec Sheets when available, organised by Ateliers and Designers."
      />

      {/* Carousels */}
      {(atelierEntries.length > 0 || designerEntries.length > 0) && (
        <>
          {/* Desktop: two stacked carousels */}
          <div className="hidden sm:block space-y-4">
            {atelierEntries.length > 0 && (
              <BrandCarousel
                brands={atelierEntries}
                selectedBrand={selectedBrand}
                onSelect={handleCarouselSelect}
                label={
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2">
                    Ateliers · {atelierEntries.length} brands
                  </p>
                }
              />
            )}
            {designerEntries.length > 0 && (
              <BrandCarousel
                brands={designerEntries}
                selectedBrand={selectedBrand}
                onSelect={handleCarouselSelect}
                label={
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2">
                    Designers · {designerEntries.length}
                  </p>
                }
              />
            )}
          </div>

          {/* Mobile: toggle between carousels */}
          <div className="sm:hidden space-y-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMobileCarouselMode("ateliers")}
                className={cn(
                  "px-3 py-1.5 rounded-full font-body text-[10px] uppercase tracking-[0.12em] transition-all border",
                  mobileCarouselMode === "ateliers"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                Ateliers · {atelierEntries.length}
              </button>
              <button
                onClick={() => setMobileCarouselMode("designers")}
                className={cn(
                  "px-3 py-1.5 rounded-full font-body text-[10px] uppercase tracking-[0.12em] transition-all border",
                  mobileCarouselMode === "designers"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                Designers · {designerEntries.length}
              </button>
            </div>
            <BrandCarousel
              brands={mobileCarouselMode === "ateliers" ? atelierEntries : designerEntries}
              selectedBrand={selectedBrand}
              onSelect={handleCarouselSelect}
            />
          </div>
        </>
      )}

      {/* Filters: search + type only */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 mb-6">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full text-[16px] sm:text-sm`}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={`${inputClass} text-[16px] sm:text-sm`}>
          <option value="all">All Types</option>
          {types.map((t) => <option key={t} value={t}>{typeLabels[t] || t}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => <DocumentCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground">
            {documents.length === 0
              ? "No documents have been uploaded yet. Documents will appear here once an admin adds them."
              : "No documents match your search criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([brand, docs]) => (
            <div key={brand}>
              <h2 className="font-display text-base text-foreground mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                {brand}
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider ml-1">
                  {docs.length} {docs.length === 1 ? "file" : "files"}
                </span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
                {docs.map((doc) => {
                  const isPdf = doc.file_url.toLowerCase().endsWith(".pdf");
                  return (
                    <button
                      key={doc.id}
                      onClick={async (e) => {
                        e.preventDefault();
                        // Track download with country
                        supabase.auth.getUser().then(async ({ data }) => {
                          if (data?.user) {
                            let country = "";
                            const { data: app } = await supabase
                              .from("trade_applications")
                              .select("country")
                              .eq("user_id", data.user.id)
                              .maybeSingle();
                            if (app?.country) country = app.country;
                            supabase.from("document_downloads").insert({
                              user_id: data.user.id,
                              document_id: doc.id,
                              country,
                            }).then(() => {});
                          }
                        });
                        try {
                          const res = await fetch(doc.file_url);
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          const ext = doc.file_url.split(".").pop()?.split("?")[0] || "pdf";
                          a.download = `${doc.brand_name} — ${doc.title}.${ext}`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch {
                          window.open(doc.file_url, "_blank");
                        }
                      }}
                      className="group text-left border border-border rounded-lg overflow-hidden hover:border-foreground/20 hover:shadow-sm transition-all cursor-pointer"
                    >
                      {/* Cover thumbnail */}
                      <div className="aspect-[3/4] bg-muted/20 relative overflow-hidden">
                        {doc.cover_image_url ? (
                          <img src={doc.cover_image_url} alt={doc.title} className="w-full h-full object-cover" />
                        ) : isPdf ? (
                          <Suspense
                            fallback={
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                              </div>
                            }
                          >
                            <PdfThumbnail url={doc.file_url} alt={doc.title} className="w-full h-full" />
                          </Suspense>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="h-10 w-10 text-muted-foreground/20" />
                          </div>
                        )}
                        {/* Download overlay */}
                        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity p-3 rounded-full bg-[hsl(var(--pdf-red))] text-white shadow-lg">
                            <FileDown className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <p className="font-body text-sm text-foreground truncate leading-tight">{doc.title}</p>
                        <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                          {typeLabels[doc.document_type] || doc.document_type}
                          {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
};

export default TradeDocuments;
