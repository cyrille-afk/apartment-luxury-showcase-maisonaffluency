import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CollectorSignup } from "@/app/legacyShell";

export const Route = createFileRoute("/collector-signup")({
  component: () => (
    <Suspense fallback={null}><CollectorSignup /></Suspense>
  ),
});
