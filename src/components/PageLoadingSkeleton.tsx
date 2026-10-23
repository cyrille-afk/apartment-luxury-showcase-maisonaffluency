import { DotCircleLoader } from "@/components/ui/dot-circle-loader";

const PageLoadingSkeleton = () => (
  <div data-trade-page-loading role="status" aria-label="Loading page" className="min-h-screen bg-background flex items-center justify-center">
    <DotCircleLoader size="lg" />
  </div>
);

export default PageLoadingSkeleton;
