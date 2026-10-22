import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, SuccessPage } from "@/app/legacyShell";

export const Route = createFileRoute("/success")({
  head: () => ({ meta: [
    { title: "Order Confirmation — Maison Affluency" },
    { name: "description", content: "Secure order confirmation for Maison Affluency purchases." },
    { property: "og:title", content: "Order Confirmation — Maison Affluency" },
    { property: "og:description", content: "Secure order confirmation for Maison Affluency purchases." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><SuccessPage /></Suspense>
  ),
});
