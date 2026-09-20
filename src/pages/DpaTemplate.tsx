/**
 * Baseline GDPR Article 28 Data Processing Agreement, rendered for the legal
 * desk at `/compliance/dpa-template`. Internal reference material: noindex,
 * and exportable as Markdown so it can be negotiated offline.
 */
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer } from "lucide-react";
import {
  DPA_TEMPLATE_EFFECTIVE,
  DPA_TEMPLATE_MARKDOWN,
  DPA_TEMPLATE_VERSION,
} from "@/content/dpa-template";

const DpaTemplate = () => {
  const download = () => {
    // Blob download keeps the session intact (no navigation away).
    const blob = new Blob([DPA_TEMPLATE_MARKDOWN], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maison-affluency-dpa-template-v${DPA_TEMPLATE_VERSION}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <Helmet>
        <title>Supplier DPA Template — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <Link
          to="/admin/compliance/sub-processors"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Sub-processor register
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <Download className="mr-2 h-4 w-4" /> Export Markdown
          </Button>
        </div>
      </div>

      <div className="mt-8 border-b border-border pb-6">
        <p className="text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground">
          Legal desk · Baseline contractual terms
        </p>
        <h1 className="mt-3 font-serif text-3xl">Supplier Data Processing Agreement</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Version {DPA_TEMPLATE_VERSION} · Effective {DPA_TEMPLATE_EFFECTIVE} · GDPR Article 28
        </p>
      </div>

      <article
        className="prose prose-sm mt-8 max-w-none dark:prose-invert
          prose-headings:font-serif prose-headings:font-normal
          prose-h1:hidden
          prose-table:text-xs prose-th:text-left prose-a:underline-offset-4"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{DPA_TEMPLATE_MARKDOWN}</ReactMarkdown>
      </article>
    </div>
  );
};

export default DpaTemplate;
