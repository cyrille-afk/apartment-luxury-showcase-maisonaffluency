import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart3, ExternalLink, Globe, Instagram, Mail, MapPin } from "lucide-react";
import { logStudioEvent, type StudioCtaKind } from "@/lib/leadTracking";

type Studio = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  bio: string | null;
  founded_year: number | null;
  team_size: string | null;
  location: string | null;
  country: string | null;
  website_url: string | null;
  contact_email: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  gallery_images: string[];
  disciplines: string[];
  project_types: string[];
  notable_projects: string | null;
  is_featured: boolean;
  owner_user_id: string | null;
};

const LABELS: Record<string, string> = {
  architecture: "Architecture",
  interior_design: "Interior Design",
  landscape: "Landscape",
  lighting_design: "Lighting Design",
  bespoke_joinery: "Bespoke Joinery",
  residential: "Residential",
  hospitality: "Hospitality",
  retail: "Retail",
  yacht: "Yacht",
  office: "Office",
};

export default function StudioProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAdmin } = useAuth();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("featured_studios")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setStudio(data as Studio);
        logStudioEvent({ studioId: data.id, eventType: "profile_view" });
      }
      setLoading(false);
    })();
  }, [slug]);

  const canViewInsights =
    !!studio && (isAdmin || (!!user && studio.owner_user_id === user.id));

  const trackCta = (kind: StudioCtaKind) => {
    if (studio?.id) {
      logStudioEvent({ studioId: studio.id, eventType: "cta_click", ctaKind: kind });
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-6 py-12 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="aspect-[16/8] w-full" />
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </main>
    );
  }

  if (notFound || !studio) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-3xl text-foreground">Studio not found</p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/studios">Back to directory</Link>
          </Button>
        </div>
      </main>
    );
  }

  const igHandle = studio.instagram_handle?.replace(/^@/, "");
  const igUrl = igHandle ? `https://instagram.com/${igHandle}` : null;

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>{studio.name} | Featured Studio — Maison Affluency</title>
        <meta name="description" content={studio.tagline || studio.bio?.slice(0, 155) || `${studio.name} — featured studio on Maison Affluency.`} />
        <link rel="canonical" href={`https://www.maisonaffluency.com/studios/${studio.slug}`} />
        <meta property="og:title" content={`${studio.name} | Maison Affluency`} />
        {studio.hero_image_url && <meta property="og:image" content={studio.hero_image_url} />}
      </Helmet>

      {/* Back + insights (owner/admin only) */}
      <div className="mx-auto max-w-6xl px-6 pt-8 flex items-center justify-between gap-4">
        <Link
          to="/studios"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to directory
        </Link>
        {canViewInsights && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/studios/${studio.slug}/insights`}>
              <BarChart3 className="h-3.5 w-3.5 mr-2" /> Insights
            </Link>
          </Button>
        )}
      </div>

      {/* Hero */}
      {studio.hero_image_url && (
        <div className="mx-auto max-w-6xl px-6 mt-6">
          <div className="aspect-[16/8] overflow-hidden bg-muted">
            <img
              src={studio.hero_image_url}
              alt={studio.name}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <section className="mx-auto max-w-6xl px-6 mt-10 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Featured Studio
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-foreground">
            {studio.name}
          </h1>
          {studio.tagline && (
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              {studio.tagline}
            </p>
          )}

          {studio.bio && (
            <div className="mt-8 prose prose-neutral max-w-none">
              {studio.bio.split("\n\n").map((p, i) => (
                <p key={i} className="text-base leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}
            </div>
          )}

          {studio.notable_projects && (
            <div className="mt-10">
              <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">
                Notable projects
              </h2>
              <p className="text-base leading-relaxed text-foreground/90 whitespace-pre-line">
                {studio.notable_projects}
              </p>
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="space-y-6 md:border-l md:border-border md:pl-10">
          {studio.logo_url && (
            <div className="h-20 flex items-start">
              <img
                src={studio.logo_url}
                alt={`${studio.name} logo`}
                className="max-h-20 object-contain"
              />
            </div>
          )}

          <dl className="space-y-3 text-sm">
            {(studio.location || studio.country) && (
              <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Based in">
                {[studio.location, studio.country].filter(Boolean).join(", ")}
              </Row>
            )}
            {studio.founded_year && (
              <Row label="Founded">{studio.founded_year}</Row>
            )}
            {studio.team_size && <Row label="Team">{studio.team_size}</Row>}
          </dl>

          {studio.disciplines.length > 0 && (
            <TagGroup title="Disciplines" items={studio.disciplines} />
          )}
          {studio.project_types.length > 0 && (
            <TagGroup title="Project types" items={studio.project_types} />
          )}

          <div className="space-y-2 pt-2">
            {studio.website_url && (
              <Button asChild variant="outline" className="w-full justify-between">
                <a
                  href={studio.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackCta("website")}
                >
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Website
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {igUrl && (
              <Button asChild variant="outline" className="w-full justify-between">
                <a
                  href={igUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackCta("instagram")}
                >
                  <span className="flex items-center gap-2">
                    <Instagram className="h-4 w-4" /> @{igHandle}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {studio.contact_email && (
              <Button asChild className="w-full justify-between">
                <a
                  href={`mailto:${studio.contact_email}`}
                  onClick={() => trackCta("email")}
                >
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Contact studio
                  </span>
                </a>
              </Button>
            )}
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-xs text-muted-foreground mb-2">
              Specifying for a client project?
            </p>
            <Button asChild variant="secondary" size="sm" className="w-full">
              <Link to="/trade-program">Apply for trade access</Link>
            </Button>
          </div>
        </aside>
      </section>

      {/* Gallery */}
      {studio.gallery_images?.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 mt-16 mb-20">
          <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-6">
            Selected work
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {studio.gallery_images.map((src, i) => (
              <div key={i} className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={src}
                  alt={`${studio.name} — project ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Row({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-foreground">{children}</dd>
    </div>
  );
}

function TagGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => (
          <span
            key={v}
            className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border text-foreground"
          >
            {LABELS[v] ?? v}
          </span>
        ))}
      </div>
    </div>
  );
}
