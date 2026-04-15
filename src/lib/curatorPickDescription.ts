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

  return value
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().includes(" in"))
    .join(", ");
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

  const typeLabel = (cleanSubcategory || cleanCategory || cleanSubtitle || "design piece").toLowerCase();
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