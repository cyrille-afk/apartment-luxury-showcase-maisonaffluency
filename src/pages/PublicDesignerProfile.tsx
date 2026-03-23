import { useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Instagram, ExternalLink, Quote, Package } from "lucide-react";
import { useDesigner, useDesignerPicks, useGroupedDesignerPicks } from "@/hooks/useDesigner";
import type { AttributedCuratorPick, DesignerCuratorPick } from "@/hooks/useDesigner";
import { cn } from "@/lib/utils";
import EditorialBiography from "@/components/EditorialBiography";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };
const reveal = { ...transition, delay: 0.15 };

function responsiveCloudinaryUrl(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com")) return url;
  const replaced = url.replace(/w_\d+/, `w_${width}`);
  if (replaced !== url) return replaced;
  return url.replace("/upload/", `/upload/w_${width},c_fill,q_auto,f_auto/`);
}

function pickSrcSet(url: string): string {
  return [300, 400, 600, 800].map(w => `${responsiveCloudinaryUrl(url, w)} ${w}w`).join(", ");
}

function displayName(name: string): string {
  if (name.includes(" - ")) {
    const [brand, ...rest] = name.split(" - ");
    return `${brand.trim()} — ${rest.join(" - ").trim()}`;
  }
  return name;
}

const PublicDesignerProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: designer, isLoading } = useDesigner(slug);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [slug]);

  // Atelier detection
  const isParentBrand = designer?.founder === designer?.name;
  const { data: groupedPicks = [] } = useGroupedDesignerPicks(
    isParentBrand ? designer : undefined
  );
  const { data: ownPicks = [] } = useDesignerPicks(designer?.id);
  const picks = groupedPicks.length > 0 ? groupedPicks : ownPicks;
  

  const isDesignerProfile = designer?.founder && designer.founder !== designer.name;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!designer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-light text-foreground">Designer not found</h1>
          <Link to="/designers" className="text-primary underline underline-offset-4 text-sm">
            Back to directory
          </Link>
        </div>
      </div>
    );
  }

  const name = displayName(designer.name);
  const instagramLink = designer.links.find((l) => l.type === "Instagram")?.url;
  const websiteLink = designer.links.find((l) => l.type === "Website")?.url;
  const heroImage = designer.hero_image_url || designer.image_url;
  const heroAspect = isDesignerProfile ? "aspect-[3/4]" : "aspect-[16/9]";
  const isGrouped = groupedPicks.length > 0;

  return (
    <>
      <Helmet>
        <title>{name} — Maison Affluency</title>
        <meta name="description" content={designer.biography?.slice(0, 155) || designer.specialty} />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="max-w-5xl mx-auto px-6 md:px-12 pt-28 pb-20 space-y-12">
          {/* Back */}
          <Link
            to="/designers"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Ateliers & Designers
          </Link>

          {/* Hero + About */}
          <div className={cn("flex flex-col gap-6", isDesignerProfile && "md:flex-row")}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={transition}
              className={cn("relative rounded-xl overflow-hidden shrink-0", isDesignerProfile && "md:w-1/2")}
            >
              <div className={heroAspect}>
                {heroImage && (
                  <img
                    src={heroImage}
                    alt={name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </div>

              {/* Founder badge for sub-designers */}
              {designer.founder && designer.founder !== designer.name && (
                <Link
                  to={`/designers/${designer.founder.toLowerCase().replace(/\s+/g, '-')}`}
                  className="absolute top-4 left-4 md:top-6 md:left-6 z-10 w-16 h-16 md:w-20 md:h-20 bg-black text-white font-display text-[7px] md:text-[9px] tracking-[0.12em] uppercase hover:bg-black/80 transition-colors shadow-lg flex items-center justify-center text-center leading-tight overflow-hidden p-1"
                >
                  {designer.founder}
                </Link>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reveal}>
                  <h1 className="font-display text-2xl md:text-4xl tracking-wide text-white drop-shadow-md">
                    {name}
                  </h1>
                  {designer.specialty && (
                    <p className="font-body text-sm md:text-base text-white/80 mt-1.5 font-medium tracking-wide">
                      {designer.specialty}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-4">
                    {instagramLink && (
                      <a href={instagramLink} target="_blank" rel="noopener noreferrer"
                        className="text-white/60 hover:text-white transition-colors">
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                    {websiteLink && (
                      <a href={websiteLink} target="_blank" rel="noopener noreferrer"
                        className="text-white/60 hover:text-white transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {designer.biography && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transition, delay: 0.2 }}
                className={cn(isDesignerProfile ? "md:w-1/2 flex flex-col justify-center" : "flex flex-col")}
              >
                {designer.philosophy && (
                  <blockquote className="font-display text-lg md:text-xl italic leading-snug text-foreground mb-6">
                    "{designer.philosophy}"
                  </blockquote>
                )}
                {!isDesignerProfile && (
                  <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
                    About
                  </h2>
                )}
                <EditorialBiography
                  biography={designer.biography}
                  biographyImages={designer.biography_images}
                  pickImages={picks.slice(0, 3).map((p) => p.image_url)}
                  designerName={designer.name}
                />
              </motion.div>
            )}
          </div>

          {/* Curator's Picks */}
          {picks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.25 }}
            >
              <h2 className="font-display text-xs tracking-[0.2em] uppercase text-foreground mb-6">
                Curators' Picks
              </h2>
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
                {picks.map((pick) => {
                  const ap = pick as AttributedCuratorPick;
                  const designerLabel = isGrouped && ap.designer_name && ap.designer_name !== designer.name
                    ? ap.designer_name : undefined;
                  const designerSlug = isGrouped && ap.designer_slug ? ap.designer_slug : undefined;

                  return (
                    <div key={pick.id} className="group">
                      <div className="aspect-[4/5] bg-muted/20 rounded-lg overflow-hidden mb-2">
                        <img
                          src={responsiveCloudinaryUrl(pick.image_url, 600)}
                          srcSet={pickSrcSet(pick.image_url)}
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                          alt={pick.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <h3 className="font-display text-[11px] md:text-xs tracking-wide leading-snug">
                        {pick.title}
                      </h3>
                      {designerLabel && designerSlug ? (
                        <Link
                          to={`/designers/${designerSlug}`}
                          className="block font-body text-[10px] md:text-[11px] text-primary/70 hover:text-primary underline underline-offset-2 leading-tight mt-0.5"
                        >
                          {designerLabel}
                        </Link>
                      ) : designerLabel ? (
                        <span className="block font-body text-[10px] md:text-[11px] text-muted-foreground leading-tight mt-0.5">
                          {designerLabel}
                        </span>
                      ) : null}
                      {pick.subtitle && (
                        <p className="font-body text-[10px] text-muted-foreground leading-tight">{pick.subtitle}</p>
                      )}
                      {pick.materials && (
                        <p className="font-body text-[9px] text-muted-foreground/60 mt-0.5 line-clamp-2 leading-relaxed">
                          {pick.materials}
                        </p>
                      )}
                      {pick.dimensions && (
                        <p className="font-body text-[9px] text-muted-foreground/50 mt-0.5">
                          {pick.dimensions.split('\n').filter((line: string) => !line.toLowerCase().includes(' in')).join('\n')}
                        </p>
                      )}
                      {pick.edition && (
                        <p className="font-body text-[9px] text-primary/70 mt-0.5 italic">
                          {pick.edition}
                        </p>
                      )}
                      {/* No prices on public side — "Price on request" philosophy */}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {picks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/10 rounded-xl">
              <Package className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="font-body text-sm text-muted-foreground">
                Curators' picks coming soon
              </p>
            </div>
          )}

          {/* Related Designers */}
          {related.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={transition}
            >
              <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">
                Related Ateliers
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/designers/${r.slug}`}
                    className="group block"
                  >
                    <div className="aspect-[3/4] bg-muted/20 rounded-lg overflow-hidden mb-2">
                      {r.image_url && (
                        <img
                          src={r.image_url}
                          alt={r.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <p className="font-display text-xs tracking-wide">{displayName(r.name)}</p>
                    <p className="font-body text-[10px] text-muted-foreground mt-0.5">{r.specialty}</p>
                  </Link>
                ))}
              </div>
            </motion.section>
          )}

          {/* Enquiry CTA */}
          <div className="text-center py-8">
            <p className="font-body text-sm text-muted-foreground mb-4">
              Interested in pieces from this collection?
            </p>
            <Link
              to="/trade/program"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background font-display text-xs tracking-[0.15em] uppercase rounded-full hover:bg-foreground/90 transition-colors"
            >
              Join Trade Program
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default PublicDesignerProfile;
