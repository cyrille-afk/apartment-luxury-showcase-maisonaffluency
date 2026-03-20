import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Ruler, Layers, Clock, Calendar, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { sharePageOnWhatsApp } from "@/lib/whatsapp-share";
import { trackCTA } from "@/lib/analytics";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";

interface Product {
  id: string;
  product_name: string;
  brand_name: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  image_url: string | null;
  gallery_images: string[] | null;
  materials: string | null;
  dimensions: string | null;
  lead_time: string | null;
  is_active: boolean;
}

const SITE_URL = "https://maisonaffluency.com";

const ProductPage = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, category, subcategory, description, image_url, gallery_images, materials, dimensions, lead_time, is_active")
        .eq("id", id)
        .eq("is_active", true)
        .single();
      if (error || !data) {
        setNotFound(true);
      } else {
        setProduct(data as Product);
      }
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-display text-2xl text-foreground mb-2">Product Not Found</h1>
          <p className="font-body text-sm text-muted-foreground mb-6">This product may no longer be available.</p>
          <Link to="/" className="font-body text-sm text-foreground underline underline-offset-4">Return to Home</Link>
        </div>
      </div>
    );
  }

  const allImages = [
    ...(product.image_url ? [product.image_url] : []),
    ...(product.gallery_images?.filter(img => img !== product.image_url) || []),
  ];
  const hasMultipleImages = allImages.length > 1;

  const canonicalUrl = `${SITE_URL}/product/${product.id}`;
  const pageTitle = `${product.product_name} by ${product.brand_name} — Maison Affluency`;
  const pageDescription = product.description
    ? product.description.slice(0, 155)
    : `Discover ${product.product_name} by ${product.brand_name}. ${product.materials ? `Crafted in ${product.materials}.` : ""} Available through Maison Affluency's curated collection.`;

  // JSON-LD Product schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.product_name,
    description: pageDescription,
    brand: {
      "@type": "Brand",
      name: product.brand_name,
    },
    ...(allImages.length > 0 && { image: allImages }),
    ...(product.materials && { material: product.materials }),
    ...(product.category && { category: product.category }),
    url: canonicalUrl,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "Maison Affluency",
      },
      url: canonicalUrl,
    },
  };

  // BreadcrumbList JSON-LD
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: product.brand_name, item: `${SITE_URL}/#brands` },
      { "@type": "ListItem", position: 3, name: product.product_name, item: canonicalUrl },
    ],
  };

  const bookingMailto = `mailto:concierge@myaffluency.com?subject=${encodeURIComponent(`Viewing Request: ${product.product_name} by ${product.brand_name}`)}&body=${encodeURIComponent(`Hi,\n\nI'd like to book a private viewing to see the ${product.product_name} by ${product.brand_name} at your showroom.\n\nPlease let me know your available times.\n\nThank you.`)}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={canonicalUrl} />
        {allImages[0] && <meta property="og:image" content={allImages[0]} />}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Branded header */}
        <header className="border-b border-border bg-background sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-display text-sm text-foreground tracking-wide">Maison Affluency</span>
            </Link>
            <a href={bookingMailto} className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Book a Viewing
            </a>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6 md:py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 mb-6 font-body text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <span>/</span>
            <span className="text-foreground">{product.brand_name}</span>
            <span>/</span>
            <span className="text-foreground truncate max-w-[200px]">{product.product_name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Image gallery */}
            <div>
              <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                {allImages[activeImage] ? (
                  <img
                    src={allImages[activeImage]}
                    alt={`${product.product_name} by ${product.brand_name}`}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-body text-sm">
                    No image available
                  </div>
                )}
                {hasMultipleImages && (
                  <>
                    <button
                      onClick={() => setActiveImage(i => (i - 1 + allImages.length) % allImages.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setActiveImage(i => (i + 1) % allImages.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {hasMultipleImages && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {allImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`w-16 h-16 rounded-md overflow-hidden shrink-0 border-2 transition-colors ${
                        i === activeImage ? "border-foreground" : "border-transparent hover:border-muted-foreground/30"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product details */}
            <div className="flex flex-col">
              <p className="font-body text-xs text-muted-foreground uppercase tracking-[0.15em] mb-2">{product.brand_name}</p>
              <h1 className="font-display text-2xl md:text-3xl text-foreground leading-tight">{product.product_name}</h1>

              {product.category && (
                <p className="font-body text-xs text-muted-foreground mt-2 uppercase tracking-wider">
                  {product.category}{product.subcategory ? ` · ${product.subcategory}` : ""}
                </p>
              )}

              {product.description && (
                <p className="font-body text-sm text-muted-foreground mt-6 leading-relaxed">{product.description}</p>
              )}

              {/* Specifications */}
              <div className="mt-8 space-y-4 border-t border-border pt-6">
                {product.materials && (
                  <div className="flex items-start gap-3">
                    <Layers className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Materials</p>
                      <p className="font-body text-sm text-foreground">{product.materials}</p>
                    </div>
                  </div>
                )}
                {product.dimensions && (
                  <div className="flex items-start gap-3">
                    <Ruler className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Dimensions</p>
                      <p className="font-body text-sm text-foreground">{product.dimensions}</p>
                    </div>
                  </div>
                )}
                {product.lead_time && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Lead Time</p>
                      <p className="font-body text-sm text-foreground">{product.lead_time}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="mt-8 space-y-3">
                <p className="font-body text-xs text-muted-foreground">
                  Visit our Singapore showroom to experience this piece in person
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild className="flex-1">
                    <a href={bookingMailto}>
                      <Calendar className="h-4 w-4 mr-2" /> Book a Viewing
                    </a>
                  </Button>
                  <Button variant="outline" asChild className="flex-1">
                    <Link to="/trade/program">
                      <Briefcase className="h-4 w-4 mr-2" /> Trade Program
                    </Link>
                  </Button>
                </div>
                <WhatsAppShareButton
                  onClick={() => {
                    sharePageOnWhatsApp(`/product/${id}`, `${product.product_name} by ${product.brand_name}`, product.category);
                    trackCTA.whatsapp(`ProductPage_Share_${product.product_name}`);
                  }}
                  label="Share on WhatsApp"
                  variant="branded"
                />
              </div>

              {/* noscript fallback for SEO */}
              <noscript>
                <div>
                  <h2>{product.product_name}</h2>
                  <p>Brand: {product.brand_name}</p>
                  {product.materials && <p>Materials: {product.materials}</p>}
                  {product.dimensions && <p>Dimensions: {product.dimensions}</p>}
                  <p>Book a private viewing at our Singapore showroom — concierge@myaffluency.com</p>
                </div>
              </noscript>
            </div>
          </div>
        </main>

        <footer className="border-t border-border mt-16 py-8 text-center">
          <Link to="/" className="font-display text-xs text-muted-foreground tracking-wide hover:text-foreground transition-colors">
            Maison Affluency
          </Link>
          <p className="font-body text-[10px] text-muted-foreground/60 mt-1">Curated luxury furnishings for discerning professionals</p>
        </footer>
      </div>
    </>
  );
};

export default ProductPage;
