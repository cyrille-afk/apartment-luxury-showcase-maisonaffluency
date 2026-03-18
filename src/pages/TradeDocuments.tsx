import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, Search, FolderOpen, FileText, BookOpen, FileSpreadsheet } from "lucide-react";
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

const typeIcons: Record<string, typeof FileText> = {
  tearsheet: FileText,
  catalogue: BookOpen,
  pricelist: FileSpreadsheet,
};

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

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("trade_documents")
        .select("*")
        .order("brand_name", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      setDocuments((data as TradeDocument[]) || []);
      setLoading(false);
    };
    fetchDocuments();
  }, []);

  const brands = useMemo(() => [...new Set(documents.map((d) => d.brand_name))].sort(), [documents]);
  const types = useMemo(() => [...new Set(documents.map((d) => d.document_type))].sort(), [documents]);

  // Build brand entries for carousel with thumbnail from first doc's cover or null
  const brandEntries = useMemo(() => {
    const map = new Map<string, { pdfUrl: string | null; docCount: number }>();
    for (const doc of documents) {
      const existing = map.get(doc.brand_name);
      if (!existing) {
        const isPdf = doc.file_url?.toLowerCase().endsWith(".pdf");
        map.set(doc.brand_name, {
          pdfUrl: isPdf ? doc.file_url : null,
          docCount: 1,
        });
      } else {
        existing.docCount++;
        if (!existing.pdfUrl && doc.file_url?.toLowerCase().endsWith(".pdf")) {
          existing.pdfUrl = doc.file_url;
        }
      }
    }
    return [...map.entries()]
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

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

  const inputClass =
    "px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

  return (
    <>
      <Helmet><title>Documents — Trade Portal — Maison Affluency</title></Helmet>
    <div className="max-w-5xl">
      <SectionHero
        section="documents"
        title="Brand Library"
        subtitle="Access tearsheets, catalogues, and price lists organized by brand."
      />

      {/* Brand carousel */}
      <BrandCarousel
        brands={brandEntries}
        selectedBrand={selectedBrand}
        onSelect={setSelectedBrand}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 mb-6">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full text-[16px] sm:text-sm`}
          />
        </div>
        <div className="flex gap-2">
          <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className={`${inputClass} flex-1 sm:flex-none text-[16px] sm:text-sm`}>
            <option value="all">All Brands</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={`${inputClass} flex-1 sm:flex-none text-[16px] sm:text-sm`}>
            <option value="all">All Types</option>
            {types.map((t) => <option key={t} value={t}>{typeLabels[t] || t}</option>)}
          </select>
        </div>
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
                    <a
                      key={doc.id}
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group border border-border rounded-lg overflow-hidden hover:border-foreground/20 hover:shadow-sm transition-all"
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
                    </a>
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
