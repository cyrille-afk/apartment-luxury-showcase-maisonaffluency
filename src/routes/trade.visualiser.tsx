import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeProjectWorkspace } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/visualiser")({
  head: () => ({ meta: [
    { title: "Visualiser Workspace | Maison Affluency Trade" },
    { name: "description", content: "Plan and visualise project interiors across 2D layouts, axonometric views and eye-level scenes." },
    { property: "og:title", content: "Visualiser Workspace | Maison Affluency Trade" },
    { property: "og:description", content: "Plan and visualise project interiors across 2D layouts, axonometric views and eye-level scenes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeProjectWorkspace /></Suspense>
  ),
});
