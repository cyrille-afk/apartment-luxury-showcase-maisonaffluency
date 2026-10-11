/** Pair successive pictures with one narrative paragraph, leaving remaining text with the final picture. */
export function biographyPictureGroups<T>(texts: T[], pictureCount: number): T[][] {
  if (pictureCount <= 0) return texts.length ? [texts] : [];
  return Array.from({ length: pictureCount }, (_, index) =>
    index === pictureCount - 1 ? texts.slice(index) : texts.slice(index, index + 1),
  );
}