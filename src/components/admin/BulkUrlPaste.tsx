import { useEffect, useRef, useState } from "react";

interface BulkUrlPasteProps {
  /** Called with the parsed list of URLs to append. */
  onAdd: (urls: string[]) => void;
  label?: string;
  placeholder?: string;
  /** Unique key so the draft survives re-renders / remounts of the editor. */
  storageKey?: string;
}

/**
 * Bulk paste helper for admin media editors.
 * Accepts newline, comma, or whitespace separated URLs and appends them all at once.
 * The draft text + open state are persisted so a parent re-render (or a data refetch
 * that remounts the editor) never loses what you already pasted.
 */
export default function BulkUrlPaste({
  onAdd,
  label = "Bulk paste URLs",
  placeholder = "Paste one URL per line (or comma-separated)…",
  storageKey = "bulk-url-paste",
}: BulkUrlPasteProps) {
  const sk = `bup:${storageKey}`;
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(`${sk}:open`) === "1";
    } catch {
      return false;
    }
  });
  const [text, setText] = useState(() => {
    try {
      return sessionStorage.getItem(`${sk}:text`) ?? "";
    } catch {
      return "";
    }
  });
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(`${sk}:text`, text);
      sessionStorage.setItem(`${sk}:open`, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sk, text, open]);

  const parsed = parseUrls(text);

  const clear = () => {
    setText("");
    try {
      sessionStorage.removeItem(`${sk}:text`);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-1.5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] px-2 py-1 border border-dashed border-border rounded hover:bg-muted/40"
        >
          ⇪ {label}
          {parsed.length > 0 && (
            <span className="ml-1 text-muted-foreground">
              ({parsed.length} saved)
            </span>
          )}
        </button>
      ) : (
        <div className="space-y-1.5 border border-border rounded p-2">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={placeholder}
            className="w-full text-xs font-mono bg-background border border-border rounded p-2 outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={parsed.length === 0}
              onClick={() => {
                onAdd(parsed);
                clear();
                setOpen(false);
              }}
              className="text-[11px] px-2 py-1 border border-border rounded disabled:opacity-40 hover:bg-muted/40"
            >
              Add {parsed.length || ""} {parsed.length === 1 ? "URL" : "URLs"}
            </button>
            <button
              type="button"
              disabled={parsed.length === 0}
              onClick={() => {
                onAdd(parsed);
                clear();
                // stay open + focused so you can paste the next batch immediately
                requestAnimationFrame(() => taRef.current?.focus());
              }}
              className="text-[11px] px-2 py-1 border border-border rounded disabled:opacity-40 hover:bg-muted/40"
            >
              Add &amp; keep pasting
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] px-2 py-1 border border-border rounded hover:bg-muted/40"
            >
              Hide
            </button>
            <button
              type="button"
              onClick={clear}
              className="text-[11px] px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <span className="text-[10px] text-muted-foreground">
              {parsed.length > 0 ? `${parsed.length} detected · ` : ""}draft saved
            </span>
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
