import { useParams, Link, Navigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, type Transition } from "framer-motion";
import { ArrowLeft, Instagram, ExternalLink, Quote } from "lucide-react";
import { useDesigner, useDesignerPicks, useRelatedDesigners } from "@/hooks/useDesigner";

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
  const fromSection = searchParams.get("from"); // "ateliers" | "designers" | null
  const { data: designer, isLoading } = useDesigner(slug);
  const { data: picks = [] } = useDesignerPicks(designer?.id, { publicOnly: true });
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
            to={(() => {
              if (fromSection === "ateliers") {
                const expand = designer?.founder ? `?expand=${encodeURIComponent(designer.founder)}` : "";
                return `/${expand}#brands`;
              }
              if (fromSection === "designers") return "/#designers";
              if (designer?.founder) {
                return `/?expand=${encodeURIComponent(designer.founder)}#brands`;
              }
              return "/#designers";
            })()}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm px-3 py-2 rounded-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {(() => {
              if (fromSection === "ateliers") return "Ateliers";
              if (fromSection === "designers") return "Designers";
              return designer?.founder ? "Ateliers" : "Designers";
            })()}
          </Link>
        </motion.div>

        {/* Hero */}
        <section className="relative h-[60vh] min-h-[420px] overflow-hidden">
          {(designer.hero_image_url || designer.image_url) && (
            <motion.img
              src={designer.hero_image_url || designer.image_url}
              alt={name}
              initial={{ scale: 1.08, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
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
              <p className="font-body text-base md:text-lg leading-relaxed text-foreground/90 max-w-3xl">
                {designer.biography.split(/(\u2018[^\u2019]*\u2019|'[^']*')/g).map((segment, i) => {
                  const isCurly = segment.startsWith("\u2018") && segment.endsWith("\u2019");
                  const isStraight = segment.startsWith("'") && segment.endsWith("'") && segment.length > 2;
                  if (isCurly || isStraight) {
                    return (
                      <span key={i} className="italic text-foreground font-medium">
                        {segment}
                      </span>
                    );
                  }
                  return <span key={i}>{segment}</span>;
                })}
              </p>
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
                <blockquote className="font-display text-[13px] sm:text-base md:text-2xl md:text-center italic leading-relaxed">
                  {(() => {
                    const match = designer.philosophy.match(/^(.*?)(\([^)]+\))(.*)$/s);
                    if (match) {
                      return (
                        <>
                          "<span className="text-foreground">{match[1].trimEnd()}</span>{' '}
                          <span className="text-muted-foreground/60">{match[2]}</span>
                          <span className="text-foreground">{match[3]}</span>"
                        </>
                      );
                    }
                    return <span className="text-foreground/80">"{designer.philosophy}"</span>;
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
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
