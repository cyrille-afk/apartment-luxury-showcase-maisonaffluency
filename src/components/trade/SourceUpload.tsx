import { useState, useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface SourceUploadProps {
  /** Storage folder path */
  folder?: string;
  /** Label for the upload button */
  label?: string;
  /** Called with the public URL after upload */
  onSourceReady: (url: string) => void;
}

/** Upload source image or PDF (with page selector for multi-page PDFs) */
const SourceUpload = ({ folder = "axonometric-sources", label = "Upload image or PDF", onSourceReady }: SourceUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // PDF page picker state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfPreviews, setPdfPreviews] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  const getPdfLib = async () => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    return pdfjsLib;
  };

  const renderPage = async (pdf: any, pageNum: number, scale: number): Promise<string> => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/png");
  };

  const loadPdfPreviews = async (file: File) => {
    setLoadingPreviews(true);
    try {
      const pdfjsLib = await getPdfLib();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const count = pdf.numPages;
      setPdfPageCount(count);
      setSelectedPage(1);

      const maxPreviews = Math.min(count, 20);
      const previews: string[] = [];
      for (let i = 1; i <= maxPreviews; i++) {
        previews.push(await renderPage(pdf, i, 0.5));
      }
      setPdfPreviews(previews);
    } catch (e: any) {
      toast({ title: "Failed to read PDF", description: e.message, variant: "destructive" });
      setPdfFile(null);
    } finally {
      setLoadingPreviews(false);
    }
  };

  const confirmPageSelection = async () => {
    if (!pdfFile) return;
    setUploading(true);
    try {
      const pdfjsLib = await getPdfLib();
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const dataUrl = await renderPage(pdf, selectedPage, 3);

      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { error } = await supabase.storage.from("assets").upload(path, blob, { contentType: "image/png" });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      onSourceReady(urlData.publicUrl);
      setPdfFile(null);
      setPdfPreviews([]);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setPdfFile(file);
      loadPdfPreviews(file);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // Image upload — direct
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      onSourceReady(urlData.publicUrl);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // PDF page picker UI
  if (pdfFile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs text-foreground">
            Select page from PDF{pdfPageCount > 0 ? ` (${pdfPageCount} pages)` : ""}
          </h3>
          <button
            onClick={() => { setPdfFile(null); setPdfPreviews([]); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingPreviews ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 font-body text-xs text-muted-foreground">Loading pages…</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
              {pdfPreviews.map((preview, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPage(i + 1)}
                  className={`relative rounded border overflow-hidden transition-all ${
                    selectedPage === i + 1
                      ? "border-foreground ring-1 ring-foreground"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <img src={preview} alt={`Page ${i + 1}`} className="w-full aspect-[3/4] object-contain bg-white" />
                  <span className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur-sm text-center font-body text-[9px] text-foreground py-0.5">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
            <Button
              onClick={confirmPageSelection}
              disabled={uploading}
              size="sm"
              className="w-full"
            >
              {uploading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Extracting…</>
              ) : (
                <>Use page {selectedPage}</>
              )}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <label
      className={`inline-flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-md cursor-pointer hover:border-foreground/30 transition-colors ${
        uploading ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
      ) : (
        <Upload className="w-3.5 h-3.5 text-muted-foreground" />
      )}
      <span className="font-body text-xs text-muted-foreground">
        {uploading ? "Processing…" : label}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
  );
};

export default SourceUpload;
