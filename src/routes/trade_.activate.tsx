import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeActivate } from "@/app/legacyShell";

export const Route = createFileRoute("/trade_/activate")({
  head: () => ({ meta: [
    { title: 'Set Your Trade Password — Maison Affluency' },
    { name: 'description', content: 'Securely set your password and activate your approved Maison Affluency Trade account.' },
    { property: 'og:title', content: 'Set Your Trade Password — Maison Affluency' },
    { property: 'og:description', content: 'Password setup for your approved Maison Affluency Trade studio.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ] }),
  component: () => (
    <Suspense fallback={null}><TradeActivate /></Suspense>
  ),
});
