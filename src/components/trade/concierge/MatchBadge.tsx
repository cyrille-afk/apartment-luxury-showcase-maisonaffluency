import React from "react";

/**
 * Renders the "**Match:** <Band · NN%> — <rationale>" line the concierge
 * emits for each of the 3 Private Exhibition pieces, as a distinct badge +
 * rationale card so trade clients can scan match quality at a glance.
 *
 * Bands (from concierge-public-stream/index.ts):
 *   High         85–97%   3+ signals align
 *   Considered   70–84%   2 signals align
 *   Exploratory  55–69%   1 signal / intentionally extends brief
 */
export type MatchBand = "High" | "Considered" | "Exploratory";

export interface ParsedMatch {
  band: MatchBand;
  percent: number;
  rationale: string;
}

const MATCH_RE = /^\s*[·•\-–—]?\s*(High|Considered|Exploratory)\s*[·•\-–—]\s*(\d{1,3})\s*%\s*[—–-]\s*(.+)$/i;

/** Parse the text tail that follows the "Match:" strong tag. */
export function parseMatchTail(tail: string): ParsedMatch | null {
  const m = MATCH_RE.exec(tail);
  if (!m) return null;
  const band = (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) as MatchBand;
  const percent = Math.max(0, Math.min(100, parseInt(m[2], 10)));
  const rationale = m[3].trim().replace(/^["'“”‘’]|["'“”‘’]$/g, "");
  return { band, percent, rationale };
}

const bandStyles: Record<MatchBand, { chip: string; bar: string; dot: string }> = {
  High: {
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  Considered: {
    chip: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  Exploratory: {
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
  },
};

export const MatchBadge: React.FC<{ parsed: ParsedMatch }> = ({ parsed }) => {
  const s = bandStyles[parsed.band];
  return (
    <div className="my-2 rounded-md border border-border/60 bg-background/60 p-2.5">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] ${s.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
          Match · {parsed.band}
        </span>
        <span className="font-display text-sm text-foreground tabular-nums">
          {parsed.percent}%
        </span>
        <div
          className="ml-auto h-1 flex-1 max-w-[80px] rounded-full bg-border/60 overflow-hidden"
          role="progressbar"
          aria-valuenow={parsed.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Match confidence ${parsed.percent}%`}
        >
          <div
            className={`h-full ${s.bar} transition-[width] duration-500`}
            style={{ width: `${parsed.percent}%` }}
          />
        </div>
      </div>
      <p className="mt-1.5 font-body text-[12px] italic leading-relaxed text-muted-foreground">
        {parsed.rationale}
      </p>
    </div>
  );
};

export default MatchBadge;
