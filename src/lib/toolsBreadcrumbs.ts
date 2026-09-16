/**
 * Central registry for Tools workspace breadcrumbs.
 *
 * Every tool route registered here automatically renders
 * `Tools / <Category> / <Tool>` at the top of the trade workspace canvas
 * (see `ToolsBreadcrumb`). Deeper sub-routes inherit the parent tool trail
 * and append a title-cased leaf derived from the URL.
 */

export type ToolsCrumb = { label: string; to?: string };

export const TOOLS_ROOT = "/trade/tools";

export const categorySlug = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const categoryHref = (label: string) =>
  `${TOOLS_ROOT}?category=${categorySlug(label)}`;

/** url → [category, tool title] */
export const TOOL_ROUTES: Record<string, [string, string]> = {
  // Discover
  "/trade/gallery": ["Discover", "Gallery"],
  "/trade/designers": ["Discover", "Designers & Ateliers"],
  "/trade/documents": ["Discover", "Resources"],
  "/trade/materials": ["Discover", "Material Library"],
  // Specification
  "/trade/visualiser": ["Specification", "Visualiser"],
  "/trade/mood-boards": ["Specification", "Mood Board"],
  "/trade/annotations": ["Specification", "Markup & Annotation"],
  "/trade/tearsheets": ["Specification", "Specsheet Builder"],
  "/trade/comparator": ["Specification", "Product Comparator"],
  "/trade/ffe-schedule": ["Specification", "FF&E Schedule"],
  "/trade/quotes": ["Specification", "Quote Builder"],
  // Procurement
  "/trade/order-timeline": ["Procurement", "Order Timeline"],
  "/trade/delivery-tracker": ["Procurement", "Delivery Tracker"],
  "/trade/samples": ["Procurement", "Sample Requests"],
  "/trade/shipping-tracker": ["Procurement", "Shipping Tracker"],
  "/trade/lead-time-calendar": ["Procurement", "Lead Time Calendar"],
  "/trade/budget": ["Procurement", "Budget Tracker"],
  "/trade/reorder": ["Procurement", "Reorder"],
  "/trade/currency-converter": ["Procurement", "Currency Converter"],
  // Learn
  "/trade/custom-requests": ["Learn", "Custom Requests"],
  "/trade/calendar": ["Learn", "Showroom & Fair Calendar"],
  "/trade/guides": ["Learn", "Guides"],
  "/trade/learn": ["Learn", "Learn"],
  "/trade/cpd": ["Learn", "CPD & Education"],
  "/trade/axonometric-requests": ["Learn", "3D Studio"],
};

const titleCase = (segment: string) =>
  decodeURIComponent(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/**
 * Resolve the breadcrumb trail for a pathname inside the Tools workspace.
 * Returns null when the route is not a tool (dashboard, clients, admin, …).
 */
export function resolveToolsCrumbs(pathname: string): ToolsCrumb[] | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === TOOLS_ROOT) return null; // the overview itself needs no trail

  // Longest-prefix match so nested tool routes inherit their parent.
  const match = Object.keys(TOOL_ROUTES)
    .filter((url) => path === url || path.startsWith(`${url}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!match) return null;

  const [category, title] = TOOL_ROUTES[match];
  const crumbs: ToolsCrumb[] = [
    { label: "Tools", to: TOOLS_ROOT },
    { label: category, to: categoryHref(category) },
  ];

  const rest = path.slice(match.length).split("/").filter(Boolean);
  if (rest.length === 0) {
    crumbs.push({ label: title });
    return crumbs;
  }

  crumbs.push({ label: title, to: match });
  const leaf = rest[rest.length - 1];
  crumbs.push({ label: UUID_LIKE.test(leaf) ? "Detail" : titleCase(leaf) });
  return crumbs;
}
