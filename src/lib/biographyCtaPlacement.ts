/**
 * Placement of the collection CTA ("Discover the Collection") inside a biography.
 *
 * The CTA sits at the midpoint of the narrative — after paragraph 3 when the
 * biography has five paragraphs — rather than immediately after the opening.
 * When a media row (the biography video) sits directly beneath the target
 * paragraph, the CTA follows that media so the break reads as a chapter change.
 */

export type CtaPlacement = {
  /** Index of the rendered row the CTA follows. */
  rowIndex: number;
  /** Paragraphs of that row sitting above the CTA; 0 = the CTA follows the whole row. */
  splitAt: number;
};

/** 1-based paragraph the CTA follows: the midpoint of the narrative. */
export function collectionCtaTarget(paragraphCount: number): number {
  return Math.max(1, Math.ceil(paragraphCount / 2));
}

/**
 * @param rowParagraphCounts paragraphs each rendered row contributes, in reading order.
 * @returns where the CTA sits; `splitAt` > 0 means the row breaks in two around it.
 */
export function placeCtaAfterParagraph(rowParagraphCounts: number[]): CtaPlacement {
  const total = rowParagraphCounts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return { rowIndex: Math.max(0, rowParagraphCounts.length - 1), splitAt: 0 };

  const target = collectionCtaTarget(total);
  let rowIndex = Math.max(0, rowParagraphCounts.length - 1);
  let seen = 0;
  for (let index = 0; index < rowParagraphCounts.length; index += 1) {
    const count = rowParagraphCounts[index];
    if (count > 0 && seen + count >= target) {
      rowIndex = index;
      break;
    }
    seen += count;
  }

  // A video directly beneath the target paragraph keeps the CTA after it.
  while (
    rowParagraphCounts[rowIndex + 1] === 0 &&
    rowParagraphCounts.slice(rowIndex + 2).some((count) => count > 0)
  ) {
    rowIndex += 1;
  }

  const splitAt = target - seen;
  return {
    rowIndex,
    splitAt: splitAt > 0 && splitAt < rowParagraphCounts[rowIndex] ? splitAt : 0,
  };
}
