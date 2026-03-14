import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const isTradePath = location.pathname.startsWith("/trade");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <Helmet>
        <title>Page Not Found — Maison Affluency</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <p className="font-body text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">Page Not Found</p>
      <h1 className="font-display text-6xl md:text-8xl text-foreground mb-6">404</h1>
      <p className="font-body text-sm md:text-base text-muted-foreground max-w-md leading-relaxed mb-10">
        The page you're looking for doesn't exist or has been moved. Let us guide you back.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-7 py-3 bg-foreground text-background font-body text-xs uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Maison Affluency
        </Link>
        <Link
          to={isTradePath ? "/trade/login" : "/trade/program"}
          className="inline-flex items-center px-7 py-3 border border-border font-body text-xs uppercase tracking-[0.2em] rounded-full text-foreground hover:bg-muted transition-colors"
        >
          {isTradePath ? "Trade Sign In" : "Trade Program"}
        </Link>
      </div>

      <p className="font-body text-xs text-muted-foreground mt-16">
        Questions?{" "}
        <a href="mailto:concierge@myaffluency.com" className="underline underline-offset-4 hover:text-foreground transition-colors">
          concierge@myaffluency.com
        </a>
      </p>
    </div>
  );
};

export default NotFound;
