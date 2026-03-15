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
 * Renders title, subtitle, materials, dimensions/weight, description,
 * ProvenanceBadge, and an optional inquiry CTA — all with consistent styling.
 */
const CuratorPicksLegend = ({ pick, designerId, onInquiry, className = "" }: CuratorPicksLegendProps) => {
  const p = pick as any; // access optional extended fields

  return (
    <div className={`text-center w-full px-5 md:px-12 ${className}`}>
      {/* Title */}
      <h3 className="font-serif text-[15px] md:text-lg text-white tracking-wide leading-snug">
        {pick.title}
      </h3>

      {/* Subtitle — e.g. "Ondas Sconce by Alexander Lamont" */}
      {p.subtitle && (
        <p className="text-[11px] md:text-xs text-white/45 font-body mt-1 italic">
          {p.subtitle}
        </p>
      )}

      {/* Materials */}
      {pick.materials && (
        <p className="text-[11px] md:text-xs text-white/50 font-body mt-2 leading-relaxed text-justify md:text-center whitespace-pre-line">
          {pick.materials}
        </p>
      )}

      {/* Dimensions & weight */}
      {(p.dimensions || p.weight) && (
        <p className="text-[11px] md:text-xs text-white font-body font-medium mt-1 whitespace-pre-line leading-relaxed">
          {p.dimensions}
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
        <p className="text-[11px] md:text-xs text-white/45 font-body mt-3 leading-relaxed text-justify md:text-center whitespace-pre-line max-w-xl mx-auto">
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
