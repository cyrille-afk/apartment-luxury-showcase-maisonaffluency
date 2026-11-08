import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminGlbModels } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/glb-models")({
  head: () => ({ meta: [
    { title: "3D Model Library | Maison Affluency Trade" },
    { name: "description", content: "Manage product 3D models and bulk upload size variants in Maison Affluency Trade." },
    { property: "og:title", content: "3D Model Library | Maison Affluency Trade" },
    { property: "og:description", content: "Manage product 3D models and bulk upload size variants in Maison Affluency Trade." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <TradeAdminGlbModels />
  ),
});
