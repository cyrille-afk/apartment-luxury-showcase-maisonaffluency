import * as R from "react"; import * as D from "react-dom/client";
import { BrandedPdfPreview } from "@/components/trade/settings/BrandedPdfPreview";
export function mountPdfFullscreenProbe() {
  const ce = (R as any).createElement || (R as any).default.createElement; const cr = (D as any).createRoot || (D as any).default.createRoot;
  cr(document.getElementById("fullscreen-test-root")!).render(ce(BrandedPdfPreview, { theme: {}, typeface: "editorial", logoUrl: null, studioName: "Probe Studio" }));
}
