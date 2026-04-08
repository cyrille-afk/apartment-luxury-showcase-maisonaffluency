const PageLoadingSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-5 h-5 border border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
  </div>
);

export default PageLoadingSkeleton;
