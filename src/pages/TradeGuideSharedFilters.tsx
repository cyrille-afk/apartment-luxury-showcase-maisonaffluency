import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, Download, Keyboard, Users, Link2, ShieldCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const SLUG = "multi-user-studio-shared-filters";
const PDF_URL = "/guides/studio-shared-filters.pdf";

export default function TradeGuideSharedFilters() {
  const { slug } = useParams();
  if (slug && slug !== SLUG) return <Navigate to="/trade/guides" replace />;

  return (
    <article className="max-w-3xl mx-auto space-y-10">
      <header className="space-y-4">
        <Link
          to="/trade/guides"
          onClick={() =>
            trackEvent("trade_guide_back_to_list", {
              event_category: "Trade Guides",
              event_label: SLUG,
              guide_slug: SLUG,
            })
          }
          className="inline-flex items-center gap-1 font-body text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> All guides
        </Link>
        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-primary">
          Studio essentials · v1.0
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground tracking-wide leading-tight">
          Working as a studio in the Trade Portal
        </h1>
        <p className="font-body text-base text-muted-foreground">
          Shared project &amp; designer filters, focus-aware navigation, and best
          practices for multi-user design studios.
        </p>
        <a
          href={PDF_URL}
          download
          className="inline-flex items-center gap-2 rounded-md border border-border bg-foreground px-4 py-2 font-body text-xs uppercase tracking-wider text-background hover:bg-foreground/90 transition-colors"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download PDF
        </a>
      </header>

      <Section
        eyebrow="01"
        title="How filters flow across the portal"
        icon={Link2}
      >
        <p>
          The Trade Portal uses two cross-page filters that bind your work to a single
          design context: a <strong>Project</strong> and a <strong>Designer</strong>.
          They are read from the URL on every page
          (<code className="text-xs">?project=…&amp;designer=…</code>) so any view you
          open — Quotes, Project Folders, Tearsheets, the Project Hub — shows only what
          is relevant to that context.
        </p>
        <DefList
          items={[
            ["Project filter", "Persisted in your browser session. Survives navigation between Quotes, Boards and Tearsheets so you don't have to re-pick it on every page. Cleared on sign-out or when you explicitly remove it."],
            ["Designer filter", "URL-only, per-page. Scopes the current list to a single designer or atelier; does not persist across tabs."],
            ["Active Filter Chips", "A shared header strip on the Project Hub, Quotes and Boards. Each chip is removable; \"Clear all\" wipes both at once with confirmation."],
          ]}
        />
        <Callout title="Why this matters for studios">
          Every team member who opens a deep link inherits the same filter context. Send
          a colleague <code className="text-xs">/trade/quotes?project=PROJ_ID&amp;designer=Studio+Name</code>
          {" "}and they land on the exact slice you were looking at — no walkthrough required.
        </Callout>
      </Section>

      <Section
        eyebrow="02"
        title="Keyboard & accessibility behaviour"
        icon={Keyboard}
      >
        <p>
          The filter chips are designed to be fully operable without a mouse — important
          for senior specifiers reviewing long boards, and for assistive-tech users.
        </p>
        <DefList
          items={[
            ["Tab", "Moves focus into the filter chip group."],
            ["← / →", "Moves focus between chip clear buttons and the \"Clear all\" action. Wraps at the ends."],
            ["Home / End", "Jumps to the first / last clear control."],
            ["Enter / Space", "Activates the focused control. \"Clear all\" prompts for confirmation."],
            ["Focus restoration", "After clearing one chip, focus moves to the remaining chip. After \"Clear all\" or the last remaining chip, focus returns to the filter region itself."],
            ["Live region", "Each clear is announced politely (e.g. \"Project Maison Riviera filter cleared\") without stealing focus."],
          ]}
        />
      </Section>

      <Section
        eyebrow="03"
        title="Working as a multi-user studio"
        icon={Users}
      >
        <Subsection title="A. One project, many seats">
          Create the project once from <strong>Projects → New project</strong>. The project
          ID becomes the anchor for every quote, board and tearsheet. Share the project URL
          with your team; the project filter will auto-restore on each colleague's session.
        </Subsection>
        <Subsection title="B. Hand-offs via deep links">
          Instead of pasting screenshots, copy the URL of the page you're on. The shared
          filter encoding means the recipient lands on the same Quotes view, Board, or
          Tearsheet — pre-filtered by project and (optionally) designer.
        </Subsection>
        <Subsection title="C. Designer scoping for procurement">
          When working through approvals brand-by-brand, layer the designer filter on top
          of the project filter. Clear just the designer chip when you move on to the next
          atelier; the project context stays intact.
        </Subsection>
        <Subsection title="D. Confirm before clearing both">
          "Clear all" requires confirmation in the multi-filter pages. This protects you
          from accidentally losing a curated project context mid-review — common on shared
          screens or during client calls.
        </Subsection>
        <Callout title="Studio housekeeping tip">
          If a senior reviewer needs a clean slate, bookmark the unfiltered page (e.g.{" "}
          <code className="text-xs">/trade/quotes</code>) separately from the filtered
          deep link. Both can coexist in your team's shared bookmarks bar.
        </Callout>
      </Section>

      <Section
        eyebrow="04"
        title="URL cheat sheet"
        icon={ShieldCheck}
      >
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-left">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-body text-xs uppercase tracking-wider text-muted-foreground">Pattern</th>
                <th className="px-3 py-2 font-body text-xs uppercase tracking-wider text-muted-foreground">Lands you on…</th>
              </tr>
            </thead>
            <tbody className="font-body text-sm">
              {[
                ["/trade/projects/<id>", "Project Hub for that project, with chips active."],
                ["/trade/quotes?project=<id>", "Quote list scoped to the project."],
                ["/trade/quotes?project=<id>&designer=<name>", "Quotes for one designer inside one project."],
                ["/trade/boards?project=<id>", "Project folders for that project."],
                ["/trade/tearsheets?project=<id>", "Tearsheet builder pre-loaded with the project's picks."],
              ].map(([pattern, dest]) => (
                <tr key={pattern} className="border-t border-border">
                  <td className="px-3 py-2 align-top"><code className="text-xs text-foreground">{pattern}</code></td>
                  <td className="px-3 py-2 align-top text-muted-foreground">{dest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <p className="font-body text-xs italic text-muted-foreground border-t border-border pt-6">
        Need help rolling this out across your team? Reach out to your Maison Affluency
        contact — we're happy to run a short walkthrough.
      </p>
    </article>
  );
}

function Section({ eyebrow, title, icon: Icon, children }: { eyebrow: string; title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="font-body text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</span>
      </div>
      <h2 className="font-display text-2xl text-foreground tracking-wide">{title}</h2>
      <div className="space-y-4 font-body text-sm text-foreground/90 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-body text-xs uppercase tracking-wider text-primary mb-1">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function DefList({ items }: { items: [string, string][] }) {
  return (
    <dl className="divide-y divide-border rounded-md border border-border overflow-hidden">
      {items.map(([term, def]) => (
        <div key={term} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-1 md:gap-4 px-3 py-3 bg-card">
          <dt className="font-body text-sm font-medium text-foreground">{term}</dt>
          <dd className="font-body text-sm text-muted-foreground">{def}</dd>
        </div>
      ))}
    </dl>
  );
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 border-l-2 border-l-primary px-4 py-3">
      <p className="font-body text-xs uppercase tracking-wider text-primary mb-1">{title}</p>
      <p className="font-body text-sm text-foreground/90">{children}</p>
    </div>
  );
}
