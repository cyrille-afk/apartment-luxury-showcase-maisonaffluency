import { useMemo, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Instagram, ExternalLink, Quote, Package, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDesigner, useDesignerPicks, useRelatedDesigners } from "@/hooks/useDesigner";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { Badge } from "@/components/ui/badge";
import CurrencyToggle, { DisplayCurrency, useFxRates, formatPriceConverted } from "@/components/trade/CurrencyToggle";

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };
const reveal = { ...transition, delay: 0.15 };

/** Known life dates for historical designers */
const DESIGNER_DATES: Record<string, string> = {
  "jean-michel-frank": "1895–1941",
  "eileen-gray": "1878–1976",
  "pierre-chareau": "1883–1950",
  "robert-mallet-stevens": "1886–1945",
  "mariano-fortuny": "1871–1949",
  "paul-laszlo": "1900–1993",
  "jacques-henri-lartigue": "1894–1986",
  "felix-aublet": "1903–1978",
  "laurent-maugoust-cecile-chenais": "b. 1975",
};

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

  // Scroll to top when profile loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [slug]);
  const { data: picks = [] } = useDesignerPicks(designer?.id);
  const { data: related = [] } = useRelatedDesigners(slug, designer?.source);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("original");
  const fxRates = useFxRates();

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
  // Ecart's hero image already contains the brand name — skip text overlay
  const heroHasEmbeddedName = slug === "ecart";

  return (
    <>
      <Helmet>
        <title>{name} — Ateliers & Partners</title>
      </Helmet>

      <div className="space-y-8">
        {/* Back */}
        <button
          onClick={() => {
            const atelierName = designer.founder || designer.name;
            navigate(`/trade/designers?brand=${encodeURIComponent(atelierName)}`);
          }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {designer.founder ? `Back to ${designer.founder}` : "All Ateliers"}
        </button>

        {/* Hero + About — side by side on desktop for designers (vertical hero), stacked for ateliers (horizontal hero) */}
        {(() => {
          const isDesignerProfile = designer.founder && designer.founder !== designer.name;
          const heroAspect = isDesignerProfile ? "aspect-[3/4]" : "aspect-[16/9]";
          return (
        <div className={cn("flex flex-col gap-6", isDesignerProfile && "md:flex-row")}>
          {/* Hero image */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transition}
            className={cn("relative rounded-xl overflow-hidden shrink-0", isDesignerProfile && "md:w-1/2")}
          >
            <div className={heroAspect}>
              {designer.image_url && (
                <img
                  src={designer.image_url}
                  alt={name}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="eager"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>
            {/* Atelier badge — top left */}
            {designer.founder && designer.founder !== designer.name && (
              <Link
                to={`/trade/designers/${designer.founder.toLowerCase().replace(/\s+/g, '-')}`}
                className="absolute top-4 left-4 md:top-6 md:left-6 z-10 w-16 h-16 md:w-20 md:h-20 bg-black text-white font-display text-[10px] md:text-xs tracking-[0.15em] uppercase hover:bg-black/80 transition-colors shadow-lg flex items-center justify-center text-center"
              >
                {designer.founder}
              </Link>
            )}
            {/* Logo — top left for ateliers */}
            {!heroHasEmbeddedName && designer.logo_url && !designer.founder && (
              <img src={designer.logo_url} alt="" className="absolute top-4 left-4 md:top-6 md:left-6 h-8 md:h-12 opacity-90 z-10" />
            )}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reveal}>
                {!heroHasEmbeddedName && (
                  <h1 className="font-display text-2xl md:text-4xl tracking-wide text-white drop-shadow-md">
                    {name}
                    {slug && DESIGNER_DATES[slug] && (
                      <span className="font-body text-base md:text-xl text-white/60 ml-3 font-normal">{DESIGNER_DATES[slug]}</span>
                    )}
                  </h1>
                )}
                {designer.specialty && (
                  <p className="font-body text-sm md:text-base text-white/80 mt-1.5 font-medium tracking-wide">{designer.specialty}</p>
                )}
                {/* Social links */}
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

          {/* Biography — beside hero for designers, below for ateliers */}
          {designer.biography && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.2 }}
              className={cn(isDesignerProfile ? "md:w-1/2 flex flex-col justify-center" : "flex flex-col")}
            >
              {/* Philosophy quote — above biography, bold black */}
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
              <p className="font-body text-sm leading-relaxed text-foreground/85 text-justify whitespace-pre-line">
                {designer.biography}
              </p>
            </motion.div>
          )}
        </div>
          );
        })()}




        {/* Curator's Picks — full width */}
        {picks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: 0.25 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground">
                Curator's Picks
              </h2>
              <CurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} />
            </div>
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 lg:grid-cols-4 md:overflow-visible md:pb-0">
              {picks.map((pick) => (
                <div key={pick.id} className="group min-w-[60vw] snap-start shrink-0 md:min-w-0 md:shrink">
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
                  {pick.trade_price_cents != null && (
                    <p className="font-display text-xs text-foreground mt-1">
                      {formatPriceConverted(pick.trade_price_cents, pick.currency || 'EUR', displayCurrency, fxRates)}
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
    </>
  );
};

export default TradeAtelierProfile;
