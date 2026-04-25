import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  generateDesignerBiographyPdf,
  downloadBlob,
  type DesignerBiographyPdfInput,
  type PdfProgress,
} from "@/lib/generateDesignerBiographyPdf";
import { trackDownload } from "@/lib/trackDownload";
import { useAuthGate } from "@/hooks/useAuthGate";
import { useAuth } from "@/hooks/useAuth";
import AuthGateDialog from "@/components/AuthGateDialog";

interface BiographyPdfButtonProps extends Omit<DesignerBiographyPdfInput, "onProgress"> {
  className?: string;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function BiographyPdfButton({ className, ...input }: BiographyPdfButtonProps) {
  const { toast } = useToast();
  const { requireAuth, gateOpen, gateAction, closeGate } = useAuthGate();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<PdfProgress | null>(null);

  const runDownload = async () => {
    if (loading) return;
    setLoading(true);
    setProgress({ stage: "parsing", ratio: 0, label: "Preparing…" });
    try {
      const blob = await generateDesignerBiographyPdf({
        ...input,
        onProgress: (p) => setProgress(p),
      });
      downloadBlob(blob, `${slugify(input.designerName)}-biography.pdf`);
      trackDownload(undefined, `Biography PDF — ${input.designerName}`);
    } catch (err) {
      console.error("[BiographyPdfButton] failed:", err);
      toast({
        title: "Download failed",
        description: "We couldn't generate the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Brief delay so user sees "Ready" before reset
      setTimeout(() => {
        setLoading(false);
        setProgress(null);
      }, 600);
    }
  };

  const handleClick = () => {
    requireAuth(() => {
      void runDownload();
    }, `download ${input.designerName}'s biography`);
  };

  const pct = progress ? Math.round(Math.min(1, Math.max(0, progress.ratio)) * 100) : 0;

  return (
    <>
      <div className={`inline-flex flex-col items-end gap-1.5 ${className ?? ""}`}>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="group inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-70 disabled:cursor-wait"
          aria-label={`Download ${input.designerName} biography as PDF`}
          aria-busy={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" aria-hidden="true" />
          )}
          <span className="underline-offset-4 group-hover:underline">
            {loading ? (progress?.label ?? "Preparing…") : "Download biography"}
          </span>
          {loading && (
            <span className="text-xs tabular-nums text-muted-foreground ml-1">
              {pct}%
            </span>
          )}
        </button>

        {loading && (
          <div
            className="w-44 h-[2px] bg-foreground/10 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Generating biography PDF"
          >
            <div
              className="h-full bg-foreground/70 transition-[width] duration-200 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <AuthGateDialog open={gateOpen} onClose={closeGate} action={gateAction} />
    </>
  );
}
