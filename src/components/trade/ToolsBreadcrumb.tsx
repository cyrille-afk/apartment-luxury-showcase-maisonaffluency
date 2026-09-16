import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { resolveToolsCrumbs, type ToolsCrumb } from "@/lib/toolsBreadcrumbs";

/** Extra, page-owned segments appended after the automatic tool crumb. */
export type ToolsCrumbExtra = { label: string; to?: string; onClick?: () => void };

type Ctx = { extras: ToolsCrumbExtra[]; setExtras: (v: ToolsCrumbExtra[]) => void };
const ToolsBreadcrumbContext = createContext<Ctx | null>(null);

export function ToolsBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [extras, setExtras] = useState<ToolsCrumbExtra[]>([]);
  const value = useMemo(() => ({ extras, setExtras }), [extras]);
  return <ToolsBreadcrumbContext.Provider value={value}>{children}</ToolsBreadcrumbContext.Provider>;
}

/**
 * Register dynamic breadcrumb segments (e.g. the open folder inside Resources).
 * Automatically cleared when the page unmounts.
 */
export function useToolsBreadcrumbExtras(extras: ToolsCrumbExtra[]) {
  const ctx = useContext(ToolsBreadcrumbContext);
  const signature = JSON.stringify(extras.map((e) => [e.label, e.to ?? null]));
  useEffect(() => {
    ctx?.setExtras(extras);
    return () => ctx?.setExtras([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}

/**
 * Global breadcrumb bar for the Tools workspace. Rendered once in the trade
 * layout — every registered tool route gets its trail for free.
 */
export default function ToolsBreadcrumb({ className = "" }: { className?: string }) {
  const location = useLocation();
  const ctx = useContext(ToolsBreadcrumbContext);
  const base = resolveToolsCrumbs(location.pathname);
  if (!base) return null;

  const extras = ctx?.extras ?? [];
  const items: Array<ToolsCrumb & { onClick?: () => void }> = extras.length
    ? [...base.slice(0, -1), { ...base[base.length - 1], to: base[base.length - 1].to ?? location.pathname }, ...extras]
    : base;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`mb-4 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2">
              {isLast ? (
                <span aria-current="page" className="text-foreground">{item.label}</span>
              ) : item.onClick ? (
                <button type="button" onClick={item.onClick} className="transition-colors hover:text-foreground">
                  {item.label}
                </button>
              ) : item.to ? (
                <Link to={item.to} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
              {!isLast && <span aria-hidden="true" className="opacity-50">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
