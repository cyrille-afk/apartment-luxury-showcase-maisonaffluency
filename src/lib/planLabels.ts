import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { footprintClearance, footprintOf, type ClearanceSpan } from "@/lib/layoutGuides";

const CHAR_W = 0.56; // average glyph width as a fraction of font size
const MAX_FONT = 0.16;
const MIN_FONT = 0.07;

/** Fit a piece label inside its w × d footprint (metres): shrink, then truncate. */
export function fitPlanLabel(name: string, w: number, d: number): { name: string; fontSize: number; showDims: boolean } {
  const avail = w * 0.88;
  const fontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, d * 0.28, avail / Math.max(1, name.length * CHAR_W)));
  const maxChars = Math.floor(avail / (fontSize * CHAR_W));
  const text = maxChars < 2 ? "" : name.length <= maxChars ? name : `${name.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  return { name: text, fontSize, showDims: d >= fontSize * 2.6 && w >= fontSize * 0.75 * 0.56 * 13 };
}

/** Closest piece-to-piece span when it is tight or blocked, else null. */
export function tightestPiecePair(objects: PlacedObject[]): ClearanceSpan | null {
  let best: ClearanceSpan | null = null;
  for (let i = 0; i < objects.length; i++) {
    const fi = footprintOf(objects[i]);
    for (let j = i + 1; j < objects.length; j++) {
      const span = footprintClearance(fi, footprintOf(objects[j]));
      if (!best || span.distance < best.distance) best = span;
    }
  }
  return best && best.level !== "comfortable" ? best : null;
}
