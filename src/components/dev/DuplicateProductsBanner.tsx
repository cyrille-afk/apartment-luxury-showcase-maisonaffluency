import { useEffect, useState } from "react";
import type { DuplicateGroup } from "@/hooks/useTradeProducts";
import { useHiddenTradeProductIds } from "@/hooks/useHiddenTradeProductIds";

/**
 * Dev-only banner that surfaces likely duplicate product cards in the Trade
 * grid (e.g. "Pars" + "Pars Cocktail Table" appearing as two cards because
 * the static + live merge keys didn't match exactly). Each item in a group
 * renders as a thumbnail; click to hide that specific card from the grid
 * (state is persisted in localStorage and respected by `useTradeProducts`).
 *
 * In dev, a small persistent pill remains available even after dismissing.
 */
export default function DuplicateProductsBanner({
  groups,
}: {
  groups: DuplicateGroup[];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const { ids: hiddenIds, hide, unhide, clear } = useHiddenTradeProductIds();

  const safeGroups = groups || [];
  const isHiddenItem = (item: DuplicateGroup["items"][number]) =>
    hiddenIds.has(item.id) || hiddenIds.has(item.hide_key);
  const hiddenCount = safeGroups.reduce(
    (sum, g) => sum + g.items.filter(isHiddenItem).length,
    0
  );
  const visibleGroups = safeGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !isHiddenItem(item)),
    }))
    .filter((group) => group.items.length > 1);
  const hasVisibleGroups = visibleGroups.length > 0;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (safeGroups.length === 0) {
      console.info("[Trade duplicate inspector] no duplicate groups detected", {
        hiddenKeys: Array.from(hiddenIds),
      });
      return;
    }
    console.groupCollapsed(
      `[Trade duplicate inspector] ${safeGroups.length} group(s) · ${safeGroups.reduce((s, g) => s + g.items.length, 0)} cards`
    );
    for (const group of safeGroups) {
      console.groupCollapsed(`${group.brand} · ${group.items.length} items`);
      console.table(
        group.items.map((item) => ({
          product_name: item.product_name,
          id: item.id,
          hide_key: item.hide_key,
          hidden: hiddenIds.has(item.id) || hiddenIds.has(item.hide_key),
        }))
      );
      console.groupEnd();
    }
    console.info("hiddenKeys:", Array.from(hiddenIds));
    console.groupEnd();
  }, [safeGroups, hiddenIds]);

  if (!import.meta.env.DEV) return null;

  // Always show a floating pill in dev so the banner can be re-opened at any
  // time, even when no duplicates are currently detected (so the dev can also
  // restore previously-hidden items).
  if (dismissed || !hasVisibleGroups) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 text-xs text-foreground shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => {
            setDismissed(false);
            setExpanded(true);
          }}
          className="font-medium hover:text-accent"
          title={hasVisibleGroups ? "Show duplicate inspector" : "No visible duplicates detected right now"}
        >
          Dev duplicates · {visibleGroups.length}
        </button>
        {hiddenIds.size > 0 && (
          <button type="button" onClick={clear} className="text-muted-foreground underline hover:text-foreground">
            Restore {hiddenIds.size} hidden
          </button>
        )}
      </div>
    );
  }

  const totalDupes = visibleGroups.reduce((sum, g) => sum + g.items.length, 0);

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
          Dev warning · {visibleGroups.length} duplicate group
          {visibleGroups.length === 1 ? "" : "s"} ({totalDupes} visible cards) detected
          {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
        </div>
        <div className="flex items-center gap-2">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              Restore all
            </button>
          )}
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
        <>
          <p className="mt-2 text-[11px] opacity-75">
            Click an image to hide that card from the grid. Click again to
            restore.
          </p>
          <ul className="mt-2 space-y-3 text-xs">
             {visibleGroups.map((g, i) => (
              <li
                key={`${g.brand}-${i}`}
                className="rounded border border-amber-400/40 bg-white/60 p-2 dark:bg-black/20"
              >
                <div className="mb-2 font-medium">{g.brand}</div>
                <div className="flex flex-wrap gap-3">
                  {g.items.map((it) => {
                    const isHidden = isHiddenItem(it);
                    return (
                      <button
                        key={it.hide_key}
                        type="button"
                        onClick={() => {
                          if (isHidden) {
                            unhide(it.hide_key);
                            unhide(it.id);
                          } else {
                            hide(it.hide_key);
                          }
                        }}
                        title={
                          isHidden
                            ? `Restore "${it.product_name}"`
                            : `Hide "${it.product_name}" from grid`
                        }
                        className="group relative flex w-28 flex-col items-stretch gap-1 text-left"
                      >
                        <div
                          className={
                            "relative aspect-square w-full overflow-hidden rounded border " +
                            (isHidden
                              ? "border-amber-600/60 opacity-40"
                              : "border-amber-400/50 hover:border-amber-700")
                          }
                        >
                          {it.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.image_url}
                              alt={it.product_name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] opacity-60">
                              no image
                            </div>
                          )}
                          <div
                            className={
                              "pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider transition " +
                              (isHidden
                                ? "bg-black/40 text-white"
                                : "bg-black/0 text-transparent group-hover:bg-black/45 group-hover:text-white")
                            }
                          >
                            {isHidden ? "Hidden — click to restore" : "Click to hide"}
                          </div>
                        </div>
                        <div className="line-clamp-2 leading-tight">
                          {it.product_name}
                        </div>
                        <div className="font-mono text-[10px] opacity-50">
                          {it.id.slice(0, 8)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
