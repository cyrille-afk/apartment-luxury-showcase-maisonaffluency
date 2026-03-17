import { cloudinaryUrl } from "@/lib/cloudinary";

const heroImages: Record<string, { id: string; gravity?: "auto" | "face" | "center" | "north" | "south" | "east" | "west" }> = {
  showroom: { id: "bespoke-sofa_gxidtx" },
  gallery: { id: "v1773731066/Screen_Shot_2026-03-17_at_3.03.40_PM_b8dux9", gravity: "center" },
  quotes: { id: "v1773726568/AffluencySG_081_dk5rn7" },
  "quotes-admin": { id: "v1773652807/singapore-dollar_jaymbz" },
  documents: { id: "home-office-desk_g0ywv2" },
  provenance: { id: "details-console_hk6uxt" },
};

interface SectionHeroProps {
  section: keyof typeof heroImages;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const SectionHero = ({ section, title, subtitle, children }: SectionHeroProps) => {
  const entry = heroImages[section];
  const imageUrl = cloudinaryUrl(entry.id, {
    width: 1600,
    height: 600,
    quality: "auto",
    crop: "fill",
    gravity: entry.gravity || "auto",
  });

  return (
    <div className="relative rounded-lg overflow-hidden mb-6">
      <div className="absolute inset-0">
        <img
          src={imageUrl}
          alt={title}
          className={`w-full h-full object-cover ${entry.gravity === "east" ? "object-right" : entry.gravity === "west" ? "object-left" : "object-center"}`}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/50 via-foreground/30 to-foreground/10" />
      </div>
      <div className="relative px-4 py-8 md:px-6 md:py-12 lg:py-16 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
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

export default SectionHero;
