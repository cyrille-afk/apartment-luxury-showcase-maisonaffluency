import { useAuth } from "@/hooks/useAuth";
import { Image, FileText, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";

const quickLinks = [
  { title: "Browse Gallery", description: "View our full collection with trade pricing", icon: Image, to: "/trade/gallery" },
  { title: "Quote Builder", description: "Create branded quotes for your clients", icon: FileText, to: "/trade/quotes" },
  { title: "Documents", description: "Access catalogues, inventory & spec sheets", icon: FolderOpen, to: "/trade/documents" },
];

const TradeDashboard = () => {
  const { profile } = useAuth();

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl text-foreground">
          Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="font-body text-sm text-muted-foreground mt-2">
          {profile?.company && <span>{profile.company} · </span>}
          Your trade dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group border border-border rounded-lg p-6 hover:border-foreground/20 hover:shadow-sm transition-all"
          >
            <link.icon className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors mb-4" />
            <h3 className="font-display text-base text-foreground mb-1">{link.title}</h3>
            <p className="font-body text-xs text-muted-foreground">{link.description}</p>
          </Link>
        ))}
      </div>

      {/* Placeholder sections for future phases */}
      <div className="mt-12 border border-dashed border-border rounded-lg p-8 text-center">
        <p className="font-body text-sm text-muted-foreground">
          More features coming soon — trade pricing, downloadable quotes, and document library.
        </p>
      </div>
    </div>
  );
};

export default TradeDashboard;
