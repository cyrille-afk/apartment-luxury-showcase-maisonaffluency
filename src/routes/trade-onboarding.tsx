import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeOnboarding } from "@/app/legacyShell";

export const Route = createFileRoute("/trade-onboarding")({
  component: () => (
    <Suspense fallback={null}><TradeOnboarding /></Suspense>
  ),
});
