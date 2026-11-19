import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton } from "@/app/legacyShell";
import TradeAdminPartnershipInquiries from "@/pages/TradeAdminPartnershipInquiries";

export const Route = createFileRoute("/trade/admin_/partnership-inquiries")({
  head: () => ({ meta: [
    { title: "Partnership Inquiries — Maison Affluency" },
    { name: "description", content: "Private Maison Affluency developer-partnership inquiry inbox." },
    { property: "og:title", content: "Partnership Inquiries — Maison Affluency" },
    { property: "og:description", content: "Private Maison Affluency developer-partnership inquiry inbox." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminPartnershipInquiries /></Suspense>
  ),
});
