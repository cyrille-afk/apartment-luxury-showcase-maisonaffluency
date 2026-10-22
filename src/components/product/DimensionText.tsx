import { splitDimensionQualifier, toImperialLine } from "@/lib/formatDimensions";

/** Preserve each measurement row and keep auxiliary chair heights together. */
export function splitDimensionHeights(text: string): { main: string; heights: string } {
  const match = text.match(/\s*(?:\/|;|·|,|[-–—])\s*(?=(?:SH|AH|AR|Seat\s+Height|Arm\s+Height)\b)/i);
  if (!match || match.index === undefined) return { main: text.trim(), heights: "" };
  return { main: text.slice(0, match.index).trim(), heights: text.slice(match.index + match[0].length).trim() };
}

export default function DimensionText({ text, inlineHeights = false }: { text: string; inlineHeights?: boolean }) {
  if (!/\b(?:cm|mm|in)\b/i.test(text)) return <>{text}</>;
  const { dim, qual } = splitDimensionQualifier(text);
  const [metric, suppliedImperial] = dim.split(/\s*\|\s*/);
  const imperial = suppliedImperial || toImperialLine(metric);
  const rows = [metric, imperial].filter((line): line is string => Boolean(line));
  return <span className="block" data-dimension-lines>
    {rows.map((row, index) => {
      const { main, heights } = splitDimensionHeights(row);
      return <span key={index} className={index ? "mt-1 block text-xs text-muted-foreground" : "block"}>
        {inlineHeights ? <span className="block">
          <span className="whitespace-nowrap">{main}</span>
          {heights && <span className="whitespace-nowrap">{` / ${heights}`}</span>}
        </span> : <>
          <span className="block whitespace-normal break-words">{main}</span>
          {heights && <span className="block whitespace-normal break-words">{heights}</span>}
        </>}
      </span>;
    })}
    {qual && <span className="mt-1 block text-xs text-muted-foreground">{qual}</span>}
  </span>;
}