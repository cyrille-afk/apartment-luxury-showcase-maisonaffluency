import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  zone: string;
  markdown: string;
}

/**
 * Renders a client-generated markdown SPECIFICATION SCHEDULE with Copy and
 * Download-as-.md actions. Rendered inline as an assistant message.
 * The markdown is built deterministically from database rows — never model
 * output — so there is no hallucination risk here.
 */
export function SpecScheduleBlock({ zone, markdown }: Props) {
  const [copied, setCopied] = useState(false);

  const filename = useMemo(() => {
    const slug =
      zone
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "spec-schedule";
    return `${slug}.md`;
  }, [zone]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied — noop */
    }
  };

  const onDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/60 p-4 space-y-3 max-w-[92%]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground">
          Specification schedule · local export
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-2.5 py-1 text-[11px] font-body text-foreground transition",
            )}
            aria-label="Copy schedule"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-2.5 py-1 text-[11px] font-body text-foreground transition"
            aria-label="Download schedule as markdown"
          >
            <Download className="h-3 w-3" />
            .md
          </button>
        </div>
      </div>

      <div className="concierge-md space-y-2.5 text-sm leading-relaxed text-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => <p className="my-0" {...props} />,
            ul: ({ node, ...props }) => (
              <ul className="list-disc pl-5 space-y-1 my-1" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="leading-relaxed [&>p]:my-0" {...props} />
            ),
            strong: ({ node, ...props }) => (
              <strong className="font-semibold text-foreground" {...props} />
            ),
            em: ({ node, ...props }) => <em className="italic" {...props} />,
            a: ({ node, ...props }) => (
              <a
                className="underline hover:text-accent"
                target="_blank"
                rel="noreferrer"
                {...props}
              />
            ),
            h1: ({ node, ...props }) => (
              <h3 className="font-display text-sm mt-1 mb-1 uppercase tracking-wide" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h3 className="font-display text-sm mt-1 mb-1 uppercase tracking-wide" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="font-display text-sm mt-1 mb-1 uppercase tracking-wide" {...props} />
            ),
            hr: () => <hr className="my-2 border-border/60" />,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
