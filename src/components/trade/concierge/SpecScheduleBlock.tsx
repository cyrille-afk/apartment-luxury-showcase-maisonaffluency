import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Download, Check, Eye, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  zone: string;
  markdown: string;
}

/**
 * Renders a client-generated markdown SPECIFICATION SCHEDULE with Copy,
 * Download-as-.md, and a Preview-then-Download PDF flow. Rendered inline as
 * an assistant message. The markdown is built deterministically from
 * database rows — never model output — so there is no hallucination risk.
 */
export function SpecScheduleBlock({ zone, markdown }: Props) {
  const STORAGE_KEY = "maison:spec-schedule:cover-prefs:v1";
  type CoverPrefs = {
    projectName?: string;
    designerName?: string;
    coverDate?: string;
    includeCover?: boolean;
    pageSize?: "a4" | "letter";
    designerLogo?: string; // data URL
  };
  const MAX_LOGO_BYTES = 500 * 1024;
  const loadPrefs = (): CoverPrefs => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      return raw ? (JSON.parse(raw) as CoverPrefs) : {};
    } catch {
      return {};
    }
  };
  const initialPrefs = loadPrefs();

  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [projectName, setProjectName] = useState(
    initialPrefs.projectName ?? (zone && zone !== "Tearsheet" ? zone : ""),
  );
  const [designerName, setDesignerName] = useState(initialPrefs.designerName ?? "");
  const [coverDate, setCoverDate] = useState(
    initialPrefs.coverDate ?? new Date().toISOString().slice(0, 10),
  );
  const [includeCover, setIncludeCover] = useState(initialPrefs.includeCover ?? true);
  const [pageSize, setPageSize] = useState<"a4" | "letter">(initialPrefs.pageSize ?? "a4");
  const [designerLogo, setDesignerLogo] = useState<string | null>(initialPrefs.designerLogo ?? null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const docRef = useRef<any>(null);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          projectName,
          designerName,
          coverDate,
          includeCover,
          pageSize,
          designerLogo: designerLogo ?? undefined,
        }),
      );
    } catch {
      /* storage denied or quota exceeded — noop */
    }
  }, [projectName, designerName, coverDate, includeCover, pageSize, designerLogo]);

  const resetCoverPrefs = () => {
    skipNextSave.current = true;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage denied — noop */
    }
    setProjectName(zone && zone !== "Tearsheet" ? zone : "");
    setDesignerName("");
    setCoverDate(new Date().toISOString().slice(0, 10));
    setIncludeCover(true);
    setPageSize("a4");
    setDesignerLogo(null);
    setLogoError(null);
  };

  const onLogoFile = (file: File | null) => {
    setLogoError(null);
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
      setLogoError("Use PNG, JPG, WEBP or SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo must be under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (result) setDesignerLogo(result);
    };
    reader.onerror = () => setLogoError("Could not read file.");
    reader.readAsDataURL(file);
  };





  const slug = useMemo(() => {
    return (
      zone
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "spec-schedule"
    );
  }, [zone]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied — noop */
    }
  };

  const onDownloadMd = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formatCoverDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const buildPdfDoc = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: pageSize });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 48;
    const marginY = 56;
    const maxWidth = pageWidth - marginX * 2;

    // Cover page (optional, configurable)
    if (includeCover) {
      const centerX = pageWidth / 2;
      let cy = pageHeight / 2 - 80;

      // Optional designer logo above the label
      if (designerLogo) {
        try {
          const props = doc.getImageProperties(designerLogo);
          const maxLogoW = 160;
          const maxLogoH = 80;
          const ratio = props.width / props.height;
          let lw = maxLogoW;
          let lh = lw / ratio;
          if (lh > maxLogoH) {
            lh = maxLogoH;
            lw = lh * ratio;
          }
          const fmt = /^data:image\/(png|jpe?g|webp|svg\+xml)/i.exec(designerLogo)?.[1]?.toUpperCase();
          const jsFmt = fmt === "JPG" ? "JPEG" : fmt === "SVG+XML" ? "PNG" : fmt || "PNG";
          doc.addImage(designerLogo, jsFmt as any, centerX - lw / 2, cy - lh - 24, lw, lh);
        } catch {
          /* unreadable image — skip */
        }
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text("SPECIFICATION SCHEDULE", centerX, cy, { align: "center" });
      cy += 40;

      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      const projectLines = doc.splitTextToSize(
        projectName?.trim() || zone || "Untitled Project",
        maxWidth,
      );
      for (const l of projectLines) {
        doc.text(l, centerX, cy, { align: "center" });
        cy += 26;
      }

      cy += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(80);
      if (designerName.trim()) {
        doc.text(designerName.trim(), centerX, cy, { align: "center" });
        cy += 18;
      }
      if (coverDate) {
        doc.text(formatCoverDate(coverDate), centerX, cy, { align: "center" });
        cy += 18;
      }

      // Footer rule
      doc.setDrawColor(200);
      doc.line(marginX, pageHeight - marginY, pageWidth - marginX, pageHeight - marginY);
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(zone, marginX, pageHeight - marginY + 14);

      doc.addPage();
      doc.setTextColor(0);
    }

    let y = marginY;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Specification Schedule", marginX, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(zone, marginX, y);
    doc.setTextColor(0);
    y += 18;


    const lines: { text: string; heading?: boolean }[] = [];
    for (const raw of markdown.split("\n")) {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) {
        lines.push({ text: "" });
        continue;
      }
      const h = line.match(/^#{1,6}\s+(.*)$/);
      if (h) {
        lines.push({ text: h[1], heading: true });
        continue;
      }
      if (/^---+$/.test(line.trim())) {
        lines.push({ text: "────────────────────────" });
        continue;
      }
      const b = line.match(/^\s*[-*]\s+(.*)$/);
      const body = (b ? `• ${b[1]}` : line)
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1");
      lines.push({ text: body });
    }

    const lineHeight = 13;
    for (const item of lines) {
      if (item.heading) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      }
      const wrapped = item.text ? doc.splitTextToSize(item.text, maxWidth) : [""];
      for (const w of wrapped) {
        if (y > pageHeight - marginY) {
          doc.addPage();
          y = marginY;
        }
        doc.text(w, marginX, y);
        y += lineHeight;
      }
    }

    return doc;
  };

  const onOpenPreview = async () => {
    setBuilding(true);
    try {
      const doc = await buildPdfDoc();
      docRef.current = doc;
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPreviewOpen(true);
    } finally {
      setBuilding(false);
    }
  };

  const onDownloadPdfFromPreview = () => {
    if (docRef.current) {
      docRef.current.save(`${slug}.pdf`);
    }
  };

  const onPrintPdf = () => {
    if (!previewUrl) return;
    const w = window.open(previewUrl, "_blank");
    if (w) {
      w.addEventListener("load", () => {
        try {
          w.focus();
          w.print();
        } catch {
          /* noop */
        }
      });
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/60 p-4 space-y-3 max-w-[92%]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground">
          Specification schedule · local export
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-2.5 py-1 text-[11px] font-body text-foreground transition",
            )}
            aria-label="Copy schedule"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onDownloadMd}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-2.5 py-1 text-[11px] font-body text-foreground transition"
            aria-label="Download schedule as markdown"
          >
            <Download className="h-3 w-3" />
            .md
          </button>
          <button
            type="button"
            onClick={() => setCoverOpen(true)}
            disabled={building}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-2.5 py-1 text-[11px] font-body text-foreground transition disabled:opacity-60"
            aria-label="Preview PDF before download"
          >
            <Eye className="h-3 w-3" />
            {building ? "Building…" : "Preview PDF"}
          </button>

        </div>
      </div>

      <div className="concierge-md space-y-2.5 text-sm leading-relaxed text-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => <p className="my-0" {...props} />,
            ul: ({ node, ...props }) => (
              <ul className="list-disc pl-5 space-y-1 my-1" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="leading-relaxed [&>p]:my-0" {...props} />
            ),
            strong: ({ node, ...props }) => (
              <strong className="font-semibold text-foreground" {...props} />
            ),
            em: ({ node, ...props }) => <em className="italic" {...props} />,
            a: ({ node, ...props }) => (
              <a
                className="underline hover:text-accent"
                target="_blank"
                rel="noreferrer"
                {...props}
              />
            ),
            h1: ({ node, ...props }) => (
              <h3 className="font-display text-sm mt-1 mb-1 uppercase tracking-wide" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h3 className="font-display text-sm mt-1 mb-1 uppercase tracking-wide" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="font-display text-sm mt-1 mb-1 uppercase tracking-wide" {...props} />
            ),
            hr: () => <hr className="my-2 border-border/60" />,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>

      <Dialog open={coverOpen} onOpenChange={setCoverOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-border/60 space-y-0">
            <DialogTitle className="font-display text-sm uppercase tracking-[0.14em]">
              Cover page
            </DialogTitle>
          </DialogHeader>
          <form
            className="p-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setCoverOpen(false);
              onOpenPreview();
            }}
          >
            <label className="flex items-center gap-2 text-[12px] font-body text-foreground">
              <input
                type="checkbox"
                checked={includeCover}
                onChange={(e) => setIncludeCover(e.target.checked)}
                className="h-3.5 w-3.5 accent-current"
              />
              Include cover page
            </label>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-[0.14em] font-body text-muted-foreground">
                Project name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={!includeCover}
                placeholder={zone || "Untitled Project"}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] font-body text-foreground focus:outline-none focus:border-accent/60 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-[0.14em] font-body text-muted-foreground">
                Designer / studio
              </label>
              <input
                type="text"
                value={designerName}
                onChange={(e) => setDesignerName(e.target.value)}
                disabled={!includeCover}
                placeholder="e.g. Maison Affluency"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] font-body text-foreground focus:outline-none focus:border-accent/60 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-[0.14em] font-body text-muted-foreground">
                Designer logo (optional)
              </label>
              <div className="flex items-center gap-2">
                {designerLogo ? (
                  <img
                    src={designerLogo}
                    alt="Designer logo preview"
                    className="h-10 w-auto max-w-[96px] rounded border border-border bg-background object-contain p-1"
                  />
                ) : (
                  <div className="h-10 w-10 rounded border border-dashed border-border/70 bg-background" aria-hidden />
                )}
                <label
                  className={cn(
                    "inline-flex items-center rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-3 py-1 text-[11px] font-body text-foreground transition cursor-pointer",
                    !includeCover && "opacity-50 pointer-events-none",
                  )}
                >
                  {designerLogo ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      onLogoFile(f);
                      e.target.value = "";
                    }}
                    disabled={!includeCover}
                  />
                </label>
                {designerLogo && (
                  <button
                    type="button"
                    onClick={() => {
                      setDesignerLogo(null);
                      setLogoError(null);
                    }}
                    disabled={!includeCover}
                    className="inline-flex items-center rounded-full border border-border bg-background hover:bg-destructive/10 hover:border-destructive/40 px-3 py-1 text-[11px] font-body text-muted-foreground hover:text-destructive transition disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              {logoError ? (
                <p className="text-[11px] font-body text-destructive">{logoError}</p>
              ) : (
                <p className="text-[10px] font-body text-muted-foreground">
                  PNG, JPG, WEBP or SVG · max 500 KB · shown centered above the cover title.
                </p>
              )}
            </div>



            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-[0.14em] font-body text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                value={coverDate}
                onChange={(e) => setCoverDate(e.target.value)}
                disabled={!includeCover}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] font-body text-foreground focus:outline-none focus:border-accent/60 disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-[0.14em] font-body text-muted-foreground">
                Page size
              </label>
              <div className="flex items-center gap-1.5">
                {(["a4", "letter"] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPageSize(size)}
                    aria-pressed={pageSize === size}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-body transition",
                      pageSize === size
                        ? "border-accent/60 bg-accent/15 text-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent/10 hover:border-accent/40",
                    )}
                  >
                    {size === "a4" ? "A4 (210 × 297 mm)" : "Letter (8.5 × 11 in)"}
                  </button>
                ))}
              </div>
            </div>


            <div className="flex items-center justify-between gap-1.5 pt-1">
              <button
                type="button"
                onClick={resetCoverPrefs}
                className="inline-flex items-center rounded-full border border-border bg-background hover:bg-destructive/10 hover:border-destructive/40 px-3 py-1.5 text-[11px] font-body text-muted-foreground hover:text-destructive transition"
              >
                Reset
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCoverOpen(false)}
                  className="inline-flex items-center rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-3 py-1.5 text-[11px] font-body text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={building}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent/10 hover:bg-accent/20 px-3 py-1.5 text-[11px] font-body text-foreground transition disabled:opacity-60"
                >
                  <Eye className="h-3 w-3" />
                  Build preview
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>



      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl w-[92vw] h-[88vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-border/60 flex-row items-center justify-between space-y-0">
            <DialogTitle className="font-display text-sm uppercase tracking-[0.14em]">
              PDF preview · {zone} · {pageSize === "a4" ? "A4" : "Letter"}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onPrintPdf}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-2.5 py-1 text-[11px] font-body text-foreground transition"
              >
                <Printer className="h-3 w-3" />
                Print
              </button>
              <button
                type="button"
                onClick={onDownloadPdfFromPreview}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent/10 hover:bg-accent/20 px-2.5 py-1 text-[11px] font-body text-foreground transition"
              >
                <Download className="h-3 w-3" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 h-6 w-6 text-foreground transition"
                aria-label="Close preview"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </DialogHeader>
          <div className="w-full h-full bg-muted/30">
            {previewUrl ? (
              <iframe
                title="Specification schedule preview"
                src={previewUrl}
                className="w-full h-full border-0"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Building preview…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
