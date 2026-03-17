import { cloudinaryUrl } from "@/lib/cloudinary";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const heroDefaults: Record<string, { id: string; gravity?: "auto" | "face" | "center" | "north" | "south" | "east" | "west" }> = {
  showroom: { id: "bespoke-sofa_gxidtx" },
  gallery: { id: "v1773731066/Screen_Shot_2026-03-17_at_3.03.40_PM_b8dux9", gravity: "west" },
  quotes: { id: "v1773726568/AffluencySG_081_dk5rn7" },
  "quotes-admin": { id: "v1773652807/singapore-dollar_jaymbz" },
  documents: { id: "home-office-desk_g0ywv2" },
  provenance: { id: "details-console_hk6uxt" },
};

interface SectionHeroProps {
  section: keyof typeof heroDefaults;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

// Simple in-memory cache so we don't re-fetch every mount
let heroCache: Record<string, { image_url: string; gravity: string }> | null = null;
let heroCachePromise: Promise<void> | null = null;

function loadHeroOverrides() {
  if (heroCache) return Promise.resolve();
  if (heroCachePromise) return heroCachePromise;
  heroCachePromise = Promise.resolve(
    supabase
      .from("section_heroes")
      .select("section_key, image_url, gravity")
  ).then(({ data }) => {
      heroCache = {};
      if (data) {
        data.forEach((r: any) => {
          heroCache![r.section_key] = { image_url: r.image_url, gravity: r.gravity };
        });
      }
    }).catch(() => {
      heroCache = {};
    });
  return heroCachePromise;
}

const SectionHero = ({ section, title, subtitle, children }: SectionHeroProps) => {
  const [override, setOverride] = useState<{ image_url: string; gravity: string } | null>(
    heroCache?.[section] ?? null
  );
  const [loaded, setLoaded] = useState(!!heroCache);

  useEffect(() => {
    if (heroCache) {
      setOverride(heroCache[section] ?? null);
      setLoaded(true);
      return;
    }
    loadHeroOverrides().then(() => {
      setOverride(heroCache?.[section] ?? null);
      setLoaded(true);
    });
  }, [section]);

  const entry = heroDefaults[section] || heroDefaults.gallery;

  // Use DB override if available, otherwise Cloudinary default
  const imageUrl = override?.image_url || cloudinaryUrl(entry.id, {
    width: 1600,
    height: 600,
    quality: "auto",
    crop: "fill",
    gravity: entry.gravity || "auto",
  });

  const effectiveGravity = override ? override.gravity : (entry.gravity || "auto");

  const objectPositionClass =
    effectiveGravity === "east" ? "object-right" :
    effectiveGravity === "west" ? "object-left" :
    effectiveGravity === "north" ? "object-top" :
    effectiveGravity === "south" ? "object-bottom" :
    "object-center";

  return (
    <div className="relative rounded-lg overflow-hidden mb-6">
      <div className="absolute inset-0">
        <img
          src={imageUrl}
          alt={title}
          className={`w-full h-full object-cover ${objectPositionClass}`}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/50 via-foreground/30 to-foreground/10" />
      </div>
      <div className="relative px-3 py-8 md:px-4 md:py-12 lg:py-16 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-2xl text-background mb-1">{title}</h1>
          {subtitle && (
            <p className="font-body text-xs md:text-sm text-background/70">{subtitle}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-2 md:gap-3 flex-wrap">{children}</div>}
      </div>
    </div>
  );
};

// Allow cache invalidation from HeroManager after upload
export function invalidateHeroCache() {
  heroCache = null;
  heroCachePromise = null;
}

export default SectionHero;
