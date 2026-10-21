import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PortalCN } from "@/app/legacyShell";

export const Route = createFileRoute("/cn")({
  component: () => (
    <Suspense fallback={null}><PortalCN /></Suspense>
  ),
});
