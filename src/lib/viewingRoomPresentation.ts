export function residenceArea(specs: string | null): string | null {
  return specs?.match(/\b[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|ft²|square feet)\b/i)?.[0] ?? null;
}
export function proposalImageFit(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}