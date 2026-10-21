import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeLogin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade_/login")({
  component: () => (
    <Suspense fallback={null}><TradeLogin /></Suspense>
  ),
});
