import { cloudinaryUrl } from "@/lib/cloudinary";

const heroImages: Record<string, string> = {
  showroom: "bespoke-sofa_gxidtx",
  gallery: "living-room-hero_zxfcxl",
  quotes: "details-console_hk6uxt",
  documents: "home-office-desk_g0ywv2",
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
          className="w-full h-full object-cover opacity-40"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/50 via-foreground/30 to-foreground/10" />
      </div>
      <div className="relative px-6 py-12 md:py-16 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-background mb-1">{title}</h1>
          {subtitle && (
            <p className="font-body text-sm text-background/70">{subtitle}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    </div>
  );
};

export default SectionHero;
