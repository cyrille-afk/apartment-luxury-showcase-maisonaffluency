import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, Search, FolderOpen, FileText, BookOpen, FileSpreadsheet } from "lucide-react";

const PdfThumbnail = lazy(() => import("@/components/trade/PdfThumbnail"));

interface TradeDocument {
  id: string;
  title: string;
  brand_name: string;
  document_type: string;
  file_url: string;
  file_size_bytes: number | null;
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
        .order("brand_name", { ascending: true });
      setDocuments((data as TradeDocument[]) || []);
      setLoading(false);
    };
    fetchDocuments();
  }, []);

  const brands = useMemo(() => [...new Set(documents.map((d) => d.brand_name))].sort(), [documents]);
  const types = useMemo(() => [...new Set(documents.map((d) => d.document_type))].sort(), [documents]);

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
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-foreground mb-1">Document Library</h1>
      <p className="font-body text-sm text-muted-foreground mb-6">
        Access tearsheets, catalogues, and price lists organized by brand.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full`}
          />
        </div>
        <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className={inputClass}>
          <option value="all">All Brands</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={inputClass}>
          <option value="all">All Types</option>
          {types.map((t) => <option key={t} value={t}>{typeLabels[t] || t}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
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
              <div className="space-y-1.5">
                {docs.map((doc) => {
                  const Icon = typeIcons[doc.document_type] || FileText;
                  return (
                    <a
                      key={doc.id}
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 border border-border rounded-md hover:border-foreground/20 hover:bg-muted/30 transition-colors group"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm text-foreground truncate">{doc.title}</p>
                        <p className="font-body text-[10px] text-muted-foreground">
                          {typeLabels[doc.document_type] || doc.document_type}
                          {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ""}
                        </p>
                      </div>
                      <FileDown className="h-4 w-4 text-[hsl(var(--pdf-red))] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradeDocuments;
