export const STUDIO_SETUP_PATH = "/settings/studio";
export const isStudioSettingsPath = (path: string) => [STUDIO_SETUP_PATH, "/trade/settings/studio"].includes(path.replace(/\/+$/, ""));
export function hasRealStudioName(name: string | null | undefined) {
  return !!name?.trim() && !/^(my|your|default|new)\s+studio$/i.test(name.trim()) && !/^studio$/i.test(name.trim());
}
export function hasSavedStudioIdentity(studio: { name?: string; display_name?: string | null; logo_url?: string | null; pdf_cover_theme?: unknown } | null) {
  const theme = studio?.pdf_cover_theme as Record<string, unknown> | undefined;
  return !!studio && hasRealStudioName(studio.name) && !!studio.display_name?.trim() && (!studio.logo_url?.trim() || /^https:\/\//i.test(studio.logo_url.trim())) && ["background", "accent", "text"].every(key => typeof theme?.[key] === "string" && /^#[0-9a-f]{6}$/i.test(String(theme[key])));
}
export const studioSetupComplete = (studio: Parameters<typeof hasSavedStudioIdentity>[0], projectCount: number) => hasSavedStudioIdentity(studio) && projectCount > 0;
