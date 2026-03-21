import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Instagram, ExternalLink, Quote, Package, FileText } from "lucide-react";
import { getDesignerBySlug, getRelatedDesigners } from "@/lib/designerProfiles";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { Badge } from "@/components/ui/badge";

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };
const reveal = { ...transition, delay: 0.15 };

function displayName(name: string): string {
  if (name.includes(" - ")) {
    const [brand, ...rest] = name.split(" - ");
    return `${brand.trim()} — ${rest.join(" - ").trim()}`;
  }
  return name;
}

const TradeAtelierProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const designer = slug ? getDesignerBySlug(slug) : undefined;

  const allProducts = useMemo(() => getAllTradeProducts(), []);

  const brandProducts = useMemo(() => {
    if (!designer) return [];
    return allProducts.filter(
      (p) => p.brand_name.toLowerCase() === designer.name.toLowerCase()
    );
  }, [designer, allProducts]);

  const categories = useMemo(() => {
    const set = new Set(brandProducts.map((p) => p.category).filter(Boolean));
    return [...set];
  }, [brandProducts]);

  const related = useMemo(
    () => (designer ? getRelatedDesigners(designer, 3) : []),
    [designer]
  );

  if (!designer) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h1 className="text-2xl font-light text-foreground mb-4">Atelier not found</h1>
        <button
          onClick={() => navigate("/trade/designers")}
          className="text-primary underline underline-offset-4 text-sm"
        >
          Back to directory
        </button>
      </div>
    );
  }

  const name = displayName(designer.name);
  const instagramLink = designer.links.find((l) => l.type === "Instagram")?.url;
  const websiteLink = designer.links.find((l) => l.type === "Website")?.url;

  return (
    <>
      <Helmet>
        <title>{name} — Maison Affluency Trade</title>
        <meta name="description" content={designer.biography.slice(0, 155)} />
      </Helmet>

      <div className="space-y-0">
        {/* Back nav */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={transition}
          className="mb-6"
        >
          <button
            onClick={() => navigate("/trade/designers")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Ateliers
          </button>
        </motion.div>

        {/* Hero section */}
        <section className="grid lg:grid-cols-2 gap-0 rounded-lg overflow-hidden border border-border bg-background">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative aspect-[4/3] lg:aspect-auto overflow-hidden bg-muted"
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
                className="absolute bottom-4 left-4 h-7 w-auto opacity-70"
              />
            )}
            {designer.source === "collectible" && (
              <span className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm text-primary-foreground font-body text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                Collectible Design
              </span>
            )}
          </motion.div>

          <div className="flex flex-col justify-center p-6 lg:p-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reveal}
            >
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-3">
                {designer.specialty}
              </p>
              <h1 className="font-display text-2xl lg:text-3xl text-foreground tracking-wide mb-4">
                {name}
              </h1>
              <p className="font-body text-sm leading-relaxed text-muted-foreground mb-5 max-w-prose">
                {designer.biography}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-4 mb-5">
                {brandProducts.length > 0 && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Package className="w-3.5 h-3.5" />
                    <span className="font-body text-xs">
                      {brandProducts.length} {brandProducts.length === 1 ? "piece" : "pieces"}
                    </span>
                  </div>
                )}
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {categories.slice(0, 4).map((cat) => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className="text-[9px] uppercase tracking-wider px-1.5 py-0"
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Links */}
              <div className="flex items-center gap-4">
                {instagramLink && (
                  <a
                    href={instagramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    Instagram
                  </a>
                )}
                {websiteLink && (
                  <a
                    href={websiteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Website
                  </a>
                )}
                <button
                  onClick={() =>
                    navigate(
                      `/trade/showroom?tab=grid&designer=${encodeURIComponent(designer.name)}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <FileText className="w-3.5 h-3.5" />
                  View in Showroom
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Philosophy */}
        {designer.philosophy && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={transition}
            className="py-12 px-6 lg:px-10 bg-card rounded-lg border border-border mt-6"
          >
            <div className="max-w-2xl mx-auto text-center">
              <Quote className="w-5 h-5 text-accent mx-auto mb-4 opacity-60" />
              <blockquote className="font-display text-lg lg:text-xl font-light leading-relaxed italic text-card-foreground">
                &ldquo;{designer.philosophy}&rdquo;
              </blockquote>
              <p className="mt-4 font-body text-[10px] text-muted-foreground tracking-wider uppercase">
                — {name}
              </p>
            </div>
          </motion.section>
        )}

        {/* Notable Works */}
        {designer.notableWorks && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={transition}
            className="py-10 mt-6"
          >
            <h2 className="font-body text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-4">
              Notable Works
            </h2>
            <p className="font-body text-sm text-foreground leading-relaxed max-w-3xl">
              {designer.notableWorks}
            </p>
          </motion.section>
        )}

        {/* Curator's Picks grid */}
        {designer.curatorPicks.length > 0 && (
          <section className="py-10 mt-2">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={transition}
              className="font-body text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-8"
            >
              Curator's Selection · {designer.curatorPicks.length} pieces
            </motion.h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {designer.curatorPicks.map((pick, idx) => (
                <motion.div
                  key={pick.title + idx}
                  initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{
                    duration: 0.6,
                    delay: Math.min(idx * 0.06, 0.3),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="group"
                >
                  {pick.image && (
                    <div className="aspect-[4/5] overflow-hidden bg-muted rounded-md mb-3">
                      <img
                        src={pick.image}
                        alt={pick.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <h3 className="font-display text-xs text-foreground text-center tracking-wide">
                    {pick.title}
                  </h3>
                  {pick.subtitle && (
                    <p className="font-body text-[10px] text-muted-foreground text-center mt-0.5">
                      {pick.subtitle}
                    </p>
                  )}
                  {pick.materials && (
                    <p className="font-body text-[10px] text-muted-foreground/70 text-center mt-0.5 line-clamp-1">
                      {pick.materials}
                    </p>
                  )}
                  {pick.dimensions && (
                    <p className="font-body text-[9px] text-muted-foreground/50 text-center mt-0.5">
                      {pick.dimensions}
                    </p>
                  )}
                  {pick.edition && (
                    <p className="font-body text-[9px] text-primary/70 text-center mt-0.5 uppercase tracking-wider">
                      {pick.edition}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Related Ateliers */}
        {related.length > 0 && (
          <section className="py-10 mt-4 border-t border-border">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={transition}
              className="font-body text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-8"
            >
              Related Ateliers
            </motion.h2>

            <div className="grid sm:grid-cols-3 gap-4 lg:gap-6">
              {related.map((d, idx) => (
                <motion.div
                  key={d.slug}
                  initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.6,
                    delay: idx * 0.1,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <Link
                    to={`/trade/designers/${d.slug}`}
                    className="group block rounded-lg overflow-hidden border border-border hover:border-foreground/20 transition-all hover:shadow-lg bg-background"
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-muted">
                      <img
                        src={d.image}
                        alt={d.name}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3 text-center">
                      <h3 className="font-display text-sm text-foreground group-hover:text-primary transition-colors tracking-wide">
                        {displayName(d.name)}
                      </h3>
                      <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                        {d.specialty}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
};

export default TradeAtelierProfile;
