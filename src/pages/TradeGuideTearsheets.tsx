import { Link, useParams, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FileText,
  Layers,
  ListChecks,
  Tags,
  Workflow,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const PDF_URL = "/guides/studio-tearsheets.pdf";
const SLUG = "tearsheets";

export default function TradeGuideTearsheets() {
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
          Building a Tearsheet
        </h1>
        <p className="font-body text-base text-muted-foreground">
          How to assemble a professional, client-ready tearsheet from curated picks
          and trade products — covering page layout, specification fields, branding
          and PDF export workflows.
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

      <Section eyebrow="01" title="What a tearsheet is" icon={FileText}>
        <p>
          A tearsheet (<Link to="/trade/tearsheets" className="underline underline-offset-2 hover:text-primary">/trade/tearsheets</Link>)
          is a one-page, print-ready specification document for a single product or a
          curated group of products. It pairs hero imagery with the technical
          information procurement and clients need: dimensions, materials, finishes,
          lead time, trade pricing and your studio attribution.
        </p>
        <DefList
          items={[
            ["One-pager per item", "Each tearsheet captures a single product or option-set on a single page for quick visual review."],
            ["Branded header", "Studio name, project, designer, and revision date appear on every sheet — no orphan PDFs."],
            ["Spec block", "Pulled live from the trade product record — dimensions, materials, finish, origin and lead time."],
            ["Trade pricing", "Optional per-sheet toggle: include trade price, RRP, or hide pricing entirely for client-facing decks."],
          ]}
        />
        <Callout title="When to use a tearsheet vs an FF&E schedule">
          Tearsheets are visual, per-item, and client-friendly. The FF&amp;E schedule
          is tabular, project-wide, and procurement-friendly. Most studios use both
          in parallel — the tearsheet sells the choice, the schedule procures it.
        </Callout>
      </Section>

      <Section eyebrow="02" title="Building a tearsheet" icon={Workflow}>
        <Subsection title="A. From a Curators' Pick">
          On any curator pick page, use <em>Add to Tearsheet</em>. The hero image,
          designer attribution and spec block are pre-filled. You only choose the
          project and (optionally) the room.
        </Subsection>
        <Subsection title="B. From a Trade Product">
          On the trade product detail page, the same <em>Add to Tearsheet</em>
          action creates a sheet using the trade record's images and specs — ideal
          for items already priced for your studio.
        </Subsection>
        <Subsection title="C. From a Board or Quote">
          Any item already in a board or quote can be promoted into a tearsheet in
          one click. The link to the source quote/board is preserved so changes
          flow back.
        </Subsection>
        <Callout title="Multi-option tearsheets">
          For a single specification with multiple finishes (e.g. three leathers on
          one chair), create one tearsheet with the variants section enabled. Each
          variant gets its own swatch, code and trade price line.
        </Callout>
      </Section>

      <Section eyebrow="03" title="Layout, fields and branding" icon={Tags}>
        <p>
          Every tearsheet uses the same layout grid so a stack of sheets reads as a
          single document. The grid is fixed; the content is yours to control.
        </p>
        <DefList
          items={[
            ["Header", "Studio logo (left) · Project name (centre) · Revision + date (right)."],
            ["Hero", "Primary image at top, optional secondary image or detail shot below-right."],
            ["Spec block", "Designer · Brand · Dimensions · Materials · Finish · Origin · Lead time."],
            ["Pricing block", "Trade price, RRP, currency. Toggle visibility per sheet for client-facing exports."],
            ["Footer", "Studio contact, page n of N, project code."],
          ]}
        />
        <Subsection title="Logo & cover style">
          Set your studio logo once under{" "}
          <Link to="/trade/profile" className="underline underline-offset-2 hover:text-primary">
            /trade/profile
          </Link>
          . It applies to every tearsheet header and the cover sheet of any
          multi-page export.
        </Subsection>
      </Section>

      <Section eyebrow="04" title="Reviewing & exporting" icon={ListChecks}>
        <Subsection title="A. Single-sheet PDF">
          From any tearsheet, <em>Export PDF</em> renders the current sheet at A4
          or US Letter (set per project). Use this for one-off product approvals.
        </Subsection>
        <Subsection title="B. Multi-sheet deck">
          Select multiple tearsheets in the project list and <em>Export deck</em>.
          A cover sheet is auto-generated and sheets are ordered by room → brand →
          item code, matching the FF&amp;E schedule.
        </Subsection>
        <Subsection title="C. Client-facing vs procurement">
          Toggle <em>Hide pricing</em> at export time to produce a client-friendly
          deck without trade prices. Procurement copies are exported with full
          pricing in a single click — same sheets, two audiences.
        </Subsection>
        <Subsection title="D. Revisions">
          Like the FF&amp;E schedule, exports stamp a revision letter into the
          filename. The on-screen tearsheet always reflects the live record.
        </Subsection>
      </Section>

      <Section eyebrow="05" title="Studio workflow patterns" icon={Layers}>
        <DefList
          items={[
            ["Concept review", "Build 6–10 tearsheets per room, export deck with pricing hidden, walk client through the scheme."],
            ["Specification freeze", "Once approved, lock the tearsheet (revision pin) so spec changes require a new revision letter."],
            ["Procurement hand-off", "Re-export the same deck with pricing on, alongside the FF&E schedule, for procurement to action."],
            ["Library reuse", "Tearsheets created on one project can be cloned into another — useful for repeat specifications across residences."],
          ]}
        />
        <Callout title="Tip">
          Use the <em>Notes</em> field on each sheet for finish call-outs, COM
          fabric references or installation guidance — it prints on the sheet and
          stays attached to the source product.
        </Callout>
      </Section>

      <p className="font-body text-xs italic text-muted-foreground border-t border-border pt-6">
        Want a custom tearsheet template aligned to your studio's brand guidelines?
        Reach out to your Maison Affluency contact — we'll match typography, logo
        placement and accent colours.
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
