import { useState } from "react";
import { Eye } from "lucide-react";
import { PdfViewerDialog } from "@/components/trade/PdfViewerDialog";
import { Button } from "@/components/ui/button";
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
  const build = async () => {
    const pdf = await import("@/lib/snapshotComparisonPdf");
    const [l, r] = sampleComparison();
    return pdf.buildSnapshotComparisonPdf(l, r, {
      summary: "Option B turns the lounge chair toward the window and introduces a sage velvet sofa.",
      notes: { p1: "Rotated 45° to frame the garden view." }, highlightChanges: true,
    }, {
      comparedAt: new Date().toISOString(),
      cover: { apartmentName: "Sample Residence", clientName: "Sample Client", location: "London", style: "Contemporary", studioName, theme, typeface, logo: await logoForPdf(logoUrl) },
    });
  };
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><Eye className="mr-2 h-4 w-4" />Preview full PDF</Button>
    <PdfViewerDialog open={open} onOpenChange={setOpen} title="Comparison PDF preview"
      description="Sample content with your current cover settings — unsaved changes included. Prices never appear."
      build={build} buildKey={JSON.stringify([theme, typeface, logoUrl, studioName])} fileName="comparison-preview.pdf" />
  </>;
}
