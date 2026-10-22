import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeLayout, TradeErrorBoundary } from "@/app/legacyShell";
export const Route = createFileRoute("/settings")({ component: () => <Suspense fallback={null}><TradeErrorBoundary><TradeLayout /></TradeErrorBoundary></Suspense> });
