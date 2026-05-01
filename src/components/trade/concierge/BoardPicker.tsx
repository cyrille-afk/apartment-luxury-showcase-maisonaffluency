import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, FilePlus2 } from "lucide-react";
import { useUserBoards } from "@/hooks/useUserBoards";
import { cn } from "@/lib/utils";

interface Props {
  /** Currently selected board id (controlled). */
  value: string | null;
  onChange: (boardId: string) => void;
  /** Called when the user picks "Create new instead". */
  onCreateNew?: () => void;
  disabled?: boolean;
}

/**
 * Compact searchable combobox of the user's tearsheets.
 * Designed to fit inside the concierge chat panel (380px wide).
 */
export function BoardPicker({ value, onChange, onCreateNew, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const { boards, loading } = useUserBoards(true);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = boards.find((b) => b.id === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter((b) => {
      const hay = `${b.title} ${b.client_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [boards, query]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left transition-colors",
          "hover:border-accent/60 disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        <span className="flex-1 min-w-0">
          <span className="block font-display text-sm text-foreground truncate">
            {selected ? selected.title : "Select a tearsheet…"}
          </span>
          {selected && (
            <span className="block font-body text-[10px] text-muted-foreground truncate">
              {selected.item_count} {selected.item_count === 1 ? "piece" : "pieces"}
              {selected.client_name ? ` · ${selected.client_name}` : ""}
              {selected.status === "draft" ? " · Draft" : ""}
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg overflow-hidden animate-fade-in">
          <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tearsheets…"
              className="flex-1 bg-transparent font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto">
            {loading && (
              <li className="px-2.5 py-2 font-body text-[11px] text-muted-foreground">Loading…</li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="px-2.5 py-2 font-body text-[11px] text-muted-foreground">
                {query ? "No matches" : "No tearsheets yet"}
              </li>
            )}
            {!loading && filtered.map((b) => {
              const isActive = b.id === value;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(b.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-muted transition-colors",
                      isActive && "bg-accent/10",
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-display text-xs text-foreground truncate">{b.title}</span>
                      <span className="block font-body text-[10px] text-muted-foreground truncate">
                        {b.item_count} {b.item_count === 1 ? "piece" : "pieces"}
                        {b.client_name ? ` · ${b.client_name}` : ""}
                        {b.status === "draft" ? " · Draft" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery("");
                onCreateNew();
              }}
              className="flex w-full items-center gap-1.5 border-t border-border px-2.5 py-2 font-body text-[11px] uppercase tracking-widest text-accent hover:bg-accent/5 transition-colors"
            >
              <FilePlus2 className="h-3 w-3" />
              Create new instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
