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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
      className={className}
      aria-label={`Download ${input.designerName} biography as PDF`}
    >
      {loading ? <Loader2 className="animate-spin" /> : <Download />}
      {loading ? "Preparing PDF…" : "Download biography (PDF)"}
    </Button>
  );
}
