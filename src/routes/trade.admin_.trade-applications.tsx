import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminApplications } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/trade-applications")({
  head: () => ({ meta: [
    { title: 'Trade Applications — Maison Affluency Admin' },
    { name: 'description', content: 'Review studio applications and resend password setup for approved Maison Affluency Trade accounts.' },
    { property: 'og:title', content: 'Trade Applications — Maison Affluency Admin' },
    { property: 'og:description', content: 'Private studio application review and approved account activation.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminApplications /></Suspense>
  ),
});
