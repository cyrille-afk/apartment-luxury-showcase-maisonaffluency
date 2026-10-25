import { Bold, Highlighter, List } from "lucide-react";

interface Props { targetId: string; value: string; onChange: (value: string) => void; maxLength: number }

/** Inserts **bold**, ==highlight== and "- " bullet markers into a Designer Notes textarea. */
export default function DesignerNoteToolbar({ targetId, value, onChange, maxLength }: Props) {
  const apply = (kind: "bold" | "mark" | "bullet") => {
    const ta = document.getElementById(targetId) as HTMLTextAreaElement | null;
    const start = ta?.selectionStart ?? value.length, end = ta?.selectionEnd ?? value.length;
    let next: string, selStart: number, selEnd: number;
    if (kind === "bullet") {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end);
      const bulleted = block.split("\n").map(l => (/^\s*- /.test(l) ? l.replace(/^(\s*)- /, "$1") : `- ${l}`)).join("\n");
      next = value.slice(0, lineStart) + bulleted + value.slice(end);
      selStart = lineStart; selEnd = lineStart + bulleted.length;
    } else {
      const marker = kind === "bold" ? "**" : "==";
      const inner = value.slice(start, end) || (kind === "bold" ? "key detail" : "highlight");
      next = value.slice(0, start) + marker + inner + marker + value.slice(end);
      selStart = start + 2; selEnd = selStart + inner.length;
    }
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(selStart, selEnd); });
  };
  const btn = "inline-flex h-6 w-6 items-center justify-center rounded border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  return (
    <div className="mb-1 flex items-center gap-1" role="toolbar" aria-label="Designer notes formatting">
      <button type="button" title="Bold (**text**)" aria-label="Bold" className={btn} onMouseDown={e => e.preventDefault()} onClick={() => apply("bold")}><Bold className="h-3 w-3" /></button>
      <button type="button" title="Highlight (==text==)" aria-label="Highlight" className={btn} onMouseDown={e => e.preventDefault()} onClick={() => apply("mark")}><Highlighter className="h-3 w-3" /></button>
      <button type="button" title="Bullet list (- item)" aria-label="Bullet list" className={btn} onMouseDown={e => e.preventDefault()} onClick={() => apply("bullet")}><List className="h-3 w-3" /></button>
    </div>
  );
}
