import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TermsOfService } from "@/app/legacyShell";

export const Route = createFileRoute("/terms")({
  component: () => (
    <Suspense fallback={null}><TermsOfService /></Suspense>
  ),
});
