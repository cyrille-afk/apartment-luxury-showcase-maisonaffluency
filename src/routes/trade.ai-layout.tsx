import { createFileRoute, redirect } from "@tanstack/react-router";

// Retired: budget curation lives in the Mood Board; walkthroughs in the Visualiser Sandbox.
// Legacy links that open an existing layout go to the Sandbox walkthrough, everything else to the Mood Board.
export const Route = createFileRoute("/trade/ai-layout")({
  head: () => ({ meta: [
    { title: "Redirecting | Maison Affluency Trade" },
    { name: "description", content: "Room layouts now live in the Mood Board and Visualiser Sandbox." },
    { property: "og:title", content: "Redirecting | Maison Affluency Trade" },
    { property: "og:description", content: "Room layouts now live in the Mood Board and Visualiser Sandbox." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  beforeLoad: ({ location }) => {
    const params = new URLSearchParams(location.searchStr);
    const project = params.get("project");
    const opensLayout = params.has("handoff") || params.get("open") === "saved";
    const q = new URLSearchParams();
    if (opensLayout) q.set("view", "walkthrough");
    if (project) q.set("project", project);
    const qs = q.toString();
    throw redirect({ href: `${opensLayout ? "/trade/visualiser" : "/trade/mood-boards"}${qs ? `?${qs}` : ""}`, replace: true });
  },
});
