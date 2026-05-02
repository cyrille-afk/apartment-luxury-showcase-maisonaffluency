import { useState, useEffect, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText, X, Image, Loader2, ArrowUp, ArrowDown, Star } from "lucide-react";
import CloudUpload from "@/components/trade/CloudUpload";
import BrandCarousel from "@/components/trade/BrandCarousel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TradeDocument {
  id: string;
  title: string;
  brand_name: string;
  document_type: string;
  file_url: string;
  file_size_bytes: number | null;
  cover_image_url: string | null;
  sort_order: number;
  created_at: string;
  is_featured_public: boolean;
}

const DOC_TYPES = ["tearsheet", "catalogue", "pricelist", "specification"];
const DOC_TYPE_LABELS: Record<string, string> = {
  tearsheet: "Tearsheet",
  catalogue: "Catalogue",
  pricelist: "Price List",
  specification: "Specification",
};

const emptyDoc = (): Omit<TradeDocument, "id" | "created_at"> => ({
  title: "",
  brand_name: "",
  document_type: "catalogue",
  file_url: "",
  file_size_bytes: null,
  cover_image_url: null,
  sort_order: 0,
  is_featured_public: false,
});

const inputClass =
  "w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors";

/** Extract the first page of a PDF as a high-quality JPEG blob */
async function extractPdfCover(pdfUrl: string): Promise<Blob> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const pdf = await pdfjsLib.getDocument({ url: pdfUrl, disableAutoFetch: true, disableStream: true }).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const scale = 400 / vp.width; // 400px wide for good carousel quality
  const svp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = svp.width;
  canvas.height = svp.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: svp }).promise;
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))), "image/jpeg", 0.85);
  });
}

