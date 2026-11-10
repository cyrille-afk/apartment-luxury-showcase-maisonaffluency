import { isSupportedLogoUrl } from "@/lib/studioLogoFormat";
import { trimLogoUrl } from "@/lib/cloudinaryLogo";

export interface QuoteFolderBranding {
  id: string;
  studio_logo_url: string | null;
  studio_name: string | null;
}

export function resolveQuoteBranding(
  folder: QuoteFolderBranding | null | undefined,
  studio: { logo_url: string | null; display_name: string | null; name: string } | null,
  hidePlatform: boolean,
) {
  const candidate = folder?.studio_logo_url?.trim() || studio?.logo_url?.trim() || null;
  const logoUrl = candidate && isSupportedLogoUrl(candidate) ? trimLogoUrl(candidate) : null;
  return {
    logoUrl,
    studioName: folder?.studio_name?.trim() || studio?.display_name?.trim() || studio?.name?.trim() || "",
    showPlatform: !logoUrl && !hidePlatform,
    canHidePlatform: !logoUrl,
  };
}

export function quoteBrandingStorageKey(userId: string, quoteId: string) {
  return `ma:quote-header:v1:${userId}:${quoteId}`;
}