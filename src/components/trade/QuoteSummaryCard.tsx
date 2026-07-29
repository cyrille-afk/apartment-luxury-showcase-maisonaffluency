import React from "react";
import type { QuoteResult } from "@/hooks/useProjectQuote";

interface QuoteSummaryCardProps {
  loading: boolean;
  data: QuoteResult | null;
  error: string | null;
  onDownloadPdf: () => void;
  onSendToClient: () => void;
}

export const QuoteSummaryCard: React.FC<QuoteSummaryCardProps> = ({
  loading,
  data,
  error,
  onDownloadPdf,
  onSendToClient,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 border border-neutral-200 rounded-sm bg-neutral-50/50">
        <span className="text-sm font-light text-neutral-500 animate-pulse tracking-wide">
          Compiling trade specifications…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-sm bg-red-50 text-xs text-red-600 font-light">
        Error: {error}
      </div>
    );
  }

  if (!data) return null;

  const { meta, pricing_summary } = data;

  return (
    <div className="mt-4 border border-neutral-200 rounded-sm bg-neutral-50/30 overflow-hidden font-sans">
      <div className="p-4 border-b border-neutral-200 bg-neutral-50/80 text-[11px] uppercase tracking-wider text-neutral-500 font-medium space-y-1">
        <div>Project: {meta.location || "—"}</div>
        <div>Shipping Tier: {meta.shipping_tier}</div>
      </div>

      <div className="p-4 space-y-3 border-b border-neutral-100">
        <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
          Sourcing Allocation Preview
        </div>
        {pricing_summary.items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-baseline text-sm text-neutral-800">
            <span className="font-light">{item.item_name}</span>
            <span className="font-medium tracking-tight">
              ${item.discounted_price.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-2 border-b border-neutral-200 bg-neutral-50/20 text-xs text-neutral-600 font-light">
        <div className="flex justify-between">
          <span>White-Glove Shipping &amp; Handling</span>
          <span className="uppercase text-[10px] tracking-wider font-medium text-emerald-600">
            Included
          </span>
        </div>
        <div className="flex justify-between text-neutral-500">
          <span>Regional Trade Discount Applied</span>
          <span className="font-medium">
            −${pricing_summary.trade_discount_applied.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="p-4 flex justify-between items-baseline bg-neutral-50/60 border-b border-neutral-200">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-500">
          Estimated Total Specification
        </span>
        <span className="text-lg font-semibold tracking-tight text-neutral-900">
          ${pricing_summary.estimated_total.toLocaleString()}
        </span>
      </div>

      <div className="p-3 bg-neutral-50/40 flex flex-wrap gap-2 justify-start">
        <button
          onClick={onDownloadPdf}
          className="px-3 py-1.5 border border-neutral-300 rounded-full text-xs font-light text-neutral-700 bg-white hover:bg-neutral-50 transition-colors cursor-pointer"
        >
          Download Official PDF Tear Sheet
        </button>
        <button
          onClick={onSendToClient}
          className="px-3 py-1.5 border border-neutral-300 rounded-full text-xs font-light text-neutral-700 bg-white hover:bg-neutral-50 transition-colors cursor-pointer"
        >
          Send to Client for Approval
        </button>
      </div>
    </div>
  );
};

/**
 * Container that binds the QuoteSummaryCard to the useProjectQuote hook.
 * Renders loading → data or error automatically.
 */
import { useProjectQuote, type QuoteBaseItem } from "@/hooks/useProjectQuote";

export const QuoteSummaryCardContainer: React.FC<{
  projectId: string;
  baseItems: QuoteBaseItem[];
  onDownloadPdf: () => void;
  onSendToClient: () => void;
}> = ({ projectId, baseItems, onDownloadPdf, onSendToClient }) => {
  const { loading, data, error } = useProjectQuote(projectId, baseItems);
  return (
    <QuoteSummaryCard
      loading={loading}
      data={data}
      error={error}
      onDownloadPdf={onDownloadPdf}
      onSendToClient={onSendToClient}
    />
  );
};
