import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, Mail, MapPin } from "lucide-react";
import { logStudioEvent } from "@/lib/leadTracking";
import { useAuth } from "@/hooks/useAuth";

type Studio = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  bio: string | null;
  location: string | null;
  country: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  disciplines: string[];
  project_types: string[];
  is_featured: boolean;
};

const DISCIPLINES: { value: string; label: string }[] = [
  { value: "architecture", label: "Architecture" },
  { value: "interior_design", label: "Interior Design" },
  { value: "landscape", label: "Landscape" },
  { value: "lighting_design", label: "Lighting Design" },
  { value: "bespoke_joinery", label: "Bespoke Joinery" },
];

const PROJECT_TYPES: { value: string; label: string }[] = [
  { value: "residential", label: "Residential" },
  { value: "hospitality", label: "Hospitality" },
  { value: "retail", label: "Retail" },
  { value: "yacht", label: "Yacht" },
  { value: "office", label: "Office" },
];

const labelOf = (list: { value: string; label: string }[], v: string) =>
  list.find((x) => x.value === v)?.label ?? v;

export default function Studios() {
  const { user, loading: authLoading } = useAuth();
  const isAuthed = !!user;
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [discipline, setDiscipline] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("featured_studios_public")
        .select(
          "id, slug, name, tagline, bio, location, country, logo_url, hero_image_url, disciplines, project_types, is_featured"
        )
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (!error && data) setStudios(data as Studio[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return studios.filter((s) => {
      if (discipline && !s.disciplines.includes(discipline)) return false;
      if (projectType && !s.project_types.includes(projectType)) return false;
      return true;
    });
  }, [studios, discipline, projectType]);

  // Log filter usage (debounced) — one event per matching studio so each
  // owner sees how often visitors discover them via a given filter.
  const filterTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!discipline && !projectType) return;
    if (filterTimer.current) window.clearTimeout(filterTimer.current);
    filterTimer.current = window.setTimeout(() => {
      const matches = filtered.slice(0, 24); // safety cap
      for (const s of matches) {
        if (discipline) {
          logStudioEvent({
            studioId: s.id,
            eventType: "filter_applied",
            filterKey: "discipline",
            filterValue: discipline,
          });
        }
        if (projectType) {
          logStudioEvent({
            studioId: s.id,
            eventType: "filter_applied",
            filterKey: "project_type",
            filterValue: projectType,
          });
        }
      }
    }, 700);
    return () => {
      if (filterTimer.current) window.clearTimeout(filterTimer.current);
    };
  }, [discipline, projectType, filtered]);

  // Dynamic SEO based on active filters + result set
  const disciplineLabel = discipline ? labelOf(DISCIPLINES, discipline) : null;
  const projectTypeLabel = projectType ? labelOf(PROJECT_TYPES, projectType) : null;

  const seoTitle = (() => {
    // Hard cap 60 chars
    if (disciplineLabel && projectTypeLabel)
      return `${disciplineLabel} Studios for ${projectTypeLabel} | Maison Affluency`.slice(0, 60);
    if (disciplineLabel)
      return `${disciplineLabel} Studios — Maison Affluency`.slice(0, 60);
    if (projectTypeLabel)
      return `${projectTypeLabel} Studios — Maison Affluency`.slice(0, 60);
    return "Featured Architects & Designers — Maison Affluency";
  })();

  const seoDescription = (() => {
    const count = filtered.length;
    const base =
      "A curated directory of architecture and interior design studios partnering with Maison Affluency on residential, hospitality and bespoke commissions.";
    if (loading) return base;
    if (disciplineLabel && projectTypeLabel)
      return `Discover ${count} ${disciplineLabel.toLowerCase()} studio${count === 1 ? "" : "s"} working on ${projectTypeLabel.toLowerCase()} projects with Maison Affluency. Filter by discipline and project type.`;
    if (disciplineLabel)
      return `Browse ${count} ${disciplineLabel.toLowerCase()} stud${count === 1 ? "io" : "ios"} featured by Maison Affluency. Curated practices for residential, hospitality and bespoke commissions.`;
    if (projectTypeLabel)
      return `Find studios specialising in ${projectTypeLabel.toLowerCase()} projects — ${count} curated practice${count === 1 ? "" : "s"} on Maison Affluency.`;
    return base;
  })();

  const canonical = "https://maisonaffluency.com/studios";
  const ogImage =
    studios.find((s) => s.is_featured && s.hero_image_url)?.hero_image_url ||
    studios.find((s) => s.hero_image_url)?.hero_image_url ||
    "https://www.maisonaffluency.com/og-default.jpg";

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Featured Studios — Maison Affluency",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: filtered.length,
    itemListElement: filtered.slice(0, 30).map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://www.maisonaffluency.com/studios/${s.slug}`,
      name: s.name,
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.maisonaffluency.com/" },
      { "@type": "ListItem", position: 2, name: "Studios", item: canonical },
    ],
  };

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="en" href={canonical} />
        <link rel="alternate" hrefLang="x-default" href={canonical} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={ogImage} />

        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {!loading && filtered.length > 0 && isAuthed && (
          <script type="application/ld+json">{JSON.stringify(itemListSchema)}</script>
        )}
      </Helmet>


      {/* Hero */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Maison Affluency
          </Link>
          <p className="mb-4 text-xs uppercase tracking-[0.25em] text-muted-foreground">
            The Directory
          </p>
          <h1 className="font-display text-4xl md:text-6xl text-foreground leading-tight">
            Featured Studios
          </h1>
          <p className="mt-6 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
            A curated selection of architecture and interior design practices we
            collaborate with on residential, hospitality and bespoke commissions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/contact">Request an introduction</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/studios/submit">Submit your studio</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
          <FilterRow
            label="Discipline"
            value={discipline}
            onChange={setDiscipline}
            options={DISCIPLINES}
          />
          <FilterRow
            label="Project type"
            value={projectType}
            onChange={setProjectType}
            options={PROJECT_TYPES}
          />
        </div>
      </section>

      {/* Concierge intro banner (logged-out only) */}
      {!authLoading && !isAuthed && (
        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              Introductions to our featured studios are arranged privately through our concierge.
            </p>
            <Button asChild size="sm">
              <Link to="/contact?subject=studio-introduction">Request an introduction</Link>
            </Button>
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-display text-2xl text-foreground">No studios match these filters yet.</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Try clearing a filter, or check back soon — the directory grows weekly.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => {
                setDiscipline(null);
                setProjectType(null);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((s) => (
              <StudioCard key={s.id} studio={s} isAuthed={isAuthed} />
            ))}
          </div>
        )}
      </section>

      {/* Explore the rest of Maison Affluency — internal link equity */}
      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Explore further
          </p>
          <h2 className="font-display text-2xl md:text-3xl text-foreground mb-6">
            Beyond the studios directory
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
            <li><Link to="/designers" className="text-foreground hover:underline">Represented designers A–Z</Link> <span className="text-muted-foreground">— atelier-level makers we represent.</span></li>
            <li><Link to="/collectibles" className="text-foreground hover:underline">Collectible furniture</Link> <span className="text-muted-foreground">— curated edit of signed pieces.</span></li>
            <li><Link to="/new-in" className="text-foreground hover:underline">New arrivals</Link> <span className="text-muted-foreground">— latest additions to the catalogue.</span></li>
            <li><Link to="/gallery" className="text-foreground hover:underline">Showroom gallery</Link> <span className="text-muted-foreground">— pieces in situ.</span></li>
            <li><Link to="/journal" className="text-foreground hover:underline">Journal</Link> <span className="text-muted-foreground">— essays on craft and provenance.</span></li>
            <li><Link to="/apartment-tour" className="text-foreground hover:underline">Private apartment tour</Link> <span className="text-muted-foreground">— a realised Singapore commission.</span></li>
            <li><Link to="/trade-program" className="text-foreground hover:underline">Trade programme</Link> <span className="text-muted-foreground">— net pricing for studios.</span></li>
            <li><Link to="/studios/submit" className="text-foreground hover:underline">Submit your studio</Link> <span className="text-muted-foreground">— join the directory.</span></li>
            <li><Link to="/contact" className="text-foreground hover:underline">Contact</Link> <span className="text-muted-foreground">— start a private commission.</span></li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function FilterRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`text-xs px-3 py-1.5 border transition-colors ${
          value === null
            ? "bg-foreground text-background border-foreground"
            : "border-border text-foreground hover:border-foreground"
        }`}
      >
        All
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(value === o.value ? null : o.value)}
          className={`text-xs px-3 py-1.5 border transition-colors ${
            value === o.value
              ? "bg-foreground text-background border-foreground"
              : "border-border text-foreground hover:border-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StudioCard({ studio, isAuthed }: { studio: Studio; isAuthed: boolean }) {
  const displayName = isAuthed ? studio.name : "Featured Studio";
  const inner = (
    <>
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        {studio.hero_image_url ? (
          <img
            src={studio.hero_image_url}
            alt={displayName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            {displayName}
          </div>
        )}
        {studio.is_featured && (
          <Badge className="absolute top-3 left-3 bg-background/90 text-foreground border-border">
            Featured
          </Badge>
        )}
        {!isAuthed && (
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-background/70 via-transparent to-transparent">
            <div className="w-full p-4 text-xs uppercase tracking-[0.2em] text-foreground inline-flex items-center gap-2">
              <Mail className="h-3 w-3" />
              Introduction by concierge
            </div>
          </div>
        )}
      </div>
      <div className="p-5">
        <h2 className="font-display text-xl text-foreground">{displayName}</h2>
        {isAuthed && studio.tagline && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{studio.tagline}</p>
        )}
        {(studio.location || studio.country) && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {[studio.location, studio.country].filter(Boolean).join(", ")}
          </p>
        )}
        {studio.disciplines.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {studio.disciplines.slice(0, 3).map((d) => (
              <span
                key={d}
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border text-muted-foreground"
              >
                {labelOf(DISCIPLINES, d)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-5 flex items-center text-xs uppercase tracking-[0.2em] text-foreground">
          {isAuthed ? "View profile" : "Request an introduction"}
          <ArrowRight className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </>
  );

  if (!isAuthed) {
    const locationLine = [studio.location, studio.country].filter(Boolean).join(", ");
    const disciplineLine = studio.disciplines
      .slice(0, 3)
      .map((d) => labelOf(DISCIPLINES, d))
      .filter(Boolean)
      .join(", ");
    const subject = `Introduction request — ${studio.name}`;
    const messageLines = [
      `I would like to be introduced to ${studio.name} via the Maison Affluency concierge.`,
      "",
      `Studio: ${studio.name}`,
      locationLine ? `Based in: ${locationLine}` : null,
      disciplineLine ? `Discipline: ${disciplineLine}` : null,
      studio.tagline ? `Listing note: ${studio.tagline}` : null,
      "",
      "Please share a little about my project below:",
      "",
    ].filter(Boolean);
    const params = new URLSearchParams({
      subject,
      message: messageLines.join("\n"),
      studio: studio.id,
    });
    return (
      <Link
        to={`/contact?${params.toString()}`}
        onClick={() =>
          logStudioEvent({ studioId: studio.id, eventType: "directory_card_click" })
        }
        className="group block bg-card border border-border hover:border-foreground/30 transition-colors"
      >
        {inner}
      </Link>
    );
  }

  return (
    <Link
      to={`/studios/${studio.slug}`}
      onClick={() =>
        logStudioEvent({ studioId: studio.id, eventType: "directory_card_click" })
      }
      className="group block bg-card border border-border hover:border-foreground/30 transition-colors"
    >
      {inner}
    </Link>
  );
}
