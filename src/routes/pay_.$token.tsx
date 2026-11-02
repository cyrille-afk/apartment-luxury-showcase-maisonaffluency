import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { GuestPayPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/pay_/$token")({
  head: () => ({
    meta: [
      { title: "Secure Guest Payment — Maison Affluency" },
      { name: "description", content: "Review and securely pay the agreed amount for your Maison Affluency quote." },
      { property: "og:title", content: "Secure Guest Payment — Maison Affluency" },
      { property: "og:description", content: "Review and securely pay the agreed amount for your Maison Affluency quote." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><GuestPayPage /></Suspense>
  ),
});
