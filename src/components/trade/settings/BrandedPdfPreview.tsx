import { useEffect, useState } from "react";
import { Eye, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CoverTheme } from "@/lib/pdfCoverTheme";
import type { ComparisonSide } from "@/lib/snapshotComparisonPdf";
import { logoForPdf } from "@/components/trade/visualiser/SavedComparisons";

/** Illustrative two-snapshot comparison (no prices) used only for previewing branding. */
export function sampleComparison(): [ComparisonSide, ComparisonSide] {
  const piece = (id: string, name: string, brand: string, x: number, z: number, deg: number, finish: string) => ({
    instanceId: id, id, product_name: name, brand_name: brand, image_url: null, dimensions: null,
    width_mm: 900, depth_mm: 800, height_mm: 750, glb_url: null, position: [x, 0, z], rotation: [0, (deg * Math.PI) / 180, 0], scale: 1,
    material: { name: finish },
  });
  const side = (sid: string, name: string, date: string, objects: unknown[]): ComparisonSide => ({
    snapshot: { id: sid, name, created_at: date, piece_count: objects.length, thumbnail: null },
    data: { version: 1, bounds: { width: 6.4, depth: 4.8, height: 2.9 }, floorPlanUrl: null, scene: { objects } } as unknown as ComparisonSide["data"],
  });
  return [
    side("a", "Living room · Option A", "2026-09-02T10:00:00Z", [piece("p1", "Lounge Chair", "Sample Atelier", -1.2, 0.6, 0, "Black Pepper Oak"), piece("p2", "Low Table", "Sample Atelier", 0, 0, 0, "Travertine"), piece("p3", "Sofa", "Sample Maison", 1.4, -1.2, 0, "Ivory Bouclé")]),
    side("b", "Living room · Option B", "2026-09-16T10:00:00Z", [piece("p1", "Lounge Chair", "Sample Atelier", -1.6, 0.9, 45, "Tobacco Oak"), piece("p2", "Low Table", "Sample Atelier", 0, 0, 0, "Travertine"), piece("p3", "Sofa", "Sample Maison", 1.4, -1.2, 0, "Sage Velvet")]),
  ];
}

type Props = { theme: CoverTheme; typeface: string; logoUrl: string; studioName: string };

/** Full multi-page preview of a saved-comparison PDF using the unsaved settings on screen. */
export function BrandedPdfPreview({ theme, typeface, logoUrl, studioName }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "building" | "error">("idle");

  useEffect(() => {
    if (!open) return;
    let off = false; let made: string | null = null;
    setState("building"); setUrl(null);
    (async () => {
      try {
        const pdf = await import("@/lib/snapshotComparisonPdf");
        const [l, r] = sampleComparison();
        const blob = await pdf.buildSnapshotComparisonPdf(l, r, {
          summary: "Option B turns the lounge chair toward the window and introduces a sage velvet sofa.",
          notes: { p1: "Rotated 45° to frame the garden view." }, highlightChanges: true,
        }, {
          comparedAt: new Date().toISOString(),
          cover: { apartmentName: "Sample Residence", clientName: "Sample Client", location: "London", style: "Contemporary", studioName, theme, typeface, logo: await logoForPdf(logoUrl) },
        });
        if (off) return;
        made = URL.createObjectURL(blob); setUrl(made); setState("idle");
      } catch { if (!off) setState("error"); }
    })();
    return () => { off = true; if (made) URL.revokeObjectURL(made); };
  }, [open, theme, typeface, logoUrl, studioName]);

  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><Eye className="mr-2 h-4 w-4" />Preview full PDF</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col">
        <DialogHeader><DialogTitle>Comparison PDF preview</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Sample content with your current cover settings — unsaved changes included. Prices never appear.</p>
        <div className="min-h-0 flex-1 border border-border">
          {state === "building" && <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing preview…</div>}
          {state === "error" && <p role="alert" className="p-6 text-sm text-destructive">The preview couldn't be prepared. Try again.</p>}
          {url && <iframe title="Comparison PDF preview" src={url} className="h-full w-full" />}
        </div>
        {url && <div className="flex justify-end"><Button asChild size="sm"><a href={url} download="comparison-preview.pdf"><Download className="mr-2 h-4 w-4" />Download sample</a></Button></div>}
      </DialogContent>
    </Dialog>
  </>;
}
