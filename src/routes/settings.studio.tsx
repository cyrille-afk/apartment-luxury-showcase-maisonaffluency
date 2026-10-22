import { createFileRoute } from "@tanstack/react-router";
import { TradeStudioSettings } from "@/app/legacyShell";
export const Route = createFileRoute("/settings/studio")({
  head: () => ({ meta: [
    { title: "Studio Identity Setup | Maison Affluency" },
    { name: "description", content: "Complete your branded Maison Affluency trade studio identity and first project workspace." },
    { property: "og:title", content: "Studio Identity Setup | Maison Affluency" },
    { property: "og:description", content: "Save your client-facing studio branding and unlock your trade workspace." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" },
  ] }), component: () => <TradeStudioSettings />,
});
