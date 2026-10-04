import { cn } from "@/lib/utils";

/** Editorial wireframe shown while the Interactive Galleries resolve. */
const GallerySkeleton = ({ withHeader = false, className }: { withHeader?: boolean; className?: string }) => (
  <div aria-busy="true" aria-label="Loading galleries" className={cn("w-full animate-pulse", className)}>
    {withHeader && (
      <div className="mb-10 space-y-3">
        <div className="h-8 w-72 max-w-full rounded-sm bg-stone-300" />
        <div className="h-3 w-[28rem] max-w-full rounded-sm bg-stone-200" />
        <div className="mt-8 flex gap-8 border-b border-stone-200 pb-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-3 w-32 rounded-sm bg-stone-200" />)}
        </div>
      </div>
    )}
    <div className="mb-8 space-y-2">
      <div className="h-6 w-56 rounded-sm bg-stone-300" />
      <div className="h-3 w-80 max-w-full rounded-sm bg-stone-200" />
    </div>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-[4/5] w-full rounded-sm bg-stone-200" />
          <div className="h-3 w-2/3 rounded-sm bg-stone-300" />
          <div className="h-2.5 w-1/3 rounded-sm bg-stone-200" />
        </div>
      ))}
    </div>
  </div>
);

export default GallerySkeleton;
