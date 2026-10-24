import { createFileRoute } from "@tanstack/react-router";
import TradeAdminAccountIdentities from "@/pages/TradeAdminAccountIdentities";

export const Route = createFileRoute("/trade/admin_/account-identities")({
  head: () => ({
    meta: [
      { title: "Duplicate Account Review — Maison Affluency Admin" },
      { name: "description", content: "Admin review of duplicate email-and-password and Google accounts." },
      { property: "og:title", content: "Duplicate Account Review — Maison Affluency Admin" },
      { property: "og:description", content: "Admin review of duplicate email-and-password and Google accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TradeAdminAccountIdentities,
});
