import { Link, useParams, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Layers,
  ListChecks,
  Tags,
  Workflow,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const PDF_URL = "/guides/studio-ffe-schedule.pdf";
const SLUG = "ffe-schedule";

export default function TradeGuideFFE() {
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
          Specification essentials · v1.0
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground tracking-wide leading-tight">
          Building an FF&amp;E Schedule
        </h1>
        <p className="font-body text-base text-muted-foreground">
          How project picks, quotes and tearsheets aggregate into a single
          procurement-ready Furniture, Fixtures &amp; Equipment schedule — and how to
          export, share and revise it across your studio.
        </p>
        <a
          href={PDF_URL}
          download
          onClick={() =>
            trackEvent("trade_guide_pdf_download", {
              event_category: "Trade Guides",
              event_label: SLUG,
              guide_slug: SLUG,
            })
          }
          className="inline-flex items-center gap-2 rounded-md border border-border bg-foreground px-4 py-2 font-body text-xs uppercase tracking-wider text-background hover:bg-foreground/90 transition-colors"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download PDF
        </a>
      </header>

      <Section eyebrow="01" title="What an FF&E Schedule is" icon={FileSpreadsheet}>
        <p>
          The FF&amp;E Schedule (<Link to="/trade/ffe-schedule" className="underline underline-offset-2 hover:text-primary">/trade/ffe-schedule</Link>)
          is your project's single procurement source of truth. It auto-aggregates every
          item that has been added to a quote, a project folder, or a tearsheet under the
          active project — grouped by room and brand, costed at trade prices.
        </p>
        <DefList
          items={[
            ["Source of truth", "Pulls live from quote line items and project folder items. Edit upstream and the schedule reflects it on next load."],
            ["Grouping", "Items are grouped by Room → Brand → Product. Empty rooms are hidden automatically."],
            ["Pricing", "Trade unit price × quantity, rolled up per room and project total. Currency follows the project setting."],
            ["Status", "Each line carries an order status (Spec'd, Quoted, Approved, Ordered, Delivered) inherited from the related quote/order timeline."],
          ]}
        />
        <Callout title="Why this matters">
          A single, always-current schedule replaces ad-hoc spreadsheets. Procurement,
          designers, and accounts work from the same numbers without copy-paste drift.
        </Callout>
      </Section>

      <Section eyebrow="02" title="How items get onto the schedule" icon={Workflow}>
        <Subsection title="A. From a Quote">
          Any item added to a draft or submitted quote attached to the active project
          appears in the schedule under its assigned room. Change the quantity in the
          quote and the schedule total updates.
        </Subsection>
        <Subsection title="B. From a Project Folder">
          Items in a project folder (Boards) are listed even before they are quoted, so
          you can plan procurement scope. Once the same item is added to a quote, the
          schedule line is consolidated rather than duplicated.
        </Subsection>
        <Subsection title="C. From a Tearsheet">
          Tearsheet picks are surfaced as candidates. Promote them to a quote in one
          click to convert them into priced schedule lines.
        </Subsection>
        <Callout title="Avoiding double-counting">
          The same product appearing in multiple sources for the same project is shown
          once. Quantity defaults to the maximum across sources; override per-room as
          needed before issuing the schedule.
        </Callout>
      </Section>

      <Section eyebrow="03" title="Rooms, codes and tags" icon={Tags}>
        <p>
          Specifiers think in <strong>rooms</strong>; procurement thinks in{" "}
          <strong>codes</strong>. The schedule supports both.
        </p>
        <DefList
          items={[
            ["Room", "Free-text label set on the quote/board item (e.g. \"Master Bedroom\", \"Lobby\")."],
            ["Item code", "Auto-generated as ROOM-INDEX (e.g. MBR-01, LBY-04). Stable per project; deletions don't renumber existing items."],
            ["Tags", "Optional attributes — finish, COM, lead-bin — used for filtering and reporting."],
            ["Notes", "Per-line specifier notes carry through to the PDF/CSV export."],
          ]}
        />
      </Section>

      <Section eyebrow="04" title="Reviewing & exporting" icon={ListChecks}>
        <Subsection title="A. Review checklist">
          Before sending to a client or supplier, walk the four columns:
          <span className="block mt-2"><em>Quantities</em> · <em>Lead times</em> · <em>Trade price</em> · <em>Status</em>.</span>
          Anything missing is highlighted in muted red — fix upstream in the quote or
          board item.
        </Subsection>
        <Subsection title="B. PDF export">
          The PDF mirrors the on-screen grouping with a cover sheet (project, designer,
          revision date) and per-room subtotals. Use this for client sign-off.
        </Subsection>
        <Subsection title="C. CSV export">
          For procurement systems / accounts, the CSV preserves codes, tags, supplier
          contact, and unit/extended trade price.
        </Subsection>
        <Subsection title="D. Revisions">
          Each export stamps a revision letter (Rev A, Rev B…) into the filename. Keep
          the previous PDF on file when re-issuing — the schedule itself is always live.
        </Subsection>
      </Section>

      <Section eyebrow="05" title="Studio workflow patterns" icon={Layers}>
        <DefList
          items={[
            ["Specifier → Procurement hand-off", "Set the project filter, open /trade/ffe-schedule, export PDF Rev A. Procurement works from the same URL — no file emailing."],
            ["Client sign-off", "Filter to a single room, export PDF, attach to the project folder for a clean client-facing review."],
            ["Mid-project change orders", "Add the new item to the quote (not the schedule directly). The schedule re-aggregates; export Rev B."],
            ["Multi-designer projects", "Layer the designer filter for atelier-by-atelier reviews; clear it before exporting the master schedule."],
          ]}
        />
        <Callout title="Tip">
          Bookmark the filtered URL{" "}
          <code className="text-xs">/trade/ffe-schedule?project=&lt;id&gt;</code>{" "}
          per project — every team member opens the right schedule on first click.
        </Callout>
      </Section>

      <p className="font-body text-xs italic text-muted-foreground border-t border-border pt-6">
        Want a tailored FF&amp;E template for your studio's procurement system? Reach
        out to your Maison Affluency contact — we'll align the export to your headers.
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
