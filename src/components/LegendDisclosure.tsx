import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { parseTechnicalSpecs } from "@/lib/technicalSpecs";

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
  const { label, bodyLines, collapsible } = parseTechnicalSpecs(text, fallbackLabel);
  void icon;

  const [open, setOpen] = useState(defaultOpen);

  if (!label && bodyLines.length === 0) return null;

  return (
    <div className="border-b border-border/60">
      {collapsible ? <Button
        variant="ghost"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-start w-full h-auto px-0 rounded-none py-2.5 md:py-4 text-left hover:bg-transparent",
          "font-body text-sm text-foreground font-medium",
          "focus:outline-hidden focus-visible:ring-0",
          "hover:text-foreground transition-colors"
        )}
      >
        <span className="flex-1 min-w-0 whitespace-normal break-words leading-relaxed">
          {label}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
            open && "rotate-90"
          )}
        />
      </Button> : (
        <p className="py-2.5 md:py-4 font-body text-sm text-foreground font-medium">{label}</p>
      )}
      {(!collapsible || open) && bodyLines.length > 0 && (
        <div className="pb-3 md:pb-4 pr-2 flex flex-col gap-1">
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
