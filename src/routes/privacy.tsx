import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PrivacyPolicy } from "@/app/legacyShell";

export const Route = createFileRoute("/privacy")({
  component: () => (
    <Suspense fallback={null}><PrivacyPolicy /></Suspense>
  ),
});
