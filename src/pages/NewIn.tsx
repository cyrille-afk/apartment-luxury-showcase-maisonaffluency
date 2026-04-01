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

const PORTRAIT_IMAGE = "https://s30964.pcdn.co/introspective-magazine/wp-content/uploads/2019/12/hero-2-1024x512.jpg";

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

      {/* Portrait + Biography — side by side */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 pt-10 md:pt-16 pb-8 md:pb-12 mt-[96px]">
        <div className="flex flex-col md:flex-row gap-8 md:gap-14 items-start">
          {/* Portrait */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="w-full md:w-[38%] flex-shrink-0"
          >
            <div className="aspect-[4/5] overflow-hidden rounded-sm bg-muted">
              <img
                src={PORTRAIT_IMAGE}
                alt="Pierre Bonnefille in his atelier"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          {/* Name + Bio + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: 0.2 }}
            className="flex-1 flex flex-col justify-start"
          >
            <span className="font-body text-[10px] uppercase tracking-[0.35em] text-muted-foreground mb-2">
              New In
            </span>
            <h1 className="font-brand text-3xl md:text-4xl lg:text-5xl text-foreground tracking-wide mb-8">
              Pierre Bonnefille
            </h1>

            <p className="font-body text-sm md:text-base leading-relaxed text-foreground/85 text-left">
              {BIOGRAPHY}
            </p>

            <div className="mt-10">
              <Link
                to={`/designers/${DESIGNER_SLUG}`}
                className="inline-flex items-center gap-3 font-body text-xs uppercase tracking-[0.25em] text-foreground hover:text-primary transition-colors duration-300"
              >
                View The Full Portrait
                <span className="w-8 h-px bg-foreground" />
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Separator */}
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="border-t border-border/40" />
      </div>

      {/* Curators' Picks */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 pt-8 md:pt-12 pb-16 md:pb-24">
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
