import { useState } from "react";

export type StudioBranding = {
  name?: string | null;
  display_name?: string | null;
  logo_url?: string | null;
  primary_brand_font?: string | null;
};

export function StudioBrand({ studio, className = "" }: { studio: StudioBranding | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const name = studio?.display_name?.trim() || studio?.name?.trim() || "Your Studio";
  const logo = studio?.logo_url?.trim();
  return logo && failedUrl !== logo ? (
    <img src={logo} onError={() => setFailedUrl(logo)} alt={name} className={`max-h-10 max-w-44 object-contain ${className}`} />
  ) : (
    <span className={`font-serif text-base uppercase tracking-widest text-foreground ${className}`}>{name}</span>
  );
}