import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  generateDesignerBiographyPdf,
  downloadBlob,
  type DesignerBiographyPdfInput,
} from "@/lib/generateDesignerBiographyPdf";
import { trackDownload } from "@/lib/trackDownload";

interface BiographyPdfButtonProps extends DesignerBiographyPdfInput {
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
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const blob = await generateDesignerBiographyPdf(input);
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
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`group inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className ?? ""}`}
      aria-label={`Download ${input.designerName} biography as PDF`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
      )}
      <span className="underline-offset-4 group-hover:underline">
        {loading ? "Preparing…" : "Download biography"}
      </span>
    </button>
  );
}
