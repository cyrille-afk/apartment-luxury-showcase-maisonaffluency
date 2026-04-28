import { Helmet } from "react-helmet-async";
import { OG_FALLBACK } from "@/lib/ogImage";

interface Props {
  category: string;
  subcategory: string | null;
  categorySlug: string;
  subcategorySlug?: string | null;
}

/**
 * SEO + OG metadata for /products-category/:category[/:subcategory] routes.
 * Mounted inside CategoryRoute so it overrides the Index page's <Helmet>
 * (react-helmet-async resolves to the most recently mounted matching tag).
 */
export default function CategorySeo({ category, subcategory, categorySlug, subcategorySlug }: Props) {
  const label = subcategory ? `${subcategory} — ${category}` : category;
  const path = subcategorySlug
    ? `/products-category/${categorySlug}/${subcategorySlug}`
    : `/products-category/${categorySlug}`;
  const canonical = `https://www.maisonaffluency.com${path}`;
  const title = `${label} — Maison Affluency`;
  const description = subcategory
    ? `Explore curated ${subcategory.toLowerCase()} from world-renowned designers and ateliers — collectible ${category.toLowerCase()} at Maison Affluency.`
    : `Discover collectible ${category.toLowerCase()} from world-renowned designers and ateliers at Maison Affluency.`;

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Maison Affluency", url: "https://www.maisonaffluency.com" },
  };

  const crumbsLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.maisonaffluency.com" },
      { "@type": "ListItem", position: 2, name: category, item: `https://www.maisonaffluency.com/products-category/${categorySlug}` },
      ...(subcategory && subcategorySlug
        ? [{ "@type": "ListItem", position: 3, name: subcategory, item: canonical }]
        : []),
    ],
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Maison Affluency" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={OG_FALLBACK} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_FALLBACK} />
      <script type="application/ld+json">{JSON.stringify(collectionLd)}</script>
      <script type="application/ld+json">{JSON.stringify(crumbsLd)}</script>
    </Helmet>
  );
}
