import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LegendDisclosureProps {
  icon: ReactNode;
  /** Raw legend text from the editor. First line ending with ":" is used as
   *  the trigger label; remaining lines render as the disclosed body. */
  text: string;
  /** Fallback trigger label when the text has no header line. */
  fallbackLabel?: string;
  defaultOpen?: boolean;
}

/**
 * Collapsible legend row matching ExpandableSpec's hairline-divider styling.
 * Used to render the product legend (e.g. "Technical Specs: …") as a
 * dropdown-style disclosure on the product page.
 */
export default function LegendDisclosure({
  icon,
  text,
  fallbackLabel = "Technical Specs",
  defaultOpen = false,
}: LegendDisclosureProps) {
  const lines = text.split("\n").map((l) => l.trim());
  // Find header line: first non-empty line that ends with ":"
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    if (/:\s*$/.test(lines[i])) { headerIdx = i; break; }
    break; // first non-empty isn't a header → no header
  }
  const label =
    headerIdx >= 0 ? lines[headerIdx].replace(/:\s*$/, "").trim() : fallbackLabel;
  const bodyLines = (headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines)
    .map((l) => l)
    .reduce<string[]>((acc, l) => {
      // collapse leading empty lines
      if (acc.length === 0 && !l) return acc;
      acc.push(l);
      return acc;
    }, []);
  // Trim trailing empty lines
  while (bodyLines.length && !bodyLines[bodyLines.length - 1]) bodyLines.pop();

  const [open, setOpen] = useState(defaultOpen);

  if (!label && bodyLines.length === 0) return null;

  return (
    <div className="border-b border-border/60 first:border-t">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-5 w-full py-4 text-left",
          "font-body text-sm text-foreground font-medium",
          "focus:outline-none focus-visible:ring-0",
          "hover:text-foreground transition-colors"
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 min-w-0 whitespace-normal break-words leading-relaxed">
          {label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && bodyLines.length > 0 && (
        <div className="pb-4 pl-[44px] pr-2 flex flex-col gap-1">
          {bodyLines.map((line, i) => (
            <p
              key={i}
              className={cn(
                "font-body text-sm leading-relaxed",
                line ? "text-muted-foreground" : "h-2"
              )}
            >
              {line || "\u00A0"}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
