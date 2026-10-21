import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeActivate } from "@/app/legacyShell";

export const Route = createFileRoute("/trade_/activate")({
  component: () => (
    <Suspense fallback={null}><TradeActivate /></Suspense>
  ),
});
