import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Instagram, ExternalLink, Quote, Package, FileText } from "lucide-react";
import { useDesigner, useDesignerPicks, useRelatedDesigners } from "@/hooks/useDesigner";
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
  const { data: designer, isLoading } = useDesigner(slug);
  const { data: picks = [] } = useDesignerPicks(designer?.id);
  const { data: related = [] } = useRelatedDesigners(slug, designer?.source);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

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
        <title>{name} — Ateliers & Partners</title>
      </Helmet>

      <div className="space-y-8">
        {/* Back */}
        <button
          onClick={() => navigate("/trade/designers")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Ateliers
        </button>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition}
          className="relative rounded-xl overflow-hidden"
        >
          <div className="aspect-[21/9] md:aspect-[3/1]">
            {designer.image_url && (
              <img
                src={designer.image_url}
                alt={name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reveal}>
              <div className="flex items-start gap-4">
                {designer.logo_url && (
                  <img src={designer.logo_url} alt="" className="h-10 opacity-80 shrink-0" />
                )}
                <div>
                  <h1 className="font-display text-2xl md:text-4xl tracking-wide text-foreground">
                    {name}
                  </h1>
                  {designer.specialty && (
                    <p className="font-body text-sm text-muted-foreground mt-1">{designer.specialty}</p>
                  )}
                </div>
              </div>
              {/* Stats */}
              <div className="flex items-center gap-6 mt-4">
                {brandProducts.length > 0 && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Package className="w-4 h-4" />
                    <span className="font-body text-xs">
                      {brandProducts.length} {brandProducts.length === 1 ? "piece" : "pieces"}
                    </span>
                  </div>
                )}
                {categories.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {categories.slice(0, 4).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-[9px] uppercase tracking-wider">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  {instagramLink && (
                    <a href={instagramLink} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {websiteLink && (
                    <a href={websiteLink} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left: Bio + Philosophy */}
          <div className="lg:col-span-1 space-y-8">
            {designer.biography && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transition, delay: 0.2 }}
              >
                <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
                  About
                </h2>
                <p className="font-body text-sm leading-relaxed text-foreground/85">
                  {designer.biography}
                </p>
              </motion.div>
            )}

            {designer.philosophy && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transition, delay: 0.3 }}
                className="border-l-2 border-primary/30 pl-5 py-2"
              >
                <Quote className="w-4 h-4 text-primary/40 mb-2" />
                <blockquote className="font-display text-sm italic leading-relaxed text-foreground/70">
                  "{designer.philosophy}"
                </blockquote>
              </motion.div>
            )}

            {designer.notable_works && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transition, delay: 0.4 }}
              >
                <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
                  Notable Works
                </h2>
                <p className="font-body text-sm text-foreground/70">{designer.notable_works}</p>
              </motion.div>
            )}
          </div>

          {/* Right: Curator's Picks */}
          <div className="lg:col-span-2">
            {picks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transition, delay: 0.25 }}
              >
                <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">
                  Curator's Picks
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {picks.map((pick) => (
                    <div key={pick.id} className="group">
                      <div className="aspect-[4/5] bg-muted/20 rounded-lg overflow-hidden mb-2">
                        <img
                          src={pick.image_url}
                          alt={pick.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <h3 className="font-display text-xs tracking-wide">{pick.title}</h3>
                      {pick.subtitle && (
                        <p className="font-body text-[10px] text-muted-foreground">{pick.subtitle}</p>
                      )}
                      {pick.materials && (
                        <p className="font-body text-[9px] text-muted-foreground/60 mt-0.5 line-clamp-2">
                          {pick.materials}
                        </p>
                      )}
                      {pick.dimensions && (
                        <p className="font-body text-[9px] text-muted-foreground/50 mt-0.5">
                          {pick.dimensions}
                        </p>
                      )}
                      {pick.edition && (
                        <p className="font-body text-[9px] text-primary/70 mt-0.5 italic">
                          {pick.edition}
                        </p>
                      )}
                      {pick.pdf_url && (
                        <a
                          href={pick.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-[9px] text-primary hover:underline"
                        >
                          <FileText className="w-3 h-3" />
                          Spec Sheet
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {picks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/10 rounded-xl">
                <Package className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="font-body text-sm text-muted-foreground">
                  Curator's picks coming soon
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Related Ateliers */}
        {related.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={transition}
            className="pt-10 border-t border-border"
          >
            <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">
              Related Ateliers
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {related.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => navigate(`/trade/designers/${r.slug}`)}
                  className="group text-left rounded-lg overflow-hidden border border-border hover:border-foreground/20 transition-all bg-background"
                >
                  <div className="aspect-[3/2] bg-muted/20 overflow-hidden">
                    {r.image_url && (
                      <img
                        src={r.image_url}
                        alt={r.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-display text-sm tracking-wide">{displayName(r.name)}</p>
                    {r.specialty && (
                      <p className="font-body text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                        {r.specialty}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
};

export default TradeAtelierProfile;
