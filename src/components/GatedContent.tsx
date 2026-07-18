import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVerifiedAccess } from "@/hooks/useVerifiedAccess";

interface GatedContentProps {
  children: ReactNode;
  label?: string;
  description?: string;
  className?: string;
  /** Show a compact single-line pill instead of the full overlay card. */
  compact?: boolean;
}

/**
 * Reveals its children only for verified trade professionals or approved
 * private collectors. For everyone else, renders a blurred preview of the
 * children with an unlock CTA on top.
 *
 * Access request routes:
 *   - Trade professionals → /trade/register
 *   - Private collectors  → /collector-signup
 */
export const GatedContent = ({
  children,
  label = "Verified Access Required",
  description = "Full pricing and provenance are reserved for verified trade professionals and approved private collectors.",
  className,
  compact = false,
}: GatedContentProps) => {
  const { verified, loading } = useVerifiedAccess();

  if (loading) {
    // Render a neutral placeholder to avoid layout shift while resolving.
    return <div className={cn("opacity-60", className)} aria-busy>{children}</div>;
  }
  if (verified) return <>{children}</>;

  return (
    <div className={cn("relative rounded-lg overflow-hidden isolate", className)}>
      <div
        aria-hidden
        className="pointer-events-none select-none blur-md scale-[1.02] opacity-70"
      >
        {children}
      </div>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]",
          compact ? "p-2" : "p-4"
        )}
      >
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5">
            <Lock className="h-3 w-3 text-primary" />
            <span className="font-body text-[10px] uppercase tracking-[0.12em] text-primary">{label}</span>
          </div>
          {!compact && (
            <p className="font-body text-xs text-muted-foreground leading-relaxed mb-3">{description}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/trade/register"
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-foreground text-background font-body text-[10px] uppercase tracking-[0.12em] hover:bg-foreground/90 transition-colors"
            >
              Trade Access
            </Link>
            <Link
              to="/collector-signup"
              className="inline-flex items-center px-3 py-1.5 rounded-md border border-foreground/40 text-foreground font-body text-[10px] uppercase tracking-[0.12em] hover:bg-foreground/5 transition-colors"
            >
              Private Collector
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatedContent;
