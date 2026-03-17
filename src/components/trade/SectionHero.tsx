import { cloudinaryUrl } from "@/lib/cloudinary";

const heroImages: Record<string, string> = {
  showroom: "bespoke-sofa_gxidtx",
  gallery: "living-room-hero_zxfcxl",
  quotes: "v1773726568/AffluencySG_081_dk5rn7",
  documents: "home-office-desk_g0ywv2",
  provenance: "details-console_hk6uxt",
};

interface SectionHeroProps {
  section: keyof typeof heroImages;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const SectionHero = ({ section, title, subtitle, children }: SectionHeroProps) => {
  const imageId = heroImages[section];
  const imageUrl = cloudinaryUrl(imageId, {
    width: 1600,
    height: 600,
    quality: "auto",
    crop: "fill",
    gravity: "auto",
  });

  return (
    <div className="relative rounded-lg overflow-hidden mb-6">
      <div className="absolute inset-0">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
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
