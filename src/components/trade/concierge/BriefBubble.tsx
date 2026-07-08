import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Detects a message body produced by BriefBuilder's `formatBrief()`.
 * Requires the canonical block headers so free-form messages that merely
 * mention "Block 1" don't collapse by accident.
 */
export function isBriefContent(text: string | null | undefined): boolean {
  if (!text) return false;
  const s = String(text);
  return (
    /Block\s*1\s*—\s*Spatial\s*&\s*Project\s*Context/i.test(s) &&
    /Block\s*2\s*—\s*Hard\s*Technical\s*Parameters/i.test(s) &&
    /Block\s*3\s*—\s*Aesthetic/i.test(s) &&
    /Block\s*4\s*—\s*Output\s*Execution\s*Protocol/i.test(s)
  );
}

/** Extract the user's preamble (text before Block 1), if any. */
function extractPreamble(text: string): string {
  const idx = text.search(/Block\s*1\s*—\s*Spatial/i);
  if (idx <= 0) return "";
  return text.slice(0, idx).trim();
}

type Props = {
  content: string;
  className?: string;
};

export function BriefBubble({ content, className }: Props) {
  const [open, setOpen] = useState(false);
  const preamble = extractPreamble(content);
  const briefBody = preamble ? content.slice(preamble.length).trim() : content;

  return (
    <div className={cn("flex flex-col gap-2 items-end", className)}>
      {preamble && (
        <div className="rounded-2xl rounded-br-md bg-foreground text-background px-4 py-3 font-body text-sm leading-relaxed whitespace-pre-wrap">
          {preamble}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 font-body text-xs uppercase tracking-[0.14em] text-foreground hover:bg-muted transition-colors"
        aria-expanded={open}
        aria-label={open ? "Hide Architectural Brief details" : "Show Architectural Brief details"}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span>📐 Architectural Brief submitted</span>
      </button>
      {open && (
        <pre className="rounded-2xl rounded-br-md bg-foreground/95 text-background px-4 py-3 font-body text-xs leading-relaxed whitespace-pre-wrap max-w-full overflow-x-auto">
          {briefBody}
        </pre>
      )}
    </div>
  );
}

export default BriefBubble;
