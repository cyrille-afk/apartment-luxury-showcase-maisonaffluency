import { ChevronDown, Search, ShoppingBag, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface TradeEditorialHeaderProps {
  isUKVariant: boolean;
  onRegionChange: (isUK: boolean) => void;
}

const utilityLinkClass =
  "inline-flex h-10 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const navLinkClass =
  "whitespace-nowrap font-body text-[11px] font-light uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground md:text-sm lg:text-[15px]";

export default function TradeEditorialHeader({
  isUKVariant,
  onRegionChange,
}: TradeEditorialHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/45 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      {/* Wordmark tier */}
      <div className="relative flex w-full items-center justify-between px-4 py-4 sm:px-10 sm:py-6 lg:px-16 lg:py-8">
        <div
          role="group"
          aria-label="Choose region"
          className="flex flex-shrink-0 items-center gap-1.5 font-body text-[9px] font-normal uppercase tracking-[0.18em] text-muted-foreground sm:gap-2 sm:text-[11px] lg:text-[13px]"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full border border-accent sm:h-2 sm:w-2" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRegionChange(false)}
            aria-pressed={!isUKVariant}
            className={`h-auto min-w-0 rounded-none p-0 font-body text-[9px] font-normal uppercase tracking-[0.18em] hover:bg-transparent sm:text-[11px] lg:text-[13px] ${!isUKVariant ? "text-foreground" : "text-muted-foreground"}`}
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
            className={`h-auto min-w-0 rounded-none p-0 font-body text-[9px] font-normal uppercase tracking-[0.18em] hover:bg-transparent sm:text-[11px] lg:text-[13px] ${isUKVariant ? "text-foreground" : "text-muted-foreground"}`}
          >
            UK
          </Button>
        </div>

        <Link
          to="/"
          aria-label="Maison Affluency home"
          className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap"
        >
          <span className="font-brand text-base font-normal uppercase tracking-[0.18em] text-foreground sm:text-2xl lg:text-3xl">
            Maison Affluency
          </span>
          <span aria-hidden="true" className="mx-4 hidden h-3.5 w-px bg-foreground/25 sm:block lg:mx-6" />
          <span className="hidden font-body text-[7px] font-light uppercase tracking-[0.3em] text-foreground sm:block">
            Est. 2017
          </span>
        </Link>

        <div className="flex flex-shrink-0 items-center gap-0.5 justify-self-end sm:gap-2">
          <Link
            to="/contact"
            className="mr-2 hidden whitespace-nowrap font-body text-[9px] font-normal uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground md:block lg:text-[13px]"
          >
            Contact us
          </Link>
          <Link to="/designers" aria-label="Search" className={utilityLinkClass}>
            <Search className="h-4 w-4 stroke-[1.3] sm:h-[18px] sm:w-[18px] lg:h-5 lg:w-5" />
          </Link>
          <Link to="/trade/login" aria-label="Account" className={utilityLinkClass}>
            <UserRound className="h-4 w-4 stroke-[1.3] sm:h-[18px] sm:w-[18px] lg:h-5 lg:w-5" />
          </Link>
          <Link to="/cart" aria-label="Shopping bag" className={`${utilityLinkClass} hidden sm:inline-flex`}>
            <ShoppingBag className="h-[18px] w-[18px] stroke-[1.3] lg:h-5 lg:w-5" />
          </Link>
        </div>
      </div>

      {/* Navigation tier */}
      <nav aria-label="Main navigation" className="w-full overflow-x-auto border-t border-border/35 px-4 scrollbar-hide sm:px-10 lg:px-16">
        <div className="flex min-w-max items-center justify-center gap-7 py-3.5 sm:gap-10 sm:py-4 md:gap-12 lg:gap-16">
          <Link to="/new-in" className={navLinkClass}>New in</Link>
          <Link to="/products-category/furniture" className={`${navLinkClass} inline-flex items-center gap-2`}>
            Categories <ChevronDown className="h-3 w-3 stroke-[1.2]" />
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