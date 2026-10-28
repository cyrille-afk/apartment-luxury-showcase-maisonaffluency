import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ResetPassword } from "@/app/legacyShell";
import { buildPageHead } from "@/lib/pageHead";

export const Route = createFileRoute("/reset-password")({
  head: () => {
    const head = buildPageHead({ title: "Reset Your Password — Maison Affluency", description: "Reset your Maison Affluency account password securely and return to your saved collections and Trade workspace.", path: "/reset-password" });
    return { meta: [...head.meta, { name: "robots", content: "noindex, nofollow" }] };
  },
  component: () => (
    <Suspense fallback={null}><ResetPassword /></Suspense>
  ),
});
