import { useParams, Link, Navigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, type Transition } from "framer-motion";
import { ArrowLeft, Instagram, ExternalLink, Quote } from "lucide-react";
import { useDesigner, useDesignerPicks, useRelatedDesigners, useGroupedDesignerPicks } from "@/hooks/useDesigner";
import ShareMenu from "@/components/ShareMenu";
import { buildDesignerOgUrl } from "@/lib/whatsapp-share";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import EditorialBiography from "@/components/EditorialBiography";

const transition: Transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] };
const reveal: Transition = { ...transition, delay: 0.15 };

function displayName(name: string): string {
  if (name.includes(" - ")) {
    const [brand, ...rest] = name.split(" - ");
    return `${brand.trim()} — ${rest.join(" - ").trim()}`;
  }
  return name;
}

const DesignerProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const fromSection = searchParams.get("from"); // "new-in" | "ateliers" | "designers" | null
  const fromJournal = searchParams.get("from_journal"); // journal slug
  const { data: designer, isLoading } = useDesigner(slug);
  const isParentBrand = !!(designer?.founder && designer.founder === designer.name);
  const { data: ownPicks = [] } = useDesignerPicks(designer?.id, { publicOnly: true });
  const { data: groupedPicks = [] } = useGroupedDesignerPicks(
    isParentBrand ? designer : undefined,
    { publicOnly: true }
  );
  const picks = isParentBrand && groupedPicks.length > 0 ? groupedPicks : ownPicks;
  const { data: related = [] } = useRelatedDesigners(slug, designer?.source);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!designer) {
    return <Navigate to="/" replace />;
  }

  const instagramLink = designer.links.find((l) => l.type === "Instagram")?.url;
  const websiteLink = designer.links.find((l) => l.type === "Website")?.url;
  const name = displayName(designer.name);
  const firstLetter = designer.name.charAt(0).toUpperCase();
  const backTo = fromJournal
    ? `/journal/${fromJournal}`
    : fromSection === "new-in"
      ? "/new-in"
      : `/designers?letter=${firstLetter}`;
  const backLabel = fromJournal
    ? "Article"
    : fromSection === "new-in"
      ? "New In"
      : "Designers";
  const designerOgUrl = buildDesignerOgUrl(designer.name);

  return (
    <>
      <Helmet>
        <title>{name} — Maison Affluency</title>
        <meta name="description" content={designer.biography.slice(0, 155)} />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={transition}
          className="fixed top-6 left-6 z-50"
        >
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm px-3 py-2 rounded-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
        </motion.div>

        {/* Hero */}
        <section className="relative h-[60vh] min-h-[420px] overflow-hidden">
          {(designer.hero_image_url || designer.image_url) && (() => {
            const raw = designer.hero_image_url || designer.image_url;
            const optimised = optimizeImageUrl(raw, "w_1920,c_fill,q_auto:good,f_auto");
            return (
              <motion.img
                src={optimised}
                alt={name}
                initial={{ scale: 1.08, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            );
          })()}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          {/* Mobile share icon */}
          <div className="absolute top-3 right-3 z-20 md:hidden">
            <ShareMenu
              url={designerOgUrl}
              message={`${designer.name} — Maison Affluency: ${designerOgUrl}`}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white/90 hover:bg-black/60 transition-colors"
              iconSize="w-4 h-4"
              showLabel={false}
            />
          </div>
          {/* Desktop share icon */}
          <div className="absolute bottom-4 right-6 md:right-16 z-20 hidden md:block">
            <ShareMenu
              url={designerOgUrl}
              message={`${designer.name} — Maison Affluency: ${designerOgUrl}`}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white/90 hover:bg-black/60 transition-colors"
              iconSize="w-4 h-4"
              showLabel={false}
            />
          </div>
          {designer.hero_photo_credit && (
            <p className="absolute bottom-2 right-6 md:right-16 text-[10px] uppercase tracking-[0.15em] text-white/60 z-10">
              Photo: {designer.hero_photo_credit}
            </p>
          )}
          <div className="absolute bottom-0 left-0 right-0 px-6 md:px-16 pb-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={reveal}>
              <h1 className="font-display text-3xl md:text-5xl tracking-wide">{name}</h1>
              {designer.specialty && (
                <p className="font-body text-sm md:text-base text-muted-foreground mt-2 max-w-xl">
                  {designer.specialty}
                </p>
              )}
            </motion.div>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 md:px-16 pt-8 md:pt-10 pb-16 space-y-20">
          {/* Biography */}
          {designer.biography && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={transition}
            >
              <h2 className="font-display text-lg tracking-widest uppercase text-muted-foreground mb-6">
                Biography
              </h2>
              <EditorialBiography
                biography={designer.biography}
                biographyImages={designer.biography_images ?? []}
                designerName={designer.name}
              />
              <div className="flex items-center gap-4 mt-6">
                {instagramLink && (
                  <a href={instagramLink} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {websiteLink && (
                  <a href={websiteLink} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>
            </motion.section>
          )}

          {/* Philosophy */}
          {designer.philosophy && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={transition}
            >
              <div className="border-l-2 border-primary/30 pl-8 py-4">
                <Quote className="w-6 h-6 text-primary/40 mb-3" />
              <blockquote className="font-display text-[13px] sm:text-base md:text-2xl md:text-center italic leading-relaxed" /* philosophy-split */>
                  {(() => {
                    const text = designer.philosophy;
                    // Split attribution (— Author...) from the quote body
                    const attrMatch = text.match(/^([\s\S]*?)\s*(—\s*.+)$/);
                    const quoteBody = attrMatch ? attrMatch[1] : text;
                    const attribution = attrMatch ? attrMatch[2] : null;

                    // Render quote body with line break support
                    const lines = quoteBody.split('\n').filter(Boolean);
                    return (
                      <span className="text-foreground/80">
                        "{lines.map((line, i) => (
                          <span key={i}>
                            {line.trim()}
                            {i < lines.length - 1 && <br />}
                          </span>
                        ))}"
                        {attribution && (
                          <span className="block text-muted-foreground/60 text-[11px] sm:text-sm md:text-base not-italic mt-3">
                            {attribution}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </blockquote>
              </div>
            </motion.section>
          )}

          {/* Curator's Picks */}
          {picks.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={transition}
            >
              <h2 className="font-display text-lg tracking-widest uppercase text-muted-foreground mb-8">
                Curators' Picks
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {picks.map((pick) => (
                  <div key={pick.id} className="group">
                    <div className="aspect-[4/5] bg-muted/20 rounded-lg overflow-hidden mb-3">
                      <img
                        src={pick.image_url}
                        alt={pick.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <h3 className="font-display text-sm tracking-wide">{pick.title}</h3>
                    {pick.subtitle && (
                      <p className="font-body text-xs text-muted-foreground mt-0.5">{pick.subtitle}</p>
                    )}
                    {pick.materials && (
                      <p className="font-body text-[10px] text-muted-foreground/70 mt-1 line-clamp-2">
                        {pick.materials}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Related Designers */}
          {related.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={transition}
            >
              <h2 className="font-display text-lg tracking-widest uppercase text-muted-foreground mb-8">
                Related Ateliers
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/designer/${r.slug}`}
                    className="group block"
                  >
                    <div className="aspect-[3/4] bg-muted/20 rounded-lg overflow-hidden mb-3">
                      {r.image_url && (
                        <img
                          src={r.image_url}
                          alt={r.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <p className="font-display text-sm tracking-wide">{displayName(r.name)}</p>
                    <p className="font-body text-xs text-muted-foreground mt-0.5">{r.specialty}</p>
                  </Link>
                ))}
              </div>
            </motion.section>
          )}
        </div>
      </div>
    </>
  );
};

export default DesignerProfile;
