import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ResetPassword } from "@/app/legacyShell";

export const Route = createFileRoute("/reset-password")({
  component: () => (
    <Suspense fallback={null}><ResetPassword /></Suspense>
  ),
});
