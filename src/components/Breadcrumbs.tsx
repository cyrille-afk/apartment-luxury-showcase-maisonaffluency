import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string; // last crumb is rendered as plain text
}

interface BreadcrumbsProps {
  items: Crumb[];
  className?: string;
}

/**
 * Editorial breadcrumbs used on product pages (Public + Trade).
 * Last item is always plain text (current page). All others link.
 * Renders as a semantic <nav> with an ordered list for SEO.
 */
export default function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-foreground" : ""} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight size={11} className="opacity-60" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
