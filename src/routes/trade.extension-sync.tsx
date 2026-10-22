import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeExtensionSync } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/extension-sync")({
  head: () => ({ meta: [
    { title: "ChatGPT Extension Integration | Maison Affluency" },
    { name: "description", content: "Connect your studio project workflow with the ChatGPT extension." },
    { property: "og:title", content: "ChatGPT Extension Integration | Maison Affluency" },
    { property: "og:description", content: "Connect your studio project workflow with the ChatGPT extension." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeExtensionSync /></Suspense>
  ),
});
