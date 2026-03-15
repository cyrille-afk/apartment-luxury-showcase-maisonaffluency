import type { CuratorPick } from "@/components/FeaturedDesigners";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";

interface CuratorPicksLegendProps {
  pick: CuratorPick;
  /** Designer/brand ID for provenance lookup */
  designerId?: string;
  /** Show "send us an inquiry" CTA */
  onInquiry?: () => void;
  className?: string;
}

/**
 * Unified legend (caption) for Curators' Picks across all sections.
 * Typography and spacing mirror the ProductGrid lightbox legend for consistency.
 */
const CuratorPicksLegend = ({ pick, designerId, onInquiry, className = "" }: CuratorPicksLegendProps) => {
  const p = pick as any; // access optional extended fields

  return (
    <div className={`text-center w-full px-4 md:px-12 mt-4 ${className}`}>
      {/* Title — merge subtitle into title for consistency with ProductGrid */}
      <h3 className="font-display text-lg md:text-xl text-white whitespace-nowrap">
        {p.subtitle ? `${pick.title} ${p.subtitle}` : pick.title}
      </h3>

      {/* Materials */}
      {pick.materials && (
        <p className="font-body text-xs text-white/50 mt-2 leading-relaxed text-center whitespace-pre-line">
          {pick.materials.replace(/\n/g, " · ")}
        </p>
      )}

      {/* Dimensions & weight */}
      {(p.dimensions || p.weight) && (
        <p className="font-body text-sm md:text-base text-white font-medium mt-1.5 whitespace-pre-line leading-relaxed">
          {p.dimensions ? p.dimensions.replace(/\n/g, " · ") : ""}
          {p.dimensions && p.weight && " — "}
          {p.weight}
        </p>
      )}

      {/* Edition info */}
      {pick.edition && (
        <p className="text-[10px] md:text-[11px] text-white/40 font-body mt-1 uppercase tracking-widest">
          {pick.edition}
        </p>
      )}

      {/* Description */}
      {p.description && (
        <p className="font-body text-xs text-white/45 mt-3 leading-relaxed text-center whitespace-pre-line max-w-xl mx-auto">
          {p.description}
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
