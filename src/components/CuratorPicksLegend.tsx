import type { CuratorPick } from "@/components/FeaturedDesigners";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";

interface CuratorPicksLegendProps {
  pick: CuratorPick;
  designerId?: string;
  designerName?: string;
  onInquiry?: () => void;
  className?: string;
}

/** Prevent orphan (widow) words: if the last word on a line would be alone,
 *  join it to the previous word with a non-breaking space. Works per-line. */
const preventOrphans = (text: string): string =>
  text.split("\n").map(line => {
    const words = line.split(" ");
    if (words.length <= 2) return line;
    return [...words.slice(0, -2), words.slice(-2).join("\u00A0")].join(" ");
  }).join("\n");

const CuratorPicksLegend = ({ pick, designerId, designerName, onInquiry, className = "" }: CuratorPicksLegendProps) => {
  const p = pick as any;

  return (
    <div className={`text-center w-full px-4 md:px-12 mt-4 ${className}`}>
      <h3 className="font-display text-lg md:text-xl text-white whitespace-nowrap">
        {p.subtitle ? `${pick.title} ${p.subtitle}` : pick.title}
      </h3>

      {pick.materials && (
        <>
          <p className="font-body text-xs text-white/50 mt-2 leading-relaxed whitespace-pre-line md:hidden">
            {preventOrphans(pick.materials)}
          </p>
          <p className="font-body text-xs text-white/50 mt-2 leading-relaxed hidden md:block">
            {pick.materials.replace(/\n/g, " · ")}
          </p>
        </>
      )}

      {p.dimensions && (
        <>
          <p className="font-body text-sm text-white font-medium mt-1.5 whitespace-pre-line md:hidden">
            {preventOrphans(p.dimensions)}
          </p>
          <p className="font-body text-sm md:text-base text-white font-medium mt-1.5 hidden md:block">
            {p.dimensions.replace(/\n/g, " · ")}
          </p>
        </>
      )}

      {pick.edition && (
        <p className="text-[10px] md:text-[11px] text-white/40 font-body mt-1 uppercase tracking-widest">
          {pick.edition}
        </p>
      )}

      {pick.photoCredit && (
        <p className="text-[10px] text-white/30 font-body mt-2 italic">
          Photo: {pick.photoCredit}
        </p>
      )}

      {designerId && (
        <ProvenanceBadge
          designerId={designerId}
          pieceTitle={pick.title}
          className="mt-3"
        />
      )}

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
