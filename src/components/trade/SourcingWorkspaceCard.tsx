import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { FileDown, Lock, Repeat, Box } from "lucide-react";

export interface FinishSwatch {
  id: string;
  label: string;
  /** CSS color/gradient for the swatch chip */
  swatch: string;
}

export interface SpecRow {
  label: string;
  value: string;
}

export interface SourcingWorkspaceCardProps {
  brandLabel: string; // e.g. "MAN OF PARTS"
  productName: string; // e.g. "Rua Leblon Lounge Chair"
  /** Optional preview image; when absent shows a 3D placeholder */
  previewUrl?: string | null;
  finishes: FinishSwatch[];
  activeFinishId?: string;
  onFinishChange?: (id: string) => void;
  specs: SpecRow[];
  locked?: boolean;
  onToggleLock?: () => void;
  onSwap?: () => void;
  onGenerateTearsheet?: () => void;
  className?: string;
}

const LABEL = "font-body text-[10px] uppercase tracking-[0.16em] text-neutral-500";

export const SourcingWorkspaceCard: React.FC<SourcingWorkspaceCardProps> = ({
  brandLabel,
  productName,
  previewUrl,
  finishes,
  activeFinishId,
  onFinishChange,
  specs,
  locked = false,
  onToggleLock,
  onSwap,
  onGenerateTearsheet,
  className,
}) => {
  const [internalActive, setInternalActive] = useState<string | undefined>(
    activeFinishId ?? finishes[0]?.id
  );
  const active = activeFinishId ?? internalActive;

  const handleFinish = (id: string) => {
    setInternalActive(id);
    onFinishChange?.(id);
  };

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-[#EDE7DC] bg-[#FAF9F6] overflow-hidden",
        "shadow-[0_1px_2px_rgba(60,50,35,0.04)]",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-[#EFE9DE]">
        <div className={LABEL}>{brandLabel}</div>
        <div className="mt-0.5 font-display text-[15px] leading-tight text-neutral-900">
          {productName}
        </div>
      </div>

      {/* Preview + finishes */}
      <div className="grid grid-cols-[1fr_auto] gap-3 p-4">
        {/* 3D placeholder window */}
        <div className="relative aspect-[4/3] rounded-md border border-[#E8E1D3] bg-[#F3EEE3] overflow-hidden">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={productName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-neutral-400">
              <Box size={22} strokeWidth={1.25} />
              <span className={LABEL}>3D Preview</span>
            </div>
          )}
          {/* subtle grain */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-multiply"
            style={{
              backgroundImage:
                "radial-gradient(rgba(60,45,25,0.6) 1px, transparent 1px)",
              backgroundSize: "3px 3px",
            }}
          />
          <div className="absolute top-2 left-2">
            <span className={cn(LABEL, "bg-[#FAF9F6]/80 px-1.5 py-0.5 rounded-sm")}>
              Current Selection
            </span>
          </div>
        </div>

        {/* Finish swatches column */}
        <div className="flex flex-col gap-1.5 w-14">
          {finishes.map((f) => {
            const isActive = f.id === active;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFinish(f.id)}
                title={f.label}
                aria-label={f.label}
                aria-pressed={isActive}
                className={cn(
                  "group relative h-11 w-full rounded-md border overflow-hidden transition-all",
                  isActive
                    ? "border-neutral-900 ring-1 ring-neutral-900/10"
                    : "border-[#E8E1D3] hover:border-neutral-400"
                )}
              >
                <span
                  className="absolute inset-0"
                  style={{ background: f.swatch }}
                />
                <span className="sr-only">{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Specs */}
      <div className="mx-4 mb-4 rounded-md border border-[#EFE9DE] bg-white/60">
        <div className="px-3 py-2 border-b border-[#EFE9DE]">
          <span className={LABEL}>Specification</span>
        </div>
        <dl className="divide-y divide-[#F1ECE0]">
          {specs.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 px-3 py-1.5"
            >
              <dt className="font-body text-[11px] text-neutral-500">
                {row.label}
              </dt>
              <dd className="font-body text-[12px] text-neutral-800 text-right">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Action bar */}
      <div className="flex items-stretch gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={onGenerateTearsheet}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2",
            "bg-neutral-900 text-[#FAF9F6] font-body text-[10px] uppercase tracking-[0.16em]",
            "hover:bg-neutral-800 transition-colors"
          )}
        >
          <FileDown size={12} />
          Generate Tearsheet
        </button>

        <button
          type="button"
          onClick={onToggleLock}
          aria-pressed={locked}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 border font-body text-[10px] uppercase tracking-[0.16em] transition-colors",
            locked
              ? "bg-[#E9DFC8] border-[#D9CBAA] text-neutral-900"
              : "bg-white border-[#E8E1D3] text-neutral-700 hover:bg-[#F5F0E4]"
          )}
        >
          <Lock size={12} />
          {locked ? "Locked" : "Lock"}
        </button>

        <button
          type="button"
          onClick={onSwap}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 border font-body text-[10px] uppercase tracking-[0.16em]",
            "bg-white border-[#E8E1D3] text-neutral-700 hover:bg-[#F5F0E4] transition-colors"
          )}
        >
          <Repeat size={12} />
          Swap
        </button>
      </div>
    </div>
  );
};

export default SourcingWorkspaceCard;
