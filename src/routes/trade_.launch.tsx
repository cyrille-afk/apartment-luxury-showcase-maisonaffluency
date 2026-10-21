import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeMobileLaunch } from "@/app/legacyShell";

export const Route = createFileRoute("/trade_/launch")({
  component: () => (
    <Suspense fallback={null}><TradeMobileLaunch /></Suspense>
  ),
});
