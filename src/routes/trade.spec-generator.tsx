import { createFileRoute } from "@tanstack/react-router";
import { TradeSpecSheetGenerator } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/spec-generator")({
  head: () => ({ meta: [
    { title: "Specification Sheet Generator | Maison Affluency Trade" },
    { name: "description", content: "Create branded product specification sheets with complete catalogue records and client prices." },
    { property: "og:title", content: "Specification Sheet Generator | Maison Affluency Trade" },
    { property: "og:description", content: "Create branded product specification sheets with complete catalogue records and client prices." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <TradeSpecSheetGenerator />
  ),
});
