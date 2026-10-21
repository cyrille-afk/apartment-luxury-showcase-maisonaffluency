import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminSuppliers } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/suppliers")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminSuppliers /></Suspense>
  ),
});
