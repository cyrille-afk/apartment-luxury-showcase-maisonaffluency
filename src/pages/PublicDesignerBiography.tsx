import { useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import EditorialBiography from "@/components/EditorialBiography";
import HeritageSlider from "@/components/HeritageSlider";
import { useHeritageSlides } from "@/hooks/useHeritageSlides";
import { useDesigner } from "@/hooks/useDesigner";
import { useAuth } from "@/hooks/useAuth";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";

function displayName(name: string): string {
  if (name.includes(" - ")) {
    const [brand] = name.split(" - ");
    return brand.trim();
  }
  return name;
}

export default function PublicDesignerBiography() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const isTradeUser = !!user;
  const { data: designer, isLoading } = useDesigner(slug, { includeTradeOnly: isTradeUser });
  const { data: heritageSlides = [] } = useHeritageSlides(designer?.id);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <DotCircleLoader />
      </div>
    );
  }

  if (!designer) return <Navigate to="/" replace />;

  const name = displayName(designer.name);
  const biography = designer.biography || "";
  const heroImage = (designer as any).wide_hero_image_url || designer.hero_image_url || designer.image_url;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{`${name} — Portrait | Maison Affluency`}</title>
        <meta
          name="description"
          content={`The full portrait of ${name}: history, craftsmanship and the studio's design philosophy.`}
        />
        <link rel="canonical" href={`https://www.maisonaffluency.com/designers/${designer.slug}/biography`} />
      </Helmet>

      <Navigation />

      <main className="pt-[70px]">
        {/* Editorial masthead */}
        <header className="mx-auto max-w-[1400px] px-[6vw] pt-14 pb-10 md:pt-20 md:pb-14">
          <Link
            to={`/designers/${designer.slug}`}
            className="group inline-flex items-center gap-3 font-body text-[10px] md:text-[11px] uppercase tracking-[0.22em] text-foreground/60 hover:text-foreground transition-colors duration-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={1.25} />
            <span>Back to {name}</span>
          </Link>

          <h1 className="mt-8 font-display text-4xl md:text-6xl leading-[1.05] tracking-[-0.01em] text-foreground">
            {name}
          </h1>
          <p className="mt-4 font-body text-[10px] md:text-[11px] uppercase tracking-[0.32em] text-foreground/60">
            {designer.specialty || "The Full Portrait"}
          </p>
        </header>

        {heroImage && (
          <div className="relative w-full h-[45vh] md:h-[60vh] overflow-hidden bg-muted">
            <img
              src={heroImage}
              alt={`${name} atelier`}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )}

        <article className="mx-auto max-w-[820px] px-6 md:px-8 pt-12 md:pt-16 pb-16">
          {biography ? (
            <EditorialBiography
              biography={biography}
              biographyImages={designer.biography_images || []}
              pickImages={[]}
              designerName={designer.name}
              allowCollapse={false}
            />
          ) : (
            <p className="font-body text-[15px] leading-[1.85] text-foreground/70">
              The full portrait for {name} is being written.
            </p>
          )}

          {designer.hero_photo_credit && (
            <p className="mt-12 font-body text-[10px] uppercase tracking-[0.15em] text-foreground/40">
              Photo: {designer.hero_photo_credit}
            </p>
          )}
        </article>

        {heritageSlides.length > 0 && (
          <section className="mx-auto max-w-[1400px] px-[6vw] pb-16">
            <HeritageSlider slides={heritageSlides} />
          </section>
        )}

        <div className="mx-auto max-w-[1400px] px-[6vw] pb-24">
          <Link
            to={`/designers/${designer.slug}`}
            className="group inline-flex items-center gap-3 font-body text-[11px] uppercase tracking-[0.22em] text-foreground hover:opacity-70 transition-opacity duration-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={1.25} />
            <span>Return to the collection</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
