import { useState } from "react";
import type { DuplicateGroup } from "@/hooks/useTradeProducts";

/**
 * Dev-only banner that surfaces likely duplicate product cards in the Trade
 * grid (e.g. "Pars" + "Pars Cocktail Table" appearing as two cards because
 * the static + live merge keys didn't match exactly). Renders nothing in
 * production builds or when no duplicates are detected.
 */
export default function DuplicateProductsBanner({
  groups,
}: {
  groups: DuplicateGroup[];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  if (!import.meta.env.DEV) return null;
  if (dismissed) return null;
  if (!groups || groups.length === 0) return null;

  const totalDupes = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div
      role="status"
      aria-live="polite"
      className="my-4 rounded-md border border-amber-500/60 bg-amber-50/80 p-3 text-amber-900 shadow-sm dark:bg-amber-950/40 dark:text-amber-100"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-amber-500"
            style={{ boxShadow: "0 0 0 4px rgba(245,158,11,0.18)" }}
          />
          Dev warning · {groups.length} duplicate group
          {groups.length === 1 ? "" : "s"} ({totalDupes} cards) detected in
          Trade grid
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs underline opacity-80 hover:opacity-100"
          >
            {expanded ? "Hide" : "Show"} details
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="text-base leading-none opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      </div>

      {expanded && (
        <ul className="mt-2 space-y-2 text-xs">
          {groups.map((g, i) => (
            <li
              key={`${g.brand}-${i}`}
              className="rounded border border-amber-400/40 bg-white/60 p-2 dark:bg-black/20"
            >
              <div className="font-medium">{g.brand}</div>
              <ul className="mt-1 space-y-0.5">
                {g.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 font-mono">
                    <span className="opacity-50">[{it.id.slice(0, 8)}]</span>
                    <span>{it.product_name}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
