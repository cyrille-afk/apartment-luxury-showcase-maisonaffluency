import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminWhatsAppAlerts } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/whatsapp-alerts")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminWhatsAppAlerts /></Suspense>
  ),
});
