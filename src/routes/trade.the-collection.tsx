import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { GallerySkeleton, TradeShowroom } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/the-collection")({
  component: () => (
    <Suspense fallback={<div className="px-6 py-10"><GallerySkeleton withHeader /></div>}><TradeShowroom /></Suspense>
  ),
});
