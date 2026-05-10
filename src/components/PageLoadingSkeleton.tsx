import { DotCircleLoader } from "@/components/ui/dot-circle-loader";

const PageLoadingSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <DotCircleLoader size="lg" />
  </div>
);

export default PageLoadingSkeleton;
