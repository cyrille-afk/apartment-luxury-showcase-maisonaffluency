import React from "react";

/**
 * Renders the "**Match:** <Band · NN%> — <rationale>" line (+ optional
 * "**Signals:**" attribute breakdown) the concierge emits for each of the 3
 * Private Exhibition pieces, as a distinct badge card so trade clients can
 * scan match quality at a glance.
 *
 * Bands (from concierge-public-stream/index.ts):
 *   High         85–97%   3+ signals align
 *   Considered   70–84%   2 signals align
 *   Exploratory  55–69%   1 signal / intentionally extends brief
 */
export type MatchBand = "High" | "Considered" | "Exploratory";
export type SignalAxis = "style" | "palette" | "material" | "typology" | "room";
export type SignalState = "match" | "partial" | "miss" | "n/a";

export interface SignalRow {
  axis: SignalAxis;
  state: SignalState;
  note: string;
}

export interface ParsedMatch {
  band: MatchBand;
  percent: number;
  rationale: string;
  signals?: SignalRow[];
}

const MATCH_RE = /^\s*[·•\-–—]?\s*(High|Considered|Exploratory)\s*[·•\-–—]\s*(\d{1,3})\s*%\s*[—–-]\s*(.+)$/i;

const SIGNALS_MARKER_RE = /\s*⟦SIGNALS:([^⟧]+)⟧\s*$/;

/** Parse the text tail that follows the "Match:" strong tag. */
export function parseMatchTail(tail: string): ParsedMatch | null {
  let signals: SignalRow[] | undefined;
  let cleaned = tail;
  const mark = SIGNALS_MARKER_RE.exec(tail);
  if (mark) {
    try {
      const decoded = decodeURIComponent(mark[1]);
      const parsed = parseSignalsTail(decoded);
      if (parsed) signals = parsed;
    } catch { /* ignore */ }
    cleaned = tail.replace(SIGNALS_MARKER_RE, "");
  }
  const m = MATCH_RE.exec(cleaned);
  if (!m) return null;
  const band = (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) as MatchBand;
  const percent = Math.max(0, Math.min(100, parseInt(m[2], 10)));
  const rationale = m[3].trim().replace(/^["'“”‘’]|["'“”‘’]$/g, "");
  return { band, percent, rationale, signals };
}

/**
 * Pre-transform assistant markdown: for each `**Match:** …` paragraph,
 * find the immediately-following `**Signals:** …` paragraph, encode the
 * signals tail into an inline marker on the Match line, and delete the
 * Signals paragraph. This lets the ReactMarkdown `p` renderer swap in a
 * single MatchBadge with an attribute breakdown.
 */
export function inlineSignalsIntoMatchLines(md: string): string {
  if (!md || md.indexOf("**Signals:") === -1) return md;
  // Split on blank-line paragraph boundaries but keep separators so we can
  // reassemble faithfully.
  const parts = md.split(/(\n{2,})/);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!/^\s*\*\*Match:\*\*/i.test(p)) continue;
    // Look ahead through blank separators for the next non-empty paragraph.
    let j = i + 1;
    while (j < parts.length && /^\s*$|^\n+$/.test(parts[j])) j++;
    const next = parts[j];
    if (!next) continue;
    const sm = /^\s*\*\*Signals:\*\*\s*([\s\S]+?)\s*$/i.exec(next);
    if (!sm) continue;
    const tail = sm[1].replace(/\s+/g, " ").trim();
    parts[i] = p.replace(/\s*$/, "") + " ⟦SIGNALS:" + encodeURIComponent(tail) + "⟧";
    // Drop the Signals paragraph AND the preceding blank separator.
    parts[j] = "";
    if (j - 1 > i) parts[j - 1] = "";
  }
  return parts.join("");
}


const AXIS_ORDER: SignalAxis[] = ["style", "palette", "material", "typology", "room"];
const VALID_STATES: SignalState[] = ["match", "partial", "miss", "n/a"];

/**
 * Parse the tail of the "**Signals:**" line, e.g.
 *   " style=match:warm minimal; palette=partial:oak+cream; material=miss:...; typology=match:low sofa; room=n/a:no plan"
 */
export function parseSignalsTail(tail: string): SignalRow[] | null {
  if (!tail) return null;
  const parts = tail.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const rows: SignalRow[] = [];
  for (const part of parts) {
    // Match: axis=state:note   OR   axis: state — note   (be forgiving)
    const m = /^\s*(style|palette|material|typology|room)\s*[:=]\s*(match|partial|miss|n\/?a)\s*[:—–\-]\s*(.+)$/i.exec(part);
    if (!m) continue;
    const axis = m[1].toLowerCase() as SignalAxis;
    let state = m[2].toLowerCase().replace(/\s+/g, "") as SignalState;
    if ((state as string) === "na") state = "n/a";
    if (!VALID_STATES.includes(state)) continue;
    const note = m[3].trim().replace(/^["'“”‘’]|["'“”‘’.]$/g, "");
    rows.push({ axis, state, note });
  }
  if (!rows.length) return null;
  // Sort into canonical order; keep last value per axis if duplicated.
  const byAxis = new Map<SignalAxis, SignalRow>();
  for (const r of rows) byAxis.set(r.axis, r);
  return AXIS_ORDER.filter((a) => byAxis.has(a)).map((a) => byAxis.get(a)!);
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

const stateStyles: Record<SignalState, { icon: string; label: string; cls: string }> = {
  match:   { icon: "✓", label: "Aligns",   cls: "text-emerald-700 dark:text-emerald-300" },
  partial: { icon: "≈", label: "Partial",  cls: "text-amber-700 dark:text-amber-300" },
  miss:    { icon: "→", label: "Extends",  cls: "text-sky-700 dark:text-sky-300" },
  "n/a":   { icon: "—", label: "No signal", cls: "text-muted-foreground" },
};

const axisLabel: Record<SignalAxis, string> = {
  style: "Style",
  palette: "Palette",
  material: "Material",
  typology: "Typology",
  room: "Room",
};

export const MatchBadge: React.FC<{ parsed: ParsedMatch }> = ({ parsed }) => {
  const s = bandStyles[parsed.band];
  const signals = parsed.signals ?? [];
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
      {signals.length > 0 && (
        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 border-t border-border/50 pt-2">
          {signals.map((row) => {
            const st = stateStyles[row.state];
            return (
              <li
                key={row.axis}
                className="flex items-baseline gap-1.5 font-body text-[11px] leading-snug"
              >
                <span
                  aria-label={st.label}
                  className={`inline-flex w-3.5 shrink-0 justify-center font-semibold ${st.cls}`}
                >
                  {st.icon}
                </span>
                <span className="uppercase tracking-[0.1em] text-[9px] text-muted-foreground w-14 shrink-0">
                  {axisLabel[row.axis]}
                </span>
                <span className="text-foreground/90 truncate" title={row.note}>
                  {row.note}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MatchBadge;
