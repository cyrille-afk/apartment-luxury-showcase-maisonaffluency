/**
 * Acquisitions control screen.
 *
 * Enriched studio leads from `acquisition_leads`, ready for a one-click
 * tailored outbound sequence. Admin-only — RLS is the real control, the
 * guard below is convenience.
 */
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ExternalLink, Instagram, Loader2, Mail, Send, ShieldAlert, Sparkles } from "lucide-react";

type Lead = {
  id: string;
  studio_name: string;
  founder_name: string | null;
  business_email: string;
  website_url: string | null;
  source_index: string | null;
  aesthetic_profile: string | null;
  predicted_designer_matches: string[] | null;
  campaign_status: string;
  verified_at: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  created_at: string;
  country: string | null;
  city: string | null;
  instagram_handle: string | null;
  executive_emails: string[] | null;
};

const DEFAULT_COUNTRY = "Singapore";
const DEFAULT_CITY = "Singapore";

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const GENERIC_EMAIL_PREFIXES = new Set([
  "admin",
  "info",
  "contact",
  "hello",
  "support",
  "sales",
  "enquiries",
  "enquiry",
  "inquiries",
  "inquiry",
  "mail",
  "office",
  "team",
  "studio",
  "press",
  "media",
  "marketing",
  "partnerships",
  "reception",
  "general",
  "enquire",
  "service",
  "services",
  "booking",
  "reservations",
  "reservation",
  "frontdesk",
  "front",
  "main",
  "info.sg",
  "enquiries.sg",
  "enquiry.sg",
  "inquiries.sg",
  "inquiry.sg",
]);

// Temporary authoritative handle mapping for the first 44 enriched leads.
// Keys are exact studio_name values from acquisition_leads.
const KNOWN_INSTAGRAM_HANDLES: Record<string, string> = {
  SCDA: "scdaarchitects",
  Elicyon: "elicyon",
  "S.R. Gambrel": "stevengambrel",
  "Ashe Leandro": "asheleandro",
  "Aamer Architects": "aamerarchitects",
  "Albion Nord": "albionnord",
  "Alvisi Kirimoto": "alvisikirimoto",
  "ao-ft": "ao_ft",
  "AR43 Architects": "ar43architects",
  "Archer Humphryes Architects": "archerhumphryes",
  "Architects 61": "architects61",
  Archmongers: "archmongers",
  "Brewin Design Office": "brewindesignoffice",
  "Chris Dyson Architects": "chrisdysonarchitects",
  "Coffey Residential": "coffeyresidential",
  "Common Ground Workshop": "commongroundworkshop",
  "Delve Architects": "delvearchitects",
  "Design Intervention": "designintervention",
  "Formwerkz Architects": "formwerkzarchitects",
  "Found Associates": "foundassociates",
  "Gregory Phillips Architects": "gregoryphillipsarchitects",
  "Guz Architects": "guzarchitects",
  "Hayhurst and Co.": "hayhurstandco",
  "HUT Architecture": "hutarchitecture",
  "HYLA Architects": "hylaarchitects",
  "James Alder Architects": "jamesalderarchitects",
  "Jamie Fobert Architects": "jamiefobertarchitects",
  "Janine Stone & Co": "janinestoneandco",
  "Joya Architects": "joyaarchitects",
  "K2LD Architects": "k2ldarchitects",
  "LA London": "la_london",
  "Ming Architects": "mingarchitects",
  "MOYA Architects": "moyaarchitects",
  "ONG&ONG": "ongong",
  "READ Architecture": "readarchitecture",
  "Red Bean Architects": "redbeanarchitects",
  "Rigby & Rigby": "rigbyandrigby",
  "SHH Architecture & Interior Design": "shh_architecture",
  "Spatial Affairs Bureau": "spatialaffairsbureau",
  "Studio iF": "studioif",
  "Studio Indigo": "studioindigo",
  "Studio McW": "studiomcw",
  "Taylor Howes": "taylorhowes",
  "Treehaus Architects": "treehausarchitects",
  "Unknown Works": "unknown_works",
  "Wallflower Architecture + Design": "wallflowerarchitecture",
  "YARD Architects": "yardarchitects",
};

const isGenericEmail = (email: string): boolean => {
  const local = email.split("@")[0]?.toLowerCase().trim() ?? "";
  return GENERIC_EMAIL_PREFIXES.has(local);
};

const outreachVector = (lead: Lead): "instagram" | "resend" => {
  const directEmails = (lead.executive_emails ?? []).filter((e) => !isGenericEmail(e));
  if (directEmails.length > 0) return "resend";
  if (lead.business_email && !isGenericEmail(lead.business_email)) return "resend";
  return "instagram";
};

