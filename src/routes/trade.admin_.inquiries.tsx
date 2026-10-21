import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminInquiries } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/inquiries")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminInquiries /></Suspense>
  ),
});
