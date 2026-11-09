import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, SharedProcurementBoard } from "@/app/legacyShell";

export const Route = createFileRoute("/shared_/board_/$token")({
  head: () => ({ meta: [
    { title: "Private Board Invitation | Maison Affluency" },
    { name: "description", content: "Access your private Maison Affluency board invitation to review selected pieces." },
    { property: "og:title", content: "Private Board Invitation | Maison Affluency" },
    { property: "og:description", content: "Access your private Maison Affluency board invitation to review selected pieces." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><SharedProcurementBoard /></Suspense>
  ),
});
