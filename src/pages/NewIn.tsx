import { lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion, type Transition } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useDesigner, useDesignerPicks } from "@/hooks/useDesigner";
import { cloudinaryUrl } from "@/lib/cloudinary";

const Footer = lazy(() => import("@/components/Footer"));

const DESIGNER_SLUG = "pierre-bonnefille";

const BIOGRAPHY = `Pierre Bonnefille is a French artist, painter, designer and 'Maître d'Art' — a title awarded by the French Ministry of Culture to masters of exceptional craft. A graduate of both the École Boulle and the École Nationale Supérieure des Arts Décoratifs in Paris, he has spent more than three decades creating his own materials, mixing pigments with sand and ground rock, sometimes applying gold or silver leaf on top, other times stamping the surface with fabric to leave behind what he calls a 'textile fossil', his signature textures.`;

const HERO_IMAGE = "https://s30964.pcdn.co/introspective-magazine/wp-content/uploads/2019/12/hero-2-1024x512.jpg";

const transition: Transition = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };

const NewIn = () => {
  const { data: designer } = useDesigner(DESIGNER_SLUG);
  const { data: picks = [] } = useDesignerPicks(designer?.id, { publicOnly: true });

  return (
    <>
      <Helmet>
        <title>New In — Pierre Bonnefille | Maison Affluency</title>
        <meta name="description" content="Discover Pierre Bonnefille — French artist, painter, designer and Maître d'Art. Explore his curated collection of sculptural works at Maison Affluency." />
      </Helmet>

      <Navigation />

      {/* Hero */}
      <section className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden mt-[96px]">
        <motion.img
          src={HERO_IMAGE}
          alt="Pierre Bonnefille — Workspace"
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-6 md:px-20 pb-10 md:pb-16">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: 0.3 }}
            className="inline-block font-body text-[10px] uppercase tracking-[0.35em] text-white/70 mb-3"
          >
            New In
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: 0.45 }}
            className="font-brand text-3xl md:text-5xl lg:text-6xl text-white tracking-wide"
          >
            Pierre Bonnefille
          </motion.h1>
        </div>
      </section>

      {/* Biography + CTA */}
      <section className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={transition}
          className="font-body text-base md:text-lg leading-relaxed text-foreground/85"
        >
          {BIOGRAPHY}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ ...transition, delay: 0.15 }}
          className="mt-10"
        >
          <Link
            to={`/designers/${DESIGNER_SLUG}`}
            className="inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.25em] px-7 py-3 rounded-full border border-foreground/20 text-foreground hover:bg-foreground hover:text-background transition-all duration-300"
          >
            View The Full Portrait
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </section>

      {/* Separator */}
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="border-t border-border/40" />
      </div>

      {/* Curators' Picks */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={transition}
          className="flex items-center gap-4 mb-10"
        >
          <span className="inline-flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border border-[hsl(var(--gold))] text-foreground bg-[hsl(var(--gold)/0.06)]">
            Curators' Picks
          </span>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {picks.map((pick, i) => (
            <motion.div
              key={pick.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ ...transition, delay: i * 0.06 }}
              className="group"
            >
              <div className="aspect-[3/4] overflow-hidden rounded-sm bg-muted">
                <img
                  src={pick.image_url}
                  alt={pick.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="mt-2.5 space-y-0.5">
                <h3 className="font-body text-xs uppercase tracking-wider text-foreground truncate">
                  {pick.title}
                </h3>
                {pick.subtitle && (
                  <p className="font-body text-[11px] text-muted-foreground truncate">
                    {pick.subtitle}
                  </p>
                )}
                {pick.materials && (
                  <p className="font-body text-[10px] text-muted-foreground/70 truncate">
                    {pick.materials}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Separator */}
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="border-t border-border/40" />
      </div>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
};

export default NewIn;
