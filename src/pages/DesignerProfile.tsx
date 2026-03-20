import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, type Transition } from "framer-motion";
import { ArrowLeft, Instagram, ExternalLink, Quote } from "lucide-react";
import { getDesignerBySlug, getRelatedDesigners } from "@/lib/designerProfiles";
import { useMemo } from "react";

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
  const designer = slug ? getDesignerBySlug(slug) : undefined;

  if (!designer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-light text-foreground">Designer not found</h1>
          <Link to="/" className="text-primary underline underline-offset-4 text-sm">
            Return to gallery
          </Link>
        </div>
      </div>
    );
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
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm px-3 py-2 rounded-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </motion.div>

        {/* ── Hero: portrait + intro ───────────────────────────── */}
        <section className="relative">
          <div className="grid lg:grid-cols-2 min-h-[85vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden bg-muted"
            >
              <img
                src={designer.image}
                alt={name}
                className="w-full h-full object-cover"
                loading="eager"
              />
              {designer.logoUrl && (
                <img
                  src={designer.logoUrl}
                  alt={`${name} logo`}
                  className="absolute bottom-6 left-6 h-8 w-auto opacity-70"
                />
              )}
            </motion.div>

            <div className="flex flex-col justify-center px-8 lg:px-16 py-16 lg:py-24">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reveal}
                className="max-w-lg"
              >
                <p className="text-xs tracking-[0.25em] uppercase text-muted-foreground mb-4">
                  {designer.specialty}
                </p>
                <h1 className="text-4xl lg:text-5xl font-light leading-[1.1] mb-8 tracking-tight">
                  {name}
                </h1>
                <p className="text-base leading-relaxed text-muted-foreground mb-8 max-w-prose">
                  {designer.biography}
                </p>

                <div className="flex items-center gap-4">
                  {instagramLink && (
                    <a
                      href={instagramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Instagram className="w-4 h-4" />
                      Instagram
                    </a>
                  )}
                  {websiteLink && (
                    <a
                      href={websiteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Website
                    </a>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Philosophy ──────────────────────────────────────── */}
        {designer.philosophy && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={transition}
            className="py-24 lg:py-32 px-8 lg:px-16 bg-card"
          >
            <div className="max-w-3xl mx-auto text-center">
              <Quote className="w-6 h-6 text-accent mx-auto mb-6 opacity-60" />
              <blockquote className="text-xl lg:text-2xl font-light leading-relaxed italic text-card-foreground">
                &ldquo;{designer.philosophy}&rdquo;
              </blockquote>
              <p className="mt-6 text-sm text-muted-foreground tracking-wide">
                — {name}
              </p>
            </div>
          </motion.section>
        )}

        {/* ── Notable Works ───────────────────────────────────── */}
        {designer.notableWorks && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={transition}
            className="py-20 px-8 lg:px-16"
          >
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xs tracking-[0.25em] uppercase text-muted-foreground mb-6">
                Notable Works
              </h2>
              <p className="text-lg text-foreground leading-relaxed">
                {designer.notableWorks}
              </p>
            </div>
          </motion.section>
        )}

        {/* ── Selected Pieces ─────────────────────────────────── */}
        {designer.curatorPicks.length > 0 && (
          <section className="py-20 lg:py-28 px-8 lg:px-16 bg-card">
            <div className="max-w-7xl mx-auto">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={transition}
                className="text-xs tracking-[0.25em] uppercase text-muted-foreground mb-12"
              >
                Selected Pieces
              </motion.h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {designer.curatorPicks.map((pick, idx) => (
                  <motion.div
                    key={pick.title + idx}
                    initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{
                      duration: 0.6,
                      delay: Math.min(idx * 0.08, 0.4),
                      ease: [0.16, 1, 0.3, 1] as any,
                    }}
                    className="group"
                  >
                    {pick.image && (
                      <div className="aspect-[4/5] overflow-hidden bg-muted mb-4">
                        <img
                          src={pick.image}
                          alt={pick.title}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <h3 className="text-sm font-medium text-foreground">
                      {pick.title}
                    </h3>
                    {pick.subtitle && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {pick.subtitle}
                      </p>
                    )}
                    {pick.materials && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {pick.materials}
                      </p>
                    )}
                    {pick.dimensions && (
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {pick.dimensions}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Footer CTA ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={transition}
          className="py-20 px-8 lg:px-16 text-center"
        >
          <p className="text-muted-foreground text-sm mb-4">
            Interested in {name}?
          </p>
          <a
            href={`https://wa.me/6591393850?text=${encodeURIComponent(`Hi, I'd like to enquire about pieces by ${name}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-sm tracking-wide hover:opacity-90 transition-opacity active:scale-[0.97]"
          >
            Enquire via WhatsApp
          </a>
        </motion.section>
      </div>
    </>
  );
};

export default DesignerProfile;
