type CuratorPickDescriptionInput = {
  description?: string | null;
  title?: string | null;
  subtitle?: string | null;
  brandName?: string | null;
  category?: string | null;
  subcategory?: string | null;
  materials?: string | null;
  dimensions?: string | null;
  edition?: string | null;
};

const cleanText = (value?: string | null) => {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
};

const cleanMaterials = (value?: string | null) => {
  const cleaned = cleanText(value)
    .replace(/\s*•\s*/g, ", ")
    .replace(/\s*·\s*/g, ", ");

  return cleaned.replace(/\s*,\s*/g, ", ");
};

const cleanDimensions = (value?: string | null) => {
  if (!value) return "";

  const lines = value
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().includes(" in"));

  // Collapse "W 189 x D 102 x H 35 cm" → "189 × 102 × 35 cm"
  return lines
    .map((line) => {
      const parts = line.match(/[WDHLØ]?\s*(\d[\d.,]*)\s*/gi);
      const unit = line.match(/(cm|mm|m|inches|"|')\s*$/i)?.[1] || "";
      if (parts && parts.length >= 2) {
        const nums = parts.map((p) => p.replace(/^[A-Z]\s*/i, "").trim());
        return nums.join(" × ") + (unit ? ` ${unit}` : "");
      }
      return line;
    })
    .join(", ");
};

const singularize = (word: string) => {
  const w = word.trim();
  if (w.endsWith("ches") || w.endsWith("shes") || w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("ses") && !w.endsWith("sses")) return w.slice(0, -1);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
};

export const resolveCuratorPickDescription = ({
  description,
  title,
  subtitle,
  brandName,
  category,
  subcategory,
  materials,
  dimensions,
  edition,
}: CuratorPickDescriptionInput) => {
  const explicitDescription = cleanText(description);
  if (explicitDescription) return explicitDescription;

  const cleanTitle = cleanText(title);
  if (!cleanTitle) return null;

  const cleanBrandName = cleanText(brandName);
  const cleanSubtitle = cleanText(subtitle);
  const cleanCategory = cleanText(category);
  const cleanSubcategory = cleanText(subcategory);
  const cleanEditionValue = cleanText(edition);
  const cleanMaterialsValue = cleanMaterials(materials);
  const cleanDimensionsValue = cleanDimensions(dimensions);

  const rawLabel = (cleanSubcategory || cleanCategory || cleanSubtitle || "design piece").toLowerCase();
  const typeLabel = singularize(rawLabel);
  const lead = cleanBrandName && !cleanTitle.toLowerCase().includes(cleanBrandName.toLowerCase())
    ? `${cleanTitle} by ${cleanBrandName}`
    : cleanTitle;

  const detailParts = [
    cleanMaterialsValue ? `in ${cleanMaterialsValue}` : null,
    cleanEditionValue || null,
    cleanDimensionsValue ? `measuring ${cleanDimensionsValue}` : null,
  ].filter(Boolean);

  return `${lead} is a collectible ${typeLabel}${detailParts.length ? ` ${detailParts.join(", ")}` : ""}.`;
};