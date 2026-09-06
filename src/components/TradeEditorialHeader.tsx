import { ChevronDown, Search, ShoppingBag, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface TradeEditorialHeaderProps {
  isUKVariant: boolean;
  onRegionChange: (isUK: boolean) => void;
}

const utilityLinkClass =
  "inline-flex h-7 w-7 items-center justify-center text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const navLinkClass =
  "whitespace-nowrap font-body text-[9px] font-normal uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground md:text-[10px]";

export default function TradeEditorialHeader({
  isUKVariant,
  onRegionChange,
}: TradeEditorialHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/45 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="relative mx-auto flex h-12 w-full max-w-[1440px] items-center justify-between px-3 sm:px-6 lg:px-10">
        <div
          role="group"
          aria-label="Choose region"
          className="flex items-center gap-1 font-body text-[8px] font-normal uppercase tracking-[0.2em] text-muted-foreground sm:gap-1.5 sm:text-[9px]"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full border border-accent" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRegionChange(false)}
            aria-pressed={!isUKVariant}
            className={`h-auto min-w-0 rounded-none p-0 font-body text-[8px] font-normal uppercase tracking-[0.2em] hover:bg-transparent sm:text-[9px] ${!isUKVariant ? "text-foreground" : "text-muted-foreground"}`}
          >
            <span className="sm:hidden">WW</span>
            <span className="hidden sm:inline">Worldwide</span>
          </Button>
          <span aria-hidden="true" className="text-border">/</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRegionChange(true)}
            aria-pressed={isUKVariant}
            className={`h-auto min-w-0 rounded-none p-0 font-body text-[8px] font-normal uppercase tracking-[0.2em] hover:bg-transparent sm:text-[9px] ${isUKVariant ? "text-foreground" : "text-muted-foreground"}`}
          >
            UK
          </Button>
        </div>

        <Link
          to="/"
          aria-label="Maison Affluency home"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-[17px] font-normal uppercase tracking-[0.17em] text-foreground sm:text-[21px] sm:tracking-[0.2em] lg:text-[23px]"
        >
          Maison Affluency
        </Link>

        <div className="flex items-center gap-0.5 justify-self-end sm:gap-1">
          <Link
            to="/contact"
            className="mr-2 hidden whitespace-nowrap font-body text-[8px] font-normal uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            Contact us
          </Link>
          <Link to="/designers" aria-label="Search" className={utilityLinkClass}>
            <Search className="h-3 w-3 stroke-[1.4]" />
          </Link>
          <Link to="/trade/login" aria-label="Account" className={utilityLinkClass}>
            <UserRound className="h-3 w-3 stroke-[1.4]" />
          </Link>
          <Link to="/cart" aria-label="Shopping bag" className={`${utilityLinkClass} hidden sm:inline-flex`}>
            <ShoppingBag className="h-3 w-3 stroke-[1.4]" />
          </Link>
        </div>
      </div>

      <nav aria-label="Main navigation" className="overflow-x-auto border-t border-border/35 px-4 scrollbar-hide">
        <div className="mx-auto flex min-w-max items-center justify-center gap-9 py-2.5 md:gap-12 lg:gap-14">
          <Link to="/new-in" className={navLinkClass}>New in</Link>
          <Link to="/products-category/furniture" className={`${navLinkClass} inline-flex items-center gap-1.5`}>
            Categories <ChevronDown className="h-2.5 w-2.5 stroke-[1.2]" />
          </Link>
          <Link to="/designers" className={navLinkClass}>Designers</Link>
          <Link to="/gallery" className={navLinkClass}>Interactive gallery</Link>
          <Link to="/journal" className={navLinkClass}>Journal</Link>
          <span className={`${navLinkClass} border-b border-accent pb-1 text-foreground`}>Trade program</span>
        </div>
      </nav>
    </header>
  );
}