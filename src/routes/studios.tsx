import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, Studios } from "@/app/legacyShell";
import { buildPageHead } from "@/lib/pageHead";

export const Route = createFileRoute("/studios")({
  head: () => buildPageHead({ title: "Interior Design Studios | Maison Affluency", description: "A curated directory of architecture and interior design studios partnering with Maison Affluency on residential, hospitality and bespoke commissions.", path: "/studios" }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><Studios /></Suspense>
  ),
});
