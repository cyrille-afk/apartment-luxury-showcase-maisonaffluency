import { Helmet } from "react-helmet-async";
import { getDesignerOpenGraph, type DesignerOpenGraphInput } from "@/lib/designerOpenGraph";

/** React head tags; non-JS messaging crawlers use the matching static OG bridge. */
export default function DesignerProfileSeo({ designer }: { designer: DesignerOpenGraphInput }) {
  const meta = getDesignerOpenGraph(designer);
  return (
    <Helmet>
      <meta property="og:type" content={meta.type} />
      <meta property="og:site_name" content="Maison Affluency" />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={meta.url} />
      <meta property="og:image" content={meta.image} />
      <meta property="og:image:secure_url" content={meta.image} />
      {meta.imageType && <meta property="og:image:type" content={meta.imageType} />}
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={meta.imageAlt} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={meta.image} />
    </Helmet>
  );
}