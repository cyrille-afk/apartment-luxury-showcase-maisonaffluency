import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText, X } from "lucide-react";
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
  created_at: string;
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
});

const inputClass =
  "w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors";

const TradeDocumentsAdmin = () => {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<TradeDocument[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<Omit<TradeDocument, "id" | "created_at"> & { id?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TradeDocument | null>(null);
  const [selectedBrand, setSelectedBrand] = useState("all");

  useEffect(() => {
    if (isAdmin) fetchDocs();
  }, [isAdmin]);

  const fetchDocs = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("trade_documents")
      .select("*")
      .order("brand_name", { ascending: true });
    setDocuments((data as TradeDocument[]) || []);
    setFetching(false);
  };

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
          const brandMap = new Map<string, { thumbnailUrl: string | null; docCount: number }>();
          for (const doc of documents) {
            const existing = brandMap.get(doc.brand_name);
            if (!existing) {
              brandMap.set(doc.brand_name, { thumbnailUrl: doc.cover_image_url || null, docCount: 1 });
            } else {
              existing.docCount++;
              if (!existing.thumbnailUrl && doc.cover_image_url) existing.thumbnailUrl = doc.cover_image_url;
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
