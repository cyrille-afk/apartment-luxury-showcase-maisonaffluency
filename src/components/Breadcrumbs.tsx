import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string; // last crumb is rendered as plain text
}

interface BreadcrumbsProps {
  items: Crumb[];
  className?: string;
  /** "default" = chevron separators, wrapping. "compact" = "/" separators, single-line, small. */
  variant?: "default" | "compact";
}

/**
 * Editorial breadcrumbs used on product pages (Public + Trade).
 * Last item is always plain text (current page). All others link.
 * Renders as a semantic <nav> with an ordered list for SEO.
 */
export default function Breadcrumbs({ items, className = "", variant = "default" }: BreadcrumbsProps) {
  if (!items.length) return null;

  const compact = variant === "compact";

  return (
    <nav
      aria-label="Breadcrumb"
      className={`font-body ${compact ? "text-[10px] tracking-[0.14em]" : "text-[11px] tracking-[0.18em]"} uppercase text-muted-foreground ${className}`}
    >
      <ol className={`flex items-center ${compact ? "flex-nowrap gap-1 overflow-hidden whitespace-nowrap" : "flex-wrap gap-1.5"}`}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className={`flex items-center ${compact ? "gap-1" : "gap-1.5"} min-w-0`}>
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-foreground transition-colors truncate">
                  {item.label}
                </Link>
              ) : (
                <span className={`${isLast ? "text-foreground" : ""} truncate`} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast && (
                compact
                  ? <span className="opacity-50" aria-hidden>/</span>
                  : <ChevronRight size={11} className="opacity-60" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
