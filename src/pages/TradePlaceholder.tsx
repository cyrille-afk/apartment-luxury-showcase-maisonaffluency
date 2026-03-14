import { useLocation } from "react-router-dom";

const titles: Record<string, { title: string; description: string }> = {
  "/trade/gallery": {
    title: "Trade Gallery",
    description: "Browse our full collection with trade pricing. Coming in Phase 2.",
  },
  "/trade/quotes": {
    title: "Quote Builder",
    description: "Create branded, downloadable quotes with shipping and VAT estimates. Coming in Phase 3.",
  },
  "/trade/documents": {
    title: "Document Library",
    description: "Access catalogues, inventory lists, and spec sheets. Coming in Phase 4.",
  },
  "/trade/settings": {
    title: "Account Settings",
    description: "Manage your trade account details and preferences.",
  },
};

const TradePlaceholder = () => {
  const { pathname } = useLocation();
  const page = titles[pathname] || { title: "Coming Soon", description: "This feature is under development." };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl text-foreground mb-2">{page.title}</h1>
      <p className="font-body text-sm text-muted-foreground mb-8">{page.description}</p>
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <p className="font-body text-sm text-muted-foreground">🚧 Under development</p>
      </div>
    </div>
  );
};

export default TradePlaceholder;
