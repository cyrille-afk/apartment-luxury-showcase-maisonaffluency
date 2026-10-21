import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeLanding } from "@/app/legacyShell";

export const Route = createFileRoute("/trade-program")({
  component: () => (
    <Suspense fallback={null}><TradeLanding /></Suspense>
  ),
});
