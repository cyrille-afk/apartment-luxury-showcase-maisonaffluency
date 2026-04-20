import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface GalleryThumbnailsEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Minimum number of empty slots to always show. Default 5. */
  minSlots?: number;
}

/**
 * Unlimited gallery thumbnail editor for the admin.
 * - Shows at least `minSlots` rows so admins can paste into empty slots immediately.
 * - "Add another" appends a new empty row regardless of trailing emptiness.
 * - Persists only non-empty entries (trims trailing blanks before save).
 */
export default function GalleryThumbnailsEditor({
  value,
  onChange,
  minSlots = 5,
}: GalleryThumbnailsEditorProps) {
  // Local items can include trailing empty slots that we don't persist.
  const [items, setItems] = useState<string[]>(() => padToMin(value, minSlots));

  // Re-sync when parent value changes (e.g. after server reload), but only if
  // it differs from the trimmed local view to avoid clobbering in-flight edits.
  useEffect(() => {
    const trimmed = trimTrailingEmpty(items);
    const equal =
      trimmed.length === value.length &&
      trimmed.every((v, i) => v === value[i]);
    if (!equal) {
      setItems(padToMin(value, minSlots));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  const commit = (next: string[]) => {
    setItems(next);
    onChange(trimTrailingEmpty(next));
  };

  return (
    <div className="space-y-1.5 mt-1">
      {items.map((url, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground w-5 tabular-nums">{i + 1}.</span>
          {url ? (
            <img src={url} alt="" className="w-10 h-10 object-cover rounded border border-border shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded border border-dashed border-border shrink-0" />
          )}
          <Input
            value={url}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value.trim();
              commit(next);
            }}
            placeholder="https://…"
            className="text-xs font-mono flex-1"
          />
          <button
            type="button"
            title="Move up"
            disabled={i === 0}
            onClick={() => {
              const next = [...items];
              [next[i - 1], next[i]] = [next[i], next[i - 1]];
              commit(next);
            }}
            className="text-xs px-1.5 py-0.5 border border-border rounded disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            title="Move down"
            disabled={i === items.length - 1}
            onClick={() => {
              const next = [...items];
              [next[i + 1], next[i]] = [next[i], next[i + 1]];
              commit(next);
            }}
            className="text-xs px-1.5 py-0.5 border border-border rounded disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            title="Insert new thumbnail below"
            onClick={() => {
              const next = [...items];
              next.splice(i + 1, 0, "");
              commit(next);
            }}
            className="text-xs px-1.5 py-0.5 border border-border rounded hover:bg-muted/40"
          >
            +
          </button>
          <button
            type="button"
            title="Remove"
            onClick={() => commit(items.filter((_, idx) => idx !== i))}
            className="text-xs px-1.5 py-0.5 border border-border rounded text-destructive hover:bg-destructive/10"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => commit([...items, ""])}
        className="text-[11px] px-2 py-1 border border-dashed border-border rounded hover:bg-muted/40"
      >
        + Add another thumbnail
      </button>
    </div>
  );
}

function trimTrailingEmpty(arr: string[]): string[] {
  const next = [...arr];
  while (next.length && !next[next.length - 1]) next.pop();
  return next;
}

function padToMin(arr: string[], minSlots: number): string[] {
  if (arr.length >= minSlots) return [...arr];
  return [...arr, ...Array(minSlots - arr.length).fill("")];
}
