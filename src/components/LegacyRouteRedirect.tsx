import { Helmet } from "react-helmet-async";
import { Navigate, useLocation } from "react-router-dom";

/**
 * Permanent redirect surface for catalogue URLs Google has already crawled but
 * whose underlying record has been deleted, deactivated or archived.
 *
 * Static SPA hosting cannot emit a raw 301 status line, so we do two things:
 *  - emit prerender/crawler status hints in the document head, and
 *  - immediately replace the history entry so the legacy URL leaves no trace.
 */
const LegacyRouteRedirect = ({ to = "/designers" }: { to?: string }) => {
  const { pathname } = useLocation();
  const absolute = `https://maisonaffluency.com${to}`;

  return (
    <>
      <Helmet>
        <title>Redirecting — Maison Affluency</title>
        <meta name="robots" content="noindex, follow" />
        <meta name="prerender-status-code" content="301" />
        <meta name="prerender-header" content={`Location: ${absolute}`} />
        <link rel="canonical" href={absolute} />
      </Helmet>
      <Navigate to={to} replace state={{ redirectedFrom: pathname }} />
    </>
  );
};

export default LegacyRouteRedirect;
