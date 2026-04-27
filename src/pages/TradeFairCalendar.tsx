/**
 * /trade/calendar — curated showroom & trade fair calendar.
 * Read-only for trade users; admin-managed via Supabase.
 * Each event includes website link + .ics download.
 */
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2, CalendarDays, MapPin, ExternalLink, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadIcs } from "@/lib/icsCalendar";

type FairEvent = {
  id: string;
  name: string;
  slug: string;
  category: string;
  city: string | null;
  country: string | null;
  venue: string | null;
  starts_on: string;
  ends_on: string;
  website_url: string | null;
  description: string | null;
};

const formatRange = (start: string, end: string) => {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const monthFmt: Intl.DateTimeFormatOptions = { month: "short" };
  const yearFmt: Intl.DateTimeFormatOptions = { year: "numeric" };
  if (sameMonth) {
    return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString(undefined, monthFmt)} ${s.toLocaleDateString(undefined, yearFmt)}`;
  }
  return `${s.getDate()} ${s.toLocaleDateString(undefined, monthFmt)} – ${e.getDate()} ${e.toLocaleDateString(undefined, monthFmt)} ${e.toLocaleDateString(undefined, yearFmt)}`;
};

export default function TradeFairCalendar() {
  const [events, setEvents] = useState<FairEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("trade_fair_events")
        .select("id, name, slug, category, city, country, venue, starts_on, ends_on, website_url, description")
        .eq("is_published", true)
        .order("starts_on", { ascending: true });
      if (!error && data) setEvents(data as FairEvent[]);
      setLoading(false);
    })();
  }, []);

  const [cityFilter, setCityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { cityOptions, categoryOptions } = useMemo(() => {
    const cities = new Set<string>();
    const categories = new Set<string>();
    events.forEach((e) => {
      if (e.city) cities.add(e.city);
      if (e.category) categories.add(e.category);
    });
    return {
      cityOptions: Array.from(cities).sort((a, b) => a.localeCompare(b)),
      categoryOptions: Array.from(categories).sort((a, b) => a.localeCompare(b)),
    };
  }, [events]);

  const grouped = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const filtered = events.filter((e) => {
      if (cityFilter !== "all" && e.city !== cityFilter) return false;
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      return true;
    });
    return {
      upcoming: filtered.filter((e) => e.ends_on >= today),
      past: filtered.filter((e) => e.ends_on < today),
      totalFiltered: filtered.length,
    };
  }, [events, cityFilter, categoryFilter]);

  const hasActiveFilters = cityFilter !== "all" || categoryFilter !== "all";

  return (
    <>
      <Helmet><title>Showroom & Trade Fair Calendar — Trade Portal</title></Helmet>
      <div className="max-w-5xl space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <CalendarDays className="h-4 w-4 text-foreground" />
            <span className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Concierge
            </span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">
            Showroom & Trade Fair Calendar
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-1.5 max-w-2xl">
            Salone, Maison&Objet, PAD, Design Miami — every key date for collectible design. Add any event to your personal calendar.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {events.length > 0 && (
              <div className="flex flex-wrap items-end gap-3 pb-2 border-b border-border">
                <div className="flex flex-col gap-1.5">
                  <label className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    City
                  </label>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="bg-background border border-border rounded-md px-3 py-2 font-body text-xs text-foreground focus:outline-none focus:border-foreground/40 min-w-[160px]"
                  >
                    <option value="all">All cities</option>
                    {cityOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-background border border-border rounded-md px-3 py-2 font-body text-xs text-foreground focus:outline-none focus:border-foreground/40 min-w-[160px] capitalize"
                  >
                    <option value="all">All categories</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c} className="capitalize">{c.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={() => { setCityFilter("all"); setCategoryFilter("all"); }}
                    className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground px-3 py-2 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
                <div className="ml-auto font-body text-xs text-muted-foreground">
                  {grouped.totalFiltered} of {events.length} event{events.length === 1 ? "" : "s"}
                </div>
              </div>
            )}
            {grouped.upcoming.length > 0 && (
              <Section title="Upcoming" events={grouped.upcoming} />
            )}
            {grouped.past.length > 0 && (
              <Section title="Past Events" events={grouped.past} muted />
            )}
            {events.length === 0 && (
              <div className="text-center py-20 border border-dashed border-border rounded-lg">
                <p className="font-body text-sm text-muted-foreground">No events published yet.</p>
              </div>
            )}
            {events.length > 0 && grouped.totalFiltered === 0 && (
              <div className="text-center py-16 border border-dashed border-border rounded-lg">
                <p className="font-body text-sm text-muted-foreground">No events match your filters.</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  events,
  muted,
}: {
  title: string;
  events: FairEvent[];
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground mb-4">
        {title}
      </h2>
      <div className={`space-y-3 ${muted ? "opacity-70" : ""}`}>
        {events.map((e) => (
          <article key={e.id} className="border border-border rounded-lg p-4 md:p-5 bg-background hover:border-foreground/20 transition-colors">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base md:text-lg text-foreground tracking-wide">
                  {e.name}
                </h3>
                <div className="flex items-center gap-3 flex-wrap mt-1.5 font-body text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatRange(e.starts_on, e.ends_on)}
                  </span>
                  {(e.city || e.country) && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {[e.city, e.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
                {e.venue && (
                  <p className="font-body text-xs text-muted-foreground/80 mt-1">{e.venue}</p>
                )}
                {e.description && (
                  <p className="font-body text-sm text-foreground/80 mt-3 leading-relaxed">
                    {e.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() =>
                    downloadIcs(
                      {
                        uid: e.id,
                        title: e.name,
                        starts_on: e.starts_on,
                        ends_on: e.ends_on,
                        location: [e.venue, e.city, e.country].filter(Boolean).join(", "),
                        description: e.description || undefined,
                        url: e.website_url || undefined,
                      },
                      `${e.slug}.ics`,
                    )
                  }
                  className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-md font-body text-[11px] uppercase tracking-[0.12em] text-foreground hover:bg-muted transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  .ics
                </button>
                {e.website_url && (
                  <a
                    href={e.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-md font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Site
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