const TradeDocumentsAdmin = () => {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<TradeDocument[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<Omit<TradeDocument, "id" | "created_at"> & { id?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TradeDocument | null>(null);
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [extractingThumbnailId, setExtractingThumbnailId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) fetchDocs();
  }, [isAdmin]);

  const fetchDocs = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("trade_documents")
      .select("*")
      .order("brand_name", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setDocuments((data as TradeDocument[]) || []);
    setFetching(false);
  };

  /** Swap sort_order of two documents within the same brand (optimistic, no refetch) */
  const handleReorder = useCallback(async (doc: TradeDocument, direction: "up" | "down") => {
    const brandDocs = documents.filter(d => d.brand_name === doc.brand_name);
    const idx = brandDocs.findIndex(d => d.id === doc.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= brandDocs.length) return;

    const other = brandDocs[swapIdx];
    const myOrder = doc.sort_order;
    const otherOrder = other.sort_order;
    const newMyOrder = otherOrder;
    const newOtherOrder = myOrder === otherOrder ? myOrder + (direction === "up" ? 1 : -1) : myOrder;

    // Optimistic local update
    setDocuments(prev => {
      const updated = prev.map(d => {
        if (d.id === doc.id) return { ...d, sort_order: newMyOrder };
        if (d.id === other.id) return { ...d, sort_order: newOtherOrder };
        return d;
      });
      return updated.sort((a, b) =>
        a.brand_name.localeCompare(b.brand_name) || a.sort_order - b.sort_order
      );
    });

    await Promise.all([
      supabase.from("trade_documents").update({ sort_order: newMyOrder }).eq("id", doc.id),
      supabase.from("trade_documents").update({ sort_order: newOtherOrder }).eq("id", other.id),
    ]);
  }, [documents]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.brand_name.trim() || !editing.file_url.trim()) {
      toast({ title: "Title, brand, and file URL are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      title: editing.title,
      brand_name: editing.brand_name,
      document_type: editing.document_type,
      file_url: editing.file_url,
      file_size_bytes: editing.file_size_bytes,
      cover_image_url: editing.cover_image_url || null,
    };

    let error;
    if (editing.id) {
      ({ error } = await supabase.from("trade_documents").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("trade_documents").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editing.id ? "Document updated" : "Document added" });
    setEditing(null);
    fetchDocs();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("trade_documents").delete().eq("id", deleteTarget.id);
    toast({ title: "Document deleted" });
    setDeleteTarget(null);
    fetchDocs();
  };

  /**
   * Toggle the public Featured Read flag. The DB has a partial unique index
   * enforcing a single active featured row, so we explicitly clear any
   * existing featured doc first when promoting a new one.
   */
  const handleToggleFeatured = useCallback(async (doc: TradeDocument) => {
    if (doc.is_featured_public) {
      // Un-feature
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, is_featured_public: false } : d));
      const { error } = await supabase
        .from("trade_documents")
        .update({ is_featured_public: false })
        .eq("id", doc.id);
      if (error) {
        toast({ title: "Could not un-feature", description: error.message, variant: "destructive" });
        fetchDocs();
        return;
      }
      toast({ title: "Featured Read cleared", description: `"${doc.title}" is no longer the public featured catalogue.` });
      return;
    }

    // Feature this one — clear any other featured first to honor the unique index
    setDocuments(prev => prev.map(d => ({ ...d, is_featured_public: d.id === doc.id })));
    const { error: clearErr } = await supabase
      .from("trade_documents")
      .update({ is_featured_public: false })
      .eq("is_featured_public", true);
    if (clearErr) {
      toast({ title: "Could not update Featured Read", description: clearErr.message, variant: "destructive" });
      fetchDocs();
      return;
    }
    const { error: setErr } = await supabase
      .from("trade_documents")
      .update({ is_featured_public: true })
      .eq("id", doc.id);
    if (setErr) {
      toast({ title: "Could not set Featured Read", description: setErr.message, variant: "destructive" });
      fetchDocs();
      return;
    }
    toast({ title: "Featured Read updated", description: `"${doc.title}" is now the public featured catalogue.` });
  }, [toast]);

  const handleSetAsBrandThumbnail = useCallback(async (doc: TradeDocument) => {
    const isPdf = doc.file_url?.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast({ title: "Only PDF documents can be extracted", variant: "destructive" });
      return;
    }
    setExtractingThumbnailId(doc.id);
    try {
      const blob = await extractPdfCover(doc.file_url);
      const path = `brand-thumbnails/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: uploadError } = await supabase.storage.from("assets").upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      const { error: upsertError } = await supabase
        .from("brand_thumbnails")
        .upsert({ brand_name: doc.brand_name, thumbnail_url: urlData.publicUrl }, { onConflict: "brand_name" });
      if (upsertError) throw upsertError;

      toast({ title: `Brand thumbnail set`, description: `"${doc.title}" cover → ${doc.brand_name} carousel` });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setExtractingThumbnailId(null);
    }
  }, [toast]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  if (editing) {
    return (
      <>
        <Helmet><title>{editing.id ? "Edit" : "New"} Document — Admin — Maison Affluency</title></Helmet>
        <div className="max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-2xl text-foreground">
              {editing.id ? "Edit Document" : "New Document"}
            </h1>
            <button onClick={() => setEditing(null)} className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Title</label>
              <input
                value={editing.title}
                onChange={(e) => setEditing(prev => prev ? { ...prev, title: e.target.value } : null)}
                className={inputClass}
                placeholder="e.g. Pouenat 2025 Catalogue"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Brand</label>
                <input
                  value={editing.brand_name}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, brand_name: e.target.value } : null)}
                  className={inputClass}
                  placeholder="e.g. Pouenat"
                />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Type</label>
                <select
                  value={editing.document_type}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, document_type: e.target.value } : null)}
                  className={inputClass}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cover image URL */}
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Cover Image URL <span className="normal-case tracking-normal text-muted-foreground/50">(optional — for non-PDF links)</span></label>
              <input
                value={editing.cover_image_url || ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, cover_image_url: e.target.value || null } : null)}
                className={inputClass}
                placeholder="https://… paste a cover image URL"
              />
            </div>

            {/* File upload */}
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider block mb-1">Document File</label>
              <div className="flex items-center gap-3">
                <CloudUpload
                  folder="documents"
                  accept="application/pdf,.pdf"
                  label="Upload PDF"
                  onUpload={(urls) => setEditing(prev => prev ? { ...prev, file_url: urls[0] } : null)}
                />
                {editing.file_url && (
                  <button
                    onClick={() => setEditing(prev => prev ? { ...prev, file_url: "" } : null)}
                    className="p-1 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {editing.file_url && (
                <p className="mt-2 font-body text-[10px] text-primary truncate">
                  ✓ File attached — <a href={editing.file_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{editing.file_url.split("/").pop()}</a>
                </p>
              )}
              <input
                value={editing.file_url}
                onChange={(e) => setEditing(prev => prev ? { ...prev, file_url: e.target.value } : null)}
                className="w-full mt-2 pb-2 border-b border-border bg-transparent font-body text-[10px] text-muted-foreground/60 outline-none focus:border-foreground transition-colors font-mono"
                placeholder="Or paste URL manually…"
              />
            </div>

            {/* Save */}
            <div className="flex justify-end pt-4 border-t border-border">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving…" : editing.id ? "Update Document" : "Add Document"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Documents — Admin — Maison Affluency</title></Helmet>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-foreground">Manage Documents</h1>
          <button
            onClick={() => setEditing(emptyDoc())}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Document
          </button>
        </div>

        {/* Brand carousel */}
        {(() => {
          const brandMap = new Map<string, { pdfUrl: string | null; docCount: number }>();
          for (const doc of documents) {
            const existing = brandMap.get(doc.brand_name);
            if (!existing) {
              const isPdf = doc.file_url?.toLowerCase().endsWith(".pdf");
              brandMap.set(doc.brand_name, { pdfUrl: isPdf ? doc.file_url : null, docCount: 1 });
            } else {
              existing.docCount++;
              if (!existing.pdfUrl && doc.file_url?.toLowerCase().endsWith(".pdf")) existing.pdfUrl = doc.file_url;
            }
          }
          const brandEntries = [...brandMap.entries()]
            .map(([name, info]) => ({ name, ...info }))
            .sort((a, b) => a.name.localeCompare(b.name));

          if (brandEntries.length === 0) return null;
          return (
            <BrandCarousel
              brands={brandEntries}
              selectedBrand={selectedBrand}
              onSelect={setSelectedBrand}
              editable
            />
          );
        })()}

        {fetching ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse border border-border rounded-lg p-5">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-display text-lg text-foreground mb-2">No documents yet</p>
            <p className="font-body text-sm text-muted-foreground mb-6">Upload catalogues, tearsheets, and price lists.</p>
            <button
              onClick={() => setEditing(emptyDoc())}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Document
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {documents
              .filter((doc) => selectedBrand === "all" || doc.brand_name === selectedBrand)
              .map((doc) => (
              <div key={doc.id} className="border border-border rounded-lg p-5 flex items-center gap-4">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-sm text-foreground truncate">{doc.title}</h3>
                  <p className="font-body text-[10px] text-muted-foreground">
                    {doc.brand_name} · {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Reorder within brand */}
                  {(() => {
                    const brandDocs = documents.filter(d => d.brand_name === doc.brand_name);
                    const idx = brandDocs.findIndex(d => d.id === doc.id);
                    return (
                      <>
                        <button
                          onClick={() => handleReorder(doc, "up")}
                          disabled={idx <= 0}
                          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReorder(doc, "down")}
                          disabled={idx >= brandDocs.length - 1}
                          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </>
                    );
                  })()}
                  <span className="w-px h-4 bg-border mx-0.5" />
                  {doc.file_url?.toLowerCase().endsWith(".pdf") && (
                    <button
                      onClick={() => handleSetAsBrandThumbnail(doc)}
                      disabled={extractingThumbnailId === doc.id}
                      className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      title="Use cover as brand thumbnail"
                    >
                      {extractingThumbnailId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Image className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setEditing({ ...doc })}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(doc)}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete Document</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Are you sure you want to delete "<span className="font-medium text-foreground">{deleteTarget?.title}</span>"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="font-body text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TradeDocumentsAdmin;
