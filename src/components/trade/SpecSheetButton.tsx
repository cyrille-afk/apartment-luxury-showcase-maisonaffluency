/**
 * SpecSheetButton — renders a single PDF link or a dropdown when multiple PDFs exist.
 * Accepts either `pdfUrl` (legacy single) or `pdfUrls` (multi).
 */
import { FileDown, FileText } from "lucide-react";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export type PdfEntry = { label: string; url: string; filename?: string };

interface Props {
  pdfUrl?: string | null;
  pdfUrls?: PdfEntry[] | null;
  brandName: string;
  productName: string;
  /** Visual variant */
  variant?: "icon" | "button";
  /** Called before opening — use for auth gates. Return false to cancel. */
  onBeforeOpen?: () => boolean;
  className?: string;
}

export default function SpecSheetButton({
  pdfUrl,
  pdfUrls,
  brandName,
  productName,
  variant = "icon",
  onBeforeOpen,
  className,
}: Props) {
  // Consolidate into a single list
  const entries: PdfEntry[] = pdfUrls && pdfUrls.length > 0
    ? pdfUrls
    : pdfUrl
      ? [{ label: "Spec Sheet", url: pdfUrl }]
      : [];

  if (entries.length === 0) return null;

  const openPdf = (url: string, label?: string, index?: number) => {
    window.open(buildSpecSheetUrl(url, brandName, productName, label, index), "_blank");
  };

  // Single PDF — direct link
  if (entries.length === 1) {
    const entry = entries[0];

    if (variant === "button") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onBeforeOpen && !onBeforeOpen()) return;
            openPdf(entry.url);
          }}
          className={className || "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border border-[hsl(var(--pdf-red))]/30 text-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/10 hover:border-[hsl(var(--pdf-red))] cursor-pointer"}
        >
          <FileDown size={13} />
          Spec Sheet
        </button>
      );
    }

    return (
      <a
        href={buildSpecSheetUrl(entry.url, brandName, productName)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.stopPropagation();
          if (onBeforeOpen) {
            e.preventDefault();
            if (!onBeforeOpen()) return;
            openPdf(entry.url);
          }
        }}
        className={className || "p-2 bg-[hsl(var(--pdf-red))]/80 rounded-md text-white hover:bg-[hsl(var(--pdf-red))] transition-colors"}
        title="Spec sheet"
      >
        <FileText className="h-3.5 w-3.5" />
      </a>
    );
  }

  // Multiple PDFs — dropdown
  if (variant === "button") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={className || "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border border-[hsl(var(--pdf-red))]/30 text-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/10 hover:border-[hsl(var(--pdf-red))] cursor-pointer"}
          >
            <FileDown size={13} />
            Spec Sheets
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          {entries.map((entry, i) => (
            <DropdownMenuItem
              key={i}
              onClick={() => {
                if (onBeforeOpen && !onBeforeOpen()) return;
                openPdf(entry.url, entry.label);
              }}
              className="flex items-center gap-2 cursor-pointer font-body text-xs"
            >
              <FileDown className="h-3.5 w-3.5 text-[hsl(var(--pdf-red))]" />
              {entry.label || `Spec Sheet ${i + 1}`}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={className || "p-2 bg-[hsl(var(--pdf-red))]/80 rounded-md text-white hover:bg-[hsl(var(--pdf-red))] transition-colors"}
          title="Spec sheets"
        >
          <FileText className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {entries.map((entry, i) => (
          <DropdownMenuItem
            key={i}
            onClick={() => {
              if (onBeforeOpen && !onBeforeOpen()) return;
              openPdf(entry.url, entry.label);
            }}
            className="flex items-center gap-2 cursor-pointer font-body text-xs"
          >
            <FileDown className="h-3.5 w-3.5 text-[hsl(var(--pdf-red))]" />
            {entry.label || `Spec Sheet ${i + 1}`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
