import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Trash2, Copy, ExternalLink, FileText, Image as ImageIcon, File, Eye, X, Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CloudUpload from "@/components/trade/CloudUpload";

interface StorageFile {
  name: string;
  folder: string;
  fullPath: string;
  publicUrl: string;
  size: number;
  createdAt: string;
  mimeType: string;
}

const BUCKET = "assets";

const FOLDERS = ["documents", "journal", "journal/pdfs", "products", "provenance", "gallery"];

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function fileIcon(mime: string) {
  if (mime?.startsWith("image")) return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
  if (mime?.includes("pdf")) return <FileText className="h-4 w-4 text-muted-foreground" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default function TradeMediaLibrary() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StorageFile | null>(null);
  const [filterFolder, setFilterFolder] = useState<string>("all");
  const [preview, setPreview] = useState<StorageFile | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchFiles = async () => {
    setLoading(true);
    const allFiles: StorageFile[] = [];

    for (const folder of FOLDERS) {
      const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
        limit: 500,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) continue;
      for (const f of data || []) {
        if (!f.name || f.id === null) continue;
        const fullPath = `${folder}/${f.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
        allFiles.push({
          name: f.name,
          folder,
          fullPath,
          publicUrl: urlData.publicUrl,
          size: (f.metadata as any)?.size ?? 0,
          createdAt: f.created_at ?? "",
          mimeType: (f.metadata as any)?.mimetype ?? "",
        });
      }
    }

    allFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFiles(allFiles);
    setLoading(false);
  };

  useEffect(() => { fetchFiles(); }, []);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "URL copied to clipboard" });
  };

  const handleDelete = async (file: StorageFile) => {
    setDeleting(file.fullPath);
    const { error } = await supabase.storage.from(BUCKET).remove([file.fullPath]);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "File deleted" });
      setFiles((prev) => prev.filter((f) => f.fullPath !== file.fullPath));
    }
    setDeleting(null);
    setConfirmDelete(null);
  };

  const filtered = filterFolder === "all" ? files : files.filter((f) => f.folder === filterFolder);
  const isImage = (mime: string) => mime?.startsWith("image");
  const isPdf = (mime: string) => mime?.includes("pdf");

  if (!isAdmin) {
    return <p className="p-8 font-body text-sm text-muted-foreground">Admin access required.</p>;
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-foreground">Media Library</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {files.length} file{files.length !== 1 ? "s" : ""} across all folders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              title="Grid view"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <CloudUpload
            folder="documents"
            accept="image/*,application/pdf"
            multiple
            label="Upload files"
            onUpload={() => fetchFiles()}
          />
        </div>
      </div>

      {/* Folder filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterFolder("all")}
          className={`px-3 py-1.5 rounded-md font-body text-xs transition-colors ${
            filterFolder === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All
        </button>
        {FOLDERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilterFolder(f)}
            className={`px-3 py-1.5 rounded-md font-body text-xs transition-colors ${
              filterFolder === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center font-body text-sm text-muted-foreground">No files found.</p>
      ) : viewMode === "grid" ? (
        /* ── Grid View ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((file) => (
            <div
              key={file.fullPath}
              className="group border border-border rounded-lg overflow-hidden bg-card hover:border-foreground/20 transition-colors"
            >
              {/* Thumbnail */}
              <button
                onClick={() => setPreview(file)}
                className="relative w-full aspect-square bg-muted/30 flex items-center justify-center overflow-hidden cursor-pointer"
              >
                {isImage(file.mimeType) ? (
                  <img
                    src={file.publicUrl}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : isPdf(file.mimeType) ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="h-10 w-10" />
                    <span className="font-body text-[10px] uppercase tracking-wider">PDF</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <File className="h-10 w-10" />
                    <span className="font-body text-[10px] uppercase tracking-wider">{file.mimeType?.split("/")[1] || "File"}</span>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors flex items-center justify-center">
                  <Eye className="h-5 w-5 text-background opacity-0 group-hover:opacity-70 transition-opacity drop-shadow-lg" />
                </div>
              </button>

              {/* Info */}
              <div className="p-2.5 space-y-1.5">
                <p className="font-body text-xs text-foreground truncate" title={file.name}>
                  {file.name}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-body text-[10px] text-muted-foreground">{file.folder} · {formatBytes(file.size)}</span>
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Copy URL" onClick={() => handleCopy(file.publicUrl)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Open" asChild>
                    <a href={file.publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Delete"
                    disabled={deleting === file.fullPath}
                    onClick={() => setConfirmDelete(file)}
                  >
                    {deleting === file.fullPath ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── List View ── */
        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Preview</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Folder</TableHead>
                <TableHead className="hidden sm:table-cell">Size</TableHead>
                <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((file) => (
                <TableRow key={file.fullPath}>
                  <TableCell>
                    <button onClick={() => setPreview(file)} className="block w-10 h-10 rounded overflow-hidden bg-muted/30 flex-shrink-0">
                      {isImage(file.mimeType) ? (
                        <img src={file.publicUrl} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center">{fileIcon(file.mimeType)}</span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-body text-sm max-w-[200px] truncate" title={file.name}>
                    {file.name}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-body text-xs text-muted-foreground">
                    {file.folder}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-body text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-body text-xs text-muted-foreground">
                    {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy URL" onClick={() => handleCopy(file.publicUrl)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Open in new tab" asChild>
                        <a href={file.publicUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Delete"
                        disabled={deleting === file.fullPath}
                        onClick={() => setConfirmDelete(file)}
                      >
                        {deleting === file.fullPath ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Preview Lightbox ── */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-foreground/80 flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <div className="relative max-w-4xl w-full max-h-[85vh] bg-background rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm text-foreground truncate">{preview.name}</p>
                <p className="font-body text-[10px] text-muted-foreground">{preview.folder} · {formatBytes(preview.size)} · {preview.createdAt ? new Date(preview.createdAt).toLocaleDateString() : ""}</p>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy URL" onClick={() => handleCopy(preview.publicUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <a href={preview.publicUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreview(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center bg-muted/20 overflow-auto" style={{ maxHeight: "calc(85vh - 56px)" }}>
              {isImage(preview.mimeType) ? (
                <img src={preview.publicUrl} alt={preview.name} className="max-w-full max-h-[calc(85vh-56px)] object-contain" />
              ) : isPdf(preview.mimeType) ? (
                <iframe src={preview.publicUrl} className="w-full" style={{ height: "calc(85vh - 56px)" }} title={preview.name} />
              ) : (
                <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
                  <File className="h-16 w-16" />
                  <p className="font-body text-sm">Preview not available</p>
                  <Button variant="outline" size="sm" asChild>
                    <a href={preview.publicUrl} target="_blank" rel="noopener noreferrer">Download file</a>
                  </Button>
                </div>
              )}
            </div>
            {/* URL bar */}
            <div className="px-5 py-2.5 border-t border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={preview.publicUrl}
                  className="flex-1 bg-transparent font-mono text-[10px] text-muted-foreground outline-none select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleCopy(preview.publicUrl)}>
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{confirmDelete?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
