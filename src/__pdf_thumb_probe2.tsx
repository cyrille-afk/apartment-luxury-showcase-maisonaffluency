import * as R from "react"; import * as D from "react-dom/client";
import { PdfViewerDialog } from "@/components/trade/PdfViewerDialog";
import { sampleComparison } from "@/components/trade/settings/BrandedPdfPreview";
import { buildSnapshotComparisonPdf } from "@/lib/snapshotComparisonPdf";
const PHOTO = (() => { const c = document.createElement("canvas"); c.width = 600; c.height = 400; const x = c.getContext("2d")!; x.fillStyle = "#8a6"; x.fillRect(0, 0, 600, 400); return c.toDataURL("image/jpeg"); })();
export function mount() {
  const ce = (R as any).createElement || (R as any).default.createElement; const cr = (D as any).createRoot || (D as any).default.createRoot;
  const [l, r] = sampleComparison();
  const build = () => buildSnapshotComparisonPdf(l, r, { summary: "Option B turns the chair toward the window.", notes: { p1: "Rotated 45°." }, photos: { __summary: [PHOTO] }, highlightChanges: true } as any,
    { comparedAt: new Date().toISOString(), cover: { apartmentName: "Sample Residence", studioName: "Probe" } as any });
  cr(document.getElementById("fullscreen-test-root")!).render(ce(PdfViewerDialog, { open: true, onOpenChange: () => {}, title: "Probe", fileName: "p.pdf", build }));
}
