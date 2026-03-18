import { useState, useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SourceUploadProps {
  /** Storage folder path */
  folder?: string;
  /** Label for the upload button */
  label?: string;
  /** Called with the public URL after upload */
  onSourceReady: (url: string) => void;
}

const MAX_PREVIEW_PAGES = 20;
const MAX_UPLOAD_DIMENSION = 4096;
const MAX_UPLOAD_PIXELS = 12_000_000;
const PDF_PARSE_TIMEOUT_MS = 30000;
const PDF_RENDER_TIMEOUT_MS = 20000;

type PdfModule = Awaited<ReturnType<typeof import("pdfjs-dist")>>;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
};

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

  const getPdfLib = async (): Promise<PdfModule> => {
    const pdfjsLib = await import("pdfjs-dist");

    try {
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }

    return pdfjsLib;
  };

  const renderPagePreview = async (pdf: any, pageNum: number, scale: number): Promise<string> => {
    const page = await withTimeout(
      pdf.getPage(pageNum),
      PDF_RENDER_TIMEOUT_MS,
      `PDF page ${pageNum} took too long to load`
    );

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not render PDF page preview");

    await withTimeout(
      page.render({ canvasContext: ctx, viewport }).promise,
      PDF_RENDER_TIMEOUT_MS,
      `PDF page ${pageNum} took too long to render`
    );

    return canvas.toDataURL("image/png");
  };

  const renderPageForUpload = async (pdf: any, pageNum: number) => {
    const page = await withTimeout(
      pdf.getPage(pageNum),
      PDF_RENDER_TIMEOUT_MS,
      `PDF page ${pageNum} took too long to load`
    );

    const baseViewport = page.getViewport({ scale: 1 });

    const maxScaleByDimension = Math.min(
      MAX_UPLOAD_DIMENSION / baseViewport.width,
      MAX_UPLOAD_DIMENSION / baseViewport.height
    );
    const maxScaleByPixels = Math.sqrt(MAX_UPLOAD_PIXELS / (baseViewport.width * baseViewport.height));
    const safeScale = Math.min(3, maxScaleByDimension, maxScaleByPixels);

    if (!Number.isFinite(safeScale) || safeScale <= 0) {
      throw new Error("PDF page dimensions are invalid for rendering");
    }

    const viewport = page.getViewport({ scale: safeScale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not render PDF page");

    await withTimeout(
      page.render({ canvasContext: ctx, viewport }).promise,
      PDF_RENDER_TIMEOUT_MS,
      `PDF page ${pageNum} took too long to render`
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to encode selected PDF page"));
      }, "image/jpeg", 0.92);
    });

    return { blob, scale: safeScale };
  };

  const loadPdfPreviews = async (file: File) => {
    setLoadingPreviews(true);
    try {
      const pdfjsLib = await getPdfLib();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await withTimeout(
        pdfjsLib.getDocument({ data: arrayBuffer }).promise,
        PDF_PARSE_TIMEOUT_MS,
        "PDF parsing timed out. Try a smaller or less complex PDF."
      );

      const count = pdf.numPages;
      setPdfPageCount(count);
      setSelectedPage(1);

      const maxPreviews = Math.min(count, MAX_PREVIEW_PAGES);
      const previews: string[] = [];
      for (let i = 1; i <= maxPreviews; i++) {
        previews.push(await renderPagePreview(pdf, i, 0.5));
      }
      setPdfPreviews(previews);
    } catch (e: any) {
      toast({ title: "Failed to read PDF", description: e.message, variant: "destructive" });
      setPdfFile(null);
    } finally {
      setLoadingPreviews(false);
    }
  };

  const confirmPageSelection = async (pageOverride?: number) => {
    if (!pdfFile) return;
    const pageToUse = pageOverride ?? selectedPage;

    setUploading(true);
    try {
      const pdfjsLib = await getPdfLib();
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await withTimeout(
        pdfjsLib.getDocument({ data: arrayBuffer }).promise,
        PDF_PARSE_TIMEOUT_MS,
        "PDF parsing timed out. Try a smaller or less complex PDF."
      );
      const { blob } = await renderPageForUpload(pdf, pageToUse);

      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage.from("assets").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      onSourceReady(urlData.publicUrl);
      setPdfFile(null);
      setPdfPreviews([]);
      setPdfPageCount(0);
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
            onClick={() => { setPdfFile(null); setPdfPreviews([]); setPdfPageCount(0); }}
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
            <p className="font-body text-[11px] text-muted-foreground">Click a page to use it as your source drawing.</p>
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
              {pdfPreviews.map((preview, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (uploading) return;
                      setSelectedPage(pageNum);
                      void confirmPageSelection(pageNum);
                    }}
                    disabled={uploading}
                    className={`relative rounded border overflow-hidden transition-all ${
                      selectedPage === pageNum
                        ? "border-foreground ring-1 ring-foreground"
                        : "border-border hover:border-foreground/30"
                    } ${uploading ? "opacity-70 pointer-events-none" : ""}`}
                  >
                    <img src={preview} alt={`Page ${pageNum}`} className="w-full aspect-[3/4] object-contain bg-background" />
                    <span className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur-sm text-center font-body text-[9px] text-foreground py-0.5">
                      {pageNum}
                    </span>
                  </button>
                );
              })}
            </div>
            {uploading && (
              <div className="flex items-center justify-center gap-1.5 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="font-body text-xs text-muted-foreground">Preparing page {selectedPage}…</span>
              </div>
            )}
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