const TradeAdminAcquisitions = () => {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && isAdmin;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [exiting, setExiting] = useState<Set<string>>(new Set());
  const [igFirstOnly, setIgFirstOnly] = useState(false);
  const [activeCountry, setActiveCountry] = useState<string>(DEFAULT_COUNTRY);
  const [activeCity, setActiveCity] = useState<string>(DEFAULT_CITY);
  const [calibrating, setCalibrating] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["acquisition-leads", "enriched"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_leads")
        .select(
          "id, studio_name, founder_name, business_email, website_url, source_index, aesthetic_profile, predicted_designer_matches, campaign_status, verified_at, email_sent_at, email_error, created_at, country, city, instagram_handle, executive_emails",
        )
        .eq("campaign_status", "enriched")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    },
  });

  // Geographic model: country → cities, derived from live rows. Rows without
  // geography are grouped under "Unassigned" so nothing is hidden silently.
  const geo = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of rows) {
      const country = r.country?.trim() || "Unassigned";
      const city = r.city?.trim() || r.country?.trim() || "Unassigned";
      if (!map.has(country)) map.set(country, new Set());
      map.get(country)!.add(city);
    }
    const countries = Array.from(map.keys()).sort((a, b) => {
      if (a === DEFAULT_COUNTRY) return -1;
      if (b === DEFAULT_COUNTRY) return 1;
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
    return { map, countries };
  }, [rows]);

  const cities = useMemo(() => {
    const set = geo.map.get(activeCountry);
    return set ? Array.from(set).sort((a, b) => a.localeCompare(b)) : [];
  }, [geo, activeCountry]);

  // Keep the active geography valid as data changes.
  useEffect(() => {
    if (geo.countries.length === 0) return;
    if (!geo.map.has(activeCountry)) {
      setActiveCountry(geo.countries[0]);
      return;
    }
    const set = geo.map.get(activeCountry)!;
    if (!set.has(activeCity)) {
      const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
      setActiveCity(
        activeCountry === DEFAULT_COUNTRY && set.has(DEFAULT_CITY) ? DEFAULT_CITY : sorted[0],
      );
    }
  }, [geo, activeCountry, activeCity]);

  // Changing geography clears the selection so campaigns only ever fire on
  // the visible cohort.
  useEffect(() => {
    setSelected(new Set());
  }, [activeCountry, activeCity]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const country = r.country?.trim() || "Unassigned";
      const city = r.city?.trim() || r.country?.trim() || "Unassigned";
      if (country !== activeCountry || city !== activeCity) return false;
      if (igFirstOnly && outreachVector(r) !== "instagram") return false;
      if (!q) return true;
      return [r.studio_name, r.founder_name, r.business_email, r.aesthetic_profile, r.instagram_handle, ...(r.executive_emails ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, activeCountry, activeCity, igFirstOnly]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((r) => r.id)));

  const deploySequences = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setDispatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("dispatch-acquisition-campaign", {
        body: { ids },
      });
      const failure = (data as { error?: string } | null)?.error;
      if (error || failure) throw new Error(failure || error?.message || "Dispatch failed.");
      const result = data as {
        sent: number;
        skipped: number;
        failed: number;
        results: { id: string; status: string }[];
      };

      const sentIds = (result.results ?? []).filter((r) => r.status === "sent").map((r) => r.id);
      setExiting(new Set(sentIds));
      toast.success(
        `${result.sent} invitation${result.sent === 1 ? "" : "s"} sent.` +
          (result.skipped ? ` ${result.skipped} skipped.` : "") +
          (result.failed ? ` ${result.failed} failed.` : ""),
      );
      setSelected(new Set());
      window.setTimeout(() => {
        setExiting(new Set());
        queryClient.invalidateQueries({ queryKey: ["acquisition-leads", "enriched"] });
      }, 700);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dispatch failed.");
    } finally {
      setDispatching(false);
    }
  };

  // Temporary patch utility: fills missing Instagram handles and executive
  // emails on leads that were ingested before those fields existed.
  const repairContacts = async () => {
    setRepairing(true);
    const pending = toast.loading("Repairing Instagram & executive contact data…");
    try {
      const { data, error } = await supabase.functions.invoke("repair-acquisition-contacts", {
        body: {},
      });
      const failure = (data as { error?: string } | null)?.error;
      if (error || failure) throw new Error(failure || error?.message || "Repair failed.");
      const result = data as {
        scanned: number;
        repaired: number;
        unresolved: number;
        failed: number;
      };
      toast.success(
        `${result.repaired} of ${result.scanned} leads repaired.` +
          (result.unresolved ? ` ${result.unresolved} without verified data.` : "") +
          (result.failed ? ` ${result.failed} failed.` : ""),
        { id: pending },
      );
      await queryClient.invalidateQueries({ queryKey: ["acquisition-leads", "enriched"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Repair failed.", { id: pending });
    } finally {
      setRepairing(false);
    }
  };

  // Temporary backfill: apply the authoritative Instagram handle mapping above
  // to any enriched lead whose handle is currently empty.
  const calibrateHandles = async () => {
    setCalibrating(true);
    const pending = toast.loading("Calibrating live Instagram handles…");
    try {
      let updated = 0;
      for (const lead of rows) {
        const handle = KNOWN_INSTAGRAM_HANDLES[lead.studio_name.trim()];
        if (!handle || lead.instagram_handle) continue;
        const { error } = await supabase
          .from("acquisition_leads")
          .update({ instagram_handle: handle })
          .eq("id", lead.id);
        if (error) throw error;
        updated++;
      }
      toast.success(`${updated} Instagram handles calibrated.`, { id: pending });
      await queryClient.invalidateQueries({ queryKey: ["acquisition-leads", "enriched"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Calibration failed.", { id: pending });
    } finally {
      setCalibrating(false);
    }
  };

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  if (!enabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <h1 className="font-serif text-2xl">403 — Forbidden</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Acquisitions is restricted to internal administrators.
        </p>
        <Link to="/trade" className="text-sm underline underline-offset-4">
          Return to the Trade Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Acquisitions | Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full px-8 py-12 md:px-10 md:py-16">
        <header className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Outbound Intelligence
            </p>
            <h1 className="font-serif text-3xl tracking-tight text-foreground md:text-4xl">
              Acquisitions
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Enriched studio leads with an AI reading of their aesthetic and the Maison Affluency
              designers they would naturally specify.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 md:items-end">
            <Button
              variant="outline"
              onClick={() => setIgFirstOnly((v) => !v)}
              className={`h-10 rounded-none px-5 text-[11px] uppercase tracking-[0.2em] ${
                igFirstOnly
                  ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
                  : "border-border text-foreground"
              }`}
            >
              <Instagram className="mr-2 h-4 w-4" />
              {igFirstOnly ? "Showing Instagram-First Targets" : "Show Instagram-First Targets Only"}
            </Button>
            <Button
              onClick={deploySequences}
              disabled={dispatching || selected.size === 0}
              className="h-12 rounded-none px-6 text-[11px] uppercase tracking-[0.2em]"
            >
              {dispatching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Deploy Tailored Outbound Sequences via Resend
              {selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>

            <button
              type="button"
              onClick={repairContacts}
              disabled={repairing}
              className="inline-flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
            >
              {repairing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Execute IG &amp; Executive Data Repair
            </button>

            <button
              type="button"
              onClick={calibrateHandles}
              disabled={calibrating}
              className="inline-flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
            >
              {calibrating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Instagram className="h-3 w-3" />
              )}
              Execute Live Handle Calibration Loop
            </button>
          </div>
        </header>

        {/* Country tabs */}
        <nav className="flex flex-wrap gap-x-8 gap-y-2 border-b border-border pt-8" aria-label="Filter by country">
          {geo.countries.map((country) => {
            const isActive = country === activeCountry;
            return (
              <button
                key={country}
                type="button"
                onClick={() => setActiveCountry(country)}
                className={`-mb-px border-b-2 pb-3 text-[11px] uppercase tracking-[0.25em] transition-colors ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {country}
              </button>
            );
          })}
        </nav>

        {/* City pills */}
        <div className="flex flex-wrap gap-2 pt-5" aria-label="Filter by city">
          {cities.map((city) => {
            const isActive = city === activeCity;
            return (
              <button
                key={city}
                type="button"
                onClick={() => setActiveCity(city)}
                className={`border px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] transition-colors ${
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {city}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search studio, founder, email or aesthetic…"
            className="h-11 max-w-md rounded-none border-border"
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Pending enriched leads in {activeCity}: {filtered.length}
          </p>
        </div>

        {/* Responsive table container: horizontal scrolling is isolated to the
            data grid; the header toolbar and geographic tabs stay locked to the
            viewport width above it. */}
        <div className="w-full overflow-x-auto border border-border scrollbar-thin">
          <table className="min-w-[1200px] w-full table-auto text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-12 px-5 py-4">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all leads"
                  />
                </th>
                {[
                  { label: "Studio Name", width: "min-w-[180px] w-[14%]" },
                  { label: "Contact", width: "min-w-[180px] w-[14%]" },
                  { label: "Outreach Vector", width: "min-w-[160px] w-[12%]" },
                  { label: "Instagram", width: "min-w-[140px] w-[10%]" },
                  { label: "Aesthetic Profile", width: "min-w-[280px] w-[24%]" },
                  { label: "Source-Verified Links", width: "min-w-[220px] w-[16%]" },
                  { label: "Verification", width: "min-w-[140px] w-[10%]" },
                ].map((h) => (
                  <th
                    key={h.label}
                    className={`${h.width} px-5 py-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-muted-foreground">
                    Loading leads…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-muted-foreground">
                    {igFirstOnly
                      ? `No Instagram-first leads awaiting outbound in ${activeCity}.`
                      : `No enriched leads awaiting outbound in ${activeCity}.`}
                  </td>
                </tr>
              )}
              {filtered.map((lead) => {
                const vector = outreachVector(lead);
                return (
                <tr
                  key={lead.id}
                  className={`border-b border-border/70 align-top transition-all duration-500 ${
                    exiting.has(lead.id)
                      ? "translate-x-6 opacity-0"
                      : "translate-x-0 opacity-100 hover:bg-muted/20"
                  }`}
                >
                  <td className="px-5 py-6">
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={() => toggle(lead.id)}
                      aria-label={`Select ${lead.studio_name}`}
                    />
                  </td>
                  <td className="px-5 py-6">
                    <div className="font-serif text-base text-foreground">{lead.studio_name}</div>
                    {lead.website_url && (
                      <a
                        href={lead.website_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-4 hover:underline"
                      >
                        Website <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-6">
                    <div className="text-sm text-foreground">{lead.founder_name ?? "—"}</div>
                    {(lead.executive_emails ?? []).length > 0 ? (
                      <div className="mt-0.5 space-y-0.5">
                        {(lead.executive_emails ?? []).map((email) => (
                          <div key={email} className="text-[12px] text-foreground">
                            {email}
                          </div>
                        ))}
                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Executive-vetted
                        </div>
                      </div>
                    ) : (
                      <div className="text-[12px] text-muted-foreground">{lead.business_email}</div>
                    )}
                  </td>
                  <td className="px-5 py-6">
                    {vector === "instagram" ? (
                      <Badge
                        variant="outline"
                        className="rounded-none border-destructive/30 text-[11px] font-normal text-destructive"
                      >
                        <AlertTriangle className="mr-1.5 h-3 w-3" />
                        🚨 Route via Instagram DM
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="rounded-none border-border text-[11px] font-normal text-foreground"
                      >
                        <Mail className="mr-1.5 h-3 w-3" />
                        ✉️ Deploy via Resend Email
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-6">
                    {lead.instagram_handle ? (
                      <a
                        href={`https://instagram.com/${lead.instagram_handle.replace(/^@+/, "")}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={`inline-flex items-center gap-1.5 text-[12px] underline-offset-4 hover:underline ${
                          vector === "instagram" ? "font-medium text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        <Instagram className="h-3.5 w-3.5" />
                        {`@${lead.instagram_handle.replace(/^@+/, "")}`}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-6 text-sm leading-relaxed text-muted-foreground whitespace-normal">
                    {lead.aesthetic_profile ?? "—"}
                  </td>
                  <td className="px-5 py-6">
                    <div className="flex flex-wrap gap-2">
                      {(lead.predicted_designer_matches ?? []).length === 0 && (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                      {(lead.predicted_designer_matches ?? []).map((name) => (
                        <Badge
                          key={name}
                          variant="outline"
                          className="rounded-none border-border text-[11px] font-normal"
                        >
                          <Sparkles className="mr-1 h-3 w-3" />
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-6">
                    <Badge
                      variant="outline"
                      className="rounded-none border-emerald-500/40 text-[10px] uppercase tracking-[0.18em] text-emerald-600"
                    >
                      {lead.verified_at ? "Verified" : "Enriched"}
                    </Badge>
                    <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                      <div>{lead.source_index ?? "—"}</div>
                      <div>Added {fmtDate(lead.created_at)}</div>
                      {lead.verified_at && <div>Verified {fmtDate(lead.verified_at)}</div>}
                      {lead.email_error && (
                        <div className="text-destructive">Last error: {lead.email_error}</div>
                      )}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TradeAdminAcquisitions;
