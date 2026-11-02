import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminInquiries } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/inquiries")({
  head: () => ({ meta: [
    { title: "Inquiry Inbox — Maison Affluency" },
    { name: "description", content: "Private Maison Affluency inquiry review and customer correspondence." },
    { property: "og:title", content: "Inquiry Inbox — Maison Affluency" },
    { property: "og:description", content: "Private Maison Affluency inquiry review and customer correspondence." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminInquiries /></Suspense>
  ),
});
