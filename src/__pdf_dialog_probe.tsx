import * as R from "react"; import * as D from "react-dom/client";
import { PdfViewerDialog } from "@/components/trade/PdfViewerDialog";
export function mountPdfFullscreenProbe() {
  const ce = (R as any).createElement || (R as any).default.createElement; const cr = (D as any).createRoot || (D as any).default.createRoot;
  cr(document.getElementById("fullscreen-test-root")!).render(ce(PdfViewerDialog, { open: true, onOpenChange: () => {}, title: "Probe", fileName: "p.pdf", build: () => fetch("/__probe.pdf").then(r => r.blob()) }));
}
