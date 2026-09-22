/**
 * Acquisitions control screen.
 *
 * Enriched studio leads from `acquisition_leads`, ready for a one-click
 * tailored outbound sequence. Admin-only — RLS is the real control, the
 * guard below is convenience.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTables } from "@/contexts/RealtimeMultiplexerContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import DesignerAssignSelect from "@/components/trade/DesignerAssignSelect";
import AestheticProfileInput from "@/components/trade/AestheticProfileInput";
import ContactNameInput from "@/components/trade/ContactNameInput";
import { ExternalLink, Instagram, Loader2, Send, ShieldAlert, Sparkles } from "lucide-react";

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
  reply_received_at: string | null;
  reply_intent: string | null;
  portal_key_sent_at: string | null;
};

const DEFAULT_COUNTRY = "Singapore";
const DEFAULT_CITY = "Singapore";

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const statusBadge = (lead: Lead) => {
  const status = lead.campaign_status;
  const error = lead.email_error;

  if (status === "portal_activated") {
    return {
      label: "Portal Activated",
      className:
        "rounded-none border-emerald-500/50 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15",
    };
  }
  if (status === "replied_interested") {
    return {
      label: "Replied · Interested",
      className:
        "rounded-none border-sky-500/50 bg-sky-500/15 text-sky-600 hover:bg-sky-500/15",
    };
  }
  if (status === "activated") {
    return {
      label: "Activated",
      className:
        "rounded-none border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10",
    };
  }
  if (status === "sent" || status === "outbound_sent") {
    return {
      label: "Outbound Sent",
      className:
        "rounded-none border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/10",
    };
  }
  if (error) {
    return {
      label: "Send Error",
      className:
        "rounded-none border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/10",
    };
  }
  if (status === "enriched") {
    return {
      label: "Enriched",
      className:
        "rounded-none border-blue-500/40 bg-blue-500/10 text-blue-600 hover:bg-blue-500/10",
    };
  }
  return {
    label: "Unprocessed",
    className:
      "rounded-none border-border bg-muted/30 text-muted-foreground hover:bg-muted/30",
  };
};

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
  const [testMode, setTestMode] = useState(() => {
    try {
      return localStorage.getItem("ma_acquisitions_test_mode") === "true";
    } catch {
      return false;
    }
  });
  const [repairing, setRepairing] = useState(false);
  const [exiting, setExiting] = useState<Set<string>>(new Set());
  const [igFirstOnly, setIgFirstOnly] = useState(false);
  const [activeCountry, setActiveCountry] = useState<string>(DEFAULT_COUNTRY);
  const [activeCity, setActiveCity] = useState<string>(DEFAULT_CITY);
  const [calibrating, setCalibrating] = useState(false);
  // Rows whose automated portal key just landed — briefly pulsed in the grid.
  const [justActivated, setJustActivated] = useState<Set<string>>(new Set());
  const statusRef = useRef<Map<string, string>>(new Map());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["acquisition-leads", "enriched"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_leads")
        .select(
          "id, studio_name, founder_name, business_email, website_url, source_index, aesthetic_profile, predicted_designer_matches, campaign_status, verified_at, email_sent_at, email_error, created_at, country, city, instagram_handle, executive_emails, reply_received_at, reply_intent, portal_key_sent_at",
        )
        .in("campaign_status", [
          "unprocessed",
          "enriched",
          "activated",
          "sent",
          "outbound_sent",
          "replied_interested",
          "portal_activated",
        ])
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    },
  });

  // Live reply handling: the inbound webhook writes straight to the table, so
  // the grid reflects a reply and its automated key delivery without polling.
  useRealtimeTables(
    "acquisition_leads",
    (event) => {
      if (event.eventType === "DELETE") return;
      const row = event.new as Lead | null;
      if (!row?.id) return;
      queryClient.setQueryData<Lead[]>(["acquisition-leads", "enriched"], (prev) => {
        if (!prev) return prev;
        const exists = prev.some((r) => r.id === row.id);
        return exists ? prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : [row, ...prev];
      });

      const previous = statusRef.current.get(row.id);
      statusRef.current.set(row.id, row.campaign_status);
      if (previous && previous !== row.campaign_status) {
        if (row.campaign_status === "replied_interested") {
          toast.success(`${row.studio_name} replied — interested.`);
        }
        if (row.campaign_status === "portal_activated") {
          toast.success(`${row.studio_name} activated — portal key delivered.`);
          setJustActivated((prev) => new Set(prev).add(row.id));
          setTimeout(
            () =>
              setJustActivated((prev) => {
                const next = new Set(prev);
                next.delete(row.id);
                return next;
              }),
            20_000,
          );
        }
      }
    },
    enabled,
  );

  useEffect(() => {
    for (const row of rows) {
      if (!statusRef.current.has(row.id)) statusRef.current.set(row.id, row.campaign_status);
    }
  }, [rows]);

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

  // Manual curatorial assignment: reflect the write in the cached rows so the
  // grid never flickers or waits for a refetch.
  const applyMatches = (id: string, next: string[]) => {
    queryClient.setQueryData<Lead[]>(["acquisition-leads", "enriched"], (prev) =>
      (prev ?? []).map((r) => (r.id === id ? { ...r, predicted_designer_matches: next } : r)),
    );
  };

  // Editable aesthetic profile: reflect the write in the cached rows so the
  // cell stays consistent without a full refetch.
  const applyAesthetic = (id: string, next: string | null) => {
    queryClient.setQueryData<Lead[]>(["acquisition-leads", "enriched"], (prev) =>
      (prev ?? []).map((r) => (r.id === id ? { ...r, aesthetic_profile: next } : r)),
    );
  };

  // Editable principal contact name: reflect the write in the cached rows.
  const applyContact = (id: string, next: string | null) => {
    queryClient.setQueryData<Lead[]>(["acquisition-leads", "enriched"], (prev) =>
      (prev ?? []).map((r) => (r.id === id ? { ...r, founder_name: next } : r)),
    );
  };

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

  // Persist test mode across re-renders, refetches, and execution loops.
  // Also mirrored server-side so automated (inbound reply) emails honour it.
  useEffect(() => {
    try {
      localStorage.setItem("ma_acquisitions_test_mode", String(testMode));
    } catch {}
    if (!enabled) return;
    void supabase
      .from("acquisition_test_mode")
      .upsert(
        {
          id: true,
          enabled: testMode,
          redirect_email: user?.email ?? null,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        },
        { onConflict: "id" },
      )
      .then(({ error }) => {
        if (error) console.error("[acquisitions] test mode sync failed:", error.message);
      });
  }, [testMode, enabled, user?.email, user?.id]);

  const deploySequences = async (overrideIds?: string[]) => {
    const ids = overrideIds ?? Array.from(selected);
    if (ids.length === 0 || dispatching) return;
    setDispatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("dispatch-acquisition-campaign", {
        body: { ids, testMode },
      });
      const failure = (data as { error?: string } | null)?.error;
      if (error || failure) throw new Error(failure || error?.message || "Dispatch failed.");
      const result = data as {
        sent: number;
        skipped: number;
        failed: number;
        results: { id: string; status: string }[];
      };

      // In Test Mode rows must remain visible for later production dispatch,
      // so we never trigger the exit/slide-out animation.
      const sentIds = testMode
        ? []
        : (result.results ?? []).filter((r) => r.status === "outbound_sent").map((r) => r.id);
      if (!testMode) {
        queryClient.setQueryData<Lead[]>(["acquisition-leads", "enriched"], (prev) =>
          (prev ?? []).map((lead) =>
            sentIds.includes(lead.id)
              ? { ...lead, campaign_status: "outbound_sent", email_sent_at: new Date().toISOString(), email_error: null }
              : lead,
          ),
        );
      }
      toast.success(
        `${testMode ? "[Test] " : ""}${result.sent} invitation${result.sent === 1 ? "" : "s"} sent${testMode ? " to your admin inbox" : ""}.` +
          (result.skipped ? ` ${result.skipped} skipped.` : "") +
          (result.failed ? ` ${result.failed} failed.` : ""),
      );
      if (!testMode) setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["acquisition-leads", "enriched"] });
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
            <label className="flex items-center justify-end gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span>Test Mode (Route to Admin Email)</span>
              <button
                type="button"
                role="switch"
                aria-checked={testMode}
                aria-label="Test Mode (Route to Admin Email)"
                onClick={() => setTestMode((v) => !v)}
                className={`relative h-5 w-10 rounded-full border transition-colors ${
                  testMode ? "border-foreground bg-foreground" : "border-border bg-transparent"
                }`}
              >
                <span
                  className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all ${
                    testMode ? "left-[22px] bg-background" : "left-[3px] bg-muted-foreground"
                  }`}
                />
              </button>
            </label>
            <Button
              onClick={() => deploySequences()}
              disabled={selected.size === 0}
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
                  { label: "Status", width: "min-w-[140px] w-[10%]" },
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
                    <ContactNameInput
                      leadId={lead.id}
                      studioName={lead.studio_name}
                      value={lead.founder_name}
                      onChange={(next) => applyContact(lead.id, next)}
                    />
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
                      <a
                        href={`https://instagram.com/${(lead.instagram_handle ?? "").replace(/^@+/, "")}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex h-9 items-center gap-2 whitespace-nowrap border border-destructive/40 px-4 text-[10px] uppercase tracking-[0.18em] text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Instagram className="h-3.5 w-3.5" />
                        Route via Instagram DM
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled={dispatching}
                        onClick={() => deploySequences([lead.id])}
                        className="inline-flex h-9 items-center gap-2 whitespace-nowrap bg-foreground px-4 text-[10px] uppercase tracking-[0.18em] text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
                      >
                        {dispatching ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Deploy via Resend Email
                      </button>
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
                  <td className="px-5 py-6">
                    <AestheticProfileInput
                      leadId={lead.id}
                      studioName={lead.studio_name}
                      value={lead.aesthetic_profile}
                      onChange={(next) => applyAesthetic(lead.id, next)}
                    />
                  </td>
                  <td className="px-5 py-6">
                    <DesignerAssignSelect
                      leadId={lead.id}
                      studioName={lead.studio_name}
                      value={lead.predicted_designer_matches ?? []}
                      onChange={(next) => applyMatches(lead.id, next)}
                    />
                  </td>
                  <td className="px-5 py-6">
                    {(() => {
                      const badge = statusBadge(lead);
                      const pulsing = justActivated.has(lead.id);
                      return (
                        <span className="inline-flex items-center gap-2">
                          {pulsing && (
                            <span
                              className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
                              aria-hidden="true"
                            />
                          )}
                          <Badge
                            variant="outline"
                            className={`${badge.className} text-[10px] uppercase tracking-[0.18em] ${
                              pulsing ? "animate-pulse" : ""
                            }`}
                          >
                            {badge.label}
                          </Badge>
                        </span>
                      );
                    })()}
                    <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                      <div>{lead.source_index ?? "—"}</div>
                      <div>Added {fmtDate(lead.created_at)}</div>
                      {lead.verified_at && <div>Verified {fmtDate(lead.verified_at)}</div>}
                      {lead.email_sent_at && <div>Sent {fmtDate(lead.email_sent_at)}</div>}
                      {lead.reply_received_at && (
                        <div className="text-sky-600">Replied {fmtDate(lead.reply_received_at)}</div>
                      )}
                      {lead.portal_key_sent_at && (
                        <div className="text-emerald-600">
                          Portal key sent {fmtDate(lead.portal_key_sent_at)}
                        </div>
                      )}
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
