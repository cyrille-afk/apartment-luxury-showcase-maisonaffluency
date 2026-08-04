import { useState } from "react";

interface BulkUrlPasteProps {
  /** Called with the parsed list of URLs to append. */
  onAdd: (urls: string[]) => void;
  label?: string;
  placeholder?: string;
}

/**
 * Bulk paste helper for admin media editors.
 * Accepts newline, comma, or whitespace separated URLs and appends them all at once.
 */
export default function BulkUrlPaste({
  onAdd,
  label = "Bulk paste URLs",
  placeholder = "Paste one URL per line (or comma-separated)…",
}: BulkUrlPasteProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const parsed = parseUrls(text);

  return (
    <div className="mt-1.5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] px-2 py-1 border border-dashed border-border rounded hover:bg-muted/40"
        >
          ⇪ {label}
        </button>
      ) : (
        <div className="space-y-1.5 border border-border rounded p-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              // Let the default paste land, then keep focus for review.
              e.currentTarget.dataset.pasted = "1";
            }}
            rows={5}
            placeholder={placeholder}
            className="w-full text-xs font-mono bg-background border border-border rounded p-2 outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={parsed.length === 0}
              onClick={() => {
                onAdd(parsed);
                setText("");
                setOpen(false);
              }}
              className="text-[11px] px-2 py-1 border border-border rounded disabled:opacity-40 hover:bg-muted/40"
            >
              Add {parsed.length || ""} {parsed.length === 1 ? "URL" : "URLs"}
            </button>
            <button
              type="button"
              onClick={() => {
                setText("");
                setOpen(false);
              }}
              className="text-[11px] px-2 py-1 border border-border rounded hover:bg-muted/40"
            >
              Cancel
            </button>
            {parsed.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {parsed.length} detected
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function parseUrls(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim().replace(/^["'<(]+|[">')]+$/g, ""))
        .filter((s) => /^https?:\/\//i.test(s)),
    ),
  );
}
