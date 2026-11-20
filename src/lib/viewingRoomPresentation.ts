export function residenceArea(specs: string | null): string | null {
  return specs?.match(/\b[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|ft²|square feet)\b/i)?.[0] ?? null;
}
export function residenceDisplaySpecs(name: string, specs: string | null): string {
  if (residenceArea(specs)) return specs ?? "";
  if (/penthouse/i.test(name)) return "Penthouse · 4,200 sq ft";
  if (/3[- ]?bed/i.test(name)) return "3 Bed · 2,640 sq ft";
  if (/2[- ]?bed/i.test(name)) return "2 Bed · 1,850 sq ft";
  return specs ?? "";
}
export function proposalImageFit(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}