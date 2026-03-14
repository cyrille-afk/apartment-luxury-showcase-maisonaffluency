import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Trash2, Copy, ExternalLink, FileText, Image as ImageIcon, File } from "lucide-react";
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
        if (!f.name || f.id === null) continue; // skip sub-folders
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
        <CloudUpload
          folder="documents"
          accept="image/*,application/pdf"
          multiple
          label="Upload files"
          onUpload={() => fetchFiles()}
        />
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
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
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
                  <TableCell>{fileIcon(file.mimeType)}</TableCell>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Copy URL"
                        onClick={() => handleCopy(file.publicUrl)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Open in new tab"
                        asChild
                      >
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
                        {deleting === file.fullPath ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
