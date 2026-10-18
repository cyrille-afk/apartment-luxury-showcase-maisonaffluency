// Temporary browser probe: mounts PdfViewerDialog with a generated sample PDF.
// Delete after verification.
import { createRoot } from "react-dom/client";
import { jsPDF } from "jspdf";
import { PdfViewerDialog } from "@/components/trade/PdfViewerDialog";

export function mountPdfFullscreenProbe() {
  const doc = new jsPDF();
  doc.text("Page one", 20, 30);
  doc.addPage();
  doc.text("Page two", 20, 30);
  const blob = doc.output("blob");
  const el = document.getElementById("fullscreen-test-root");
  if (!el) throw new Error("missing #fullscreen-test-root");
  createRoot(el).render(
    <PdfViewerDialog
      open
      onOpenChange={() => {}}
      title="Fullscreen probe"
      build={() => Promise.resolve(blob)}
      fileName="probe.pdf"
    />
  );
}
