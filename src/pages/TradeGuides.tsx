import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { BookOpen, Users, ChevronRight } from "lucide-react";
import { prefetchGuide } from "./guides/registry";

type Guide = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  audience: string;
  pdfUrl?: string;
  icon: any;
};

const guides: Guide[] = [
  {
    slug: "shared-filters",
    eyebrow: "Studio essentials",
    title: "Working as a studio in the Trade Portal",
    description:
      "How shared project & designer filters flow across Quotes, Boards and Tearsheets — plus keyboard, accessibility, and multi-user workflow patterns.",
    audience: "All studio members",
    pdfUrl: "/guides/studio-shared-filters.pdf",
    icon: Users,
  },
];

export default function TradeGuides() {
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <header>
        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Trade Portal
        </p>
        <h1 className="font-display text-2xl md:text-3xl text-foreground tracking-wide mt-1">
          Guides
        </h1>
        <p className="font-body text-sm text-muted-foreground mt-2 max-w-2xl">
          Concise playbooks for design studios using Maison Affluency. Each guide is
          available to read in-app and as a downloadable PDF you can share with your team.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((g) => {
          const Icon = g.icon;
          return <GuideCard key={g.slug} guide={g} Icon={Icon} />;
        })}
      </div>

      <aside className="rounded-md border border-border bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-body text-sm text-foreground">
              More guides are on the way.
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              Tearsheets, FF&amp;E and Order Timeline playbooks are coming next. If you'd
              like a custom walkthrough for your team, get in touch with your Maison
              Affluency contact.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
