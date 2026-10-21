import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { BankWireInstructionsPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/bank-wire-instructions")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><BankWireInstructionsPage /></Suspense>
  ),
});
