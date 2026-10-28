import { Helmet } from "react-helmet-async";
import { categoryHeadData } from "@/lib/categoryHead";

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
  const path = subcategorySlug
    ? `/products-category/${categorySlug}/${subcategorySlug}`
    : `/products-category/${categorySlug}`;
  const canonical = `https://www.maisonaffluency.com${path}`;
  const { title, description } = categoryHeadData(category, subcategory, path);

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
      <script type="application/ld+json">{JSON.stringify(collectionLd)}</script>
      <script type="application/ld+json">{JSON.stringify(crumbsLd)}</script>
    </Helmet>
  );
}
