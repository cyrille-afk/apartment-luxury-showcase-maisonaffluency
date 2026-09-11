import React from 'react';

export function OrderSummarySkeleton({ isLoading, children }: { isLoading: boolean; children: React.ReactNode }) {
  // If the asynchronous API data parsing is complete, reveal real interactive features seamlessly
  if (!isLoading) return <>{children}</>;

  return (
    <div className="w-full max-w-sm mx-auto bg-white border border-zinc-100 p-6 space-y-6 font-sans antialiased animate-pulse">
      {/* 1. Header Placement Placeholder */}
      <div className="border-b border-zinc-100 pb-4">
        <div className="h-3 bg-zinc-200 w-24 rounded-sm mb-2 uppercase tracking-widest" />
        <div className="space-y-2 mt-4">
          <div className="flex justify-between items-center">
            <div className="h-4 bg-zinc-200 w-44 rounded-sm" />
            <div className="h-4 bg-zinc-200 w-16 rounded-sm" />
          </div>
          <div className="h-3 bg-zinc-100 w-32 rounded-sm" />
        </div>
      </div>

      {/* 2. Structured Line Items Shimmer Matrix */}
      <div className="space-y-4 border-b border-zinc-100 pb-4">
        {[
          { label: "Subtotal", width: "w-16" },
          { label: "Front Door Premium Delivery", width: "w-20" },
          { label: "Taxes (Import GST / VAT)", width: "w-12" }
        ].map((row, idx) => (
          <div key={idx} className="flex justify-between items-center text-xs">
            <span className="text-zinc-400 font-light">{row.label}</span>
            <div className={`h-3.5 bg-zinc-200/80 rounded-sm ${row.width}`} />
          </div>
        ))}
      </div>

      {/* 3. The Grand Final Total Placement */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-800">Total Due</span>
          <div className="h-5 bg-zinc-300 w-28 rounded-sm" />
        </div>
        <div className="h-3 bg-zinc-100 w-36 rounded-sm mt-1" />
      </div>

      {/* 4. Action CTA Block Shimmer */}
      <div className="w-full bg-zinc-200 h-12 rounded-sm mt-4" />
    </div>
  );
}
