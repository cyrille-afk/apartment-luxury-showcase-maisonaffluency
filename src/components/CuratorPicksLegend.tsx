import type { CuratorPick } from "@/components/FeaturedDesigners";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";

/** Prevent orphans by joining the last two words of each line with a non-breaking space */
const preventOrphans = (text: string): string =>
  text.replace(/(\S+)\s+(\S+)$/gm, "$1\u00A0$2");

interface CuratorPicksLegendProps {
  pick: CuratorPick;
  /** Designer/brand ID for provenance lookup */
  designerId?: string;
  /** Designer/brand display name for attribution */
  designerName?: string;
  /** Show "send us an inquiry" CTA */
  onInquiry?: () => void;
  className?: string;
}

/**
 * Unified legend (caption) for Curators' Picks across all sections.
 * Layout mirrors the ProductGrid lightbox legend exactly.
 */
const CuratorPicksLegend = ({ pick, designerId, designerName, onInquiry, className = "" }: CuratorPicksLegendProps) => {
  const p = pick as any; // access optional extended fields

  return (
    <div className={`text-center w-full px-4 md:px-12 mt-4 ${className}`}>
      {/* Title — always merge subtitle into title for consistency with ProductGrid */}
      <h3 className="font-display text-lg md:text-xl text-white whitespace-nowrap">
        {p.subtitle ? `${pick.title} ${p.subtitle}` : pick.title}
      </h3>

      {/* Materials */}
      {pick.materials && (
        <>
          {/* Mobile: line breaks preserved */}
          <p className="font-body text-xs text-white/50 mt-2 leading-relaxed whitespace-pre-line md:hidden">
            {pick.materials}
          </p>
          {/* Desktop: bullet separators */}
          <p className="font-body text-xs text-white/50 mt-2 leading-relaxed hidden md:block">
            {pick.materials.replace(/\n/g, " · ")}
          </p>
        </>
      )}

      {/* Dimensions */}
      {p.dimensions && (
        <>
          <p className="font-body text-sm text-white font-medium mt-1.5 whitespace-pre-line md:hidden">
            {p.dimensions}
          </p>
          <p className="font-body text-sm md:text-base text-white font-medium mt-1.5 hidden md:block">
            {p.dimensions.replace(/\n/g, " · ")}
          </p>
        </>
      )}

      {/* Edition info */}
      {pick.edition && (
        <p className="text-[10px] md:text-[11px] text-white/40 font-body mt-1 uppercase tracking-widest">
          {pick.edition}
        </p>
      )}

      {/* Photo credit */}
      {pick.photoCredit && (
        <p className="text-[10px] text-white/30 font-body mt-2 italic">
          Photo: {pick.photoCredit}
        </p>
      )}


      {/* Provenance badge — renders only when certificate data exists */}
      {designerId && (
        <ProvenanceBadge
          designerId={designerId}
          pieceTitle={pick.title}
          className="mt-3"
        />
      )}

      {/* Inquiry CTA */}
      {onInquiry && (
        <p className="text-[10px] md:text-[11px] text-white/35 font-body mt-5 leading-relaxed max-w-md mx-auto">
          We carry all products by this brand. If you cannot find your dream product in our gallery or would like an individual quotation, please{" "}
          <button
            onClick={(e) => { e.stopPropagation(); onInquiry(); }}
            className="text-white/55 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
          >
            send us an inquiry
          </button>
          .
        </p>
      )}
    </div>
  );
};

export default CuratorPicksLegend;
