import { Link } from "react-router-dom";
import { BookOpen, Users, ChevronRight } from "lucide-react";

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
          return (
            <Link
              key={g.slug}
              to={`/trade/guides/${g.slug}`}
              className="group flex flex-col gap-3 rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                  {g.eyebrow}
                </span>
              </div>
              <h2 className="font-display text-lg text-foreground leading-snug">
                {g.title}
              </h2>
              <p className="font-body text-sm text-muted-foreground">{g.description}</p>
              <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
                <span className="font-body text-xs text-muted-foreground">
                  {g.audience}
                </span>
                <span className="inline-flex items-center gap-1 font-body text-xs text-foreground group-hover:text-primary">
                  Read guide <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
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
