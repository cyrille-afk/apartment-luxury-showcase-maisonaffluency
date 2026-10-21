import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { Unsubscribe } from "@/app/legacyShell";

export const Route = createFileRoute("/unsubscribe")({
  component: () => (
    <Suspense fallback={null}><Unsubscribe /></Suspense>
  ),
});
