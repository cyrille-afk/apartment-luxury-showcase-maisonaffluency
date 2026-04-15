type CuratorPickDescriptionInput = {
  description?: string | null;
};

const cleanText = (value?: string | null) => {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
};

/**
 * Returns the explicit description if present, otherwise null.
 * No auto-generated fallback — real descriptions should come from the
 * Product Description Writer (AI edge function), not a template.
 */
export const resolveCuratorPickDescription = ({
  description,
}: CuratorPickDescriptionInput) => {
  const explicitDescription = cleanText(description);
  return explicitDescription || null;
};
