import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Image as ImageIcon, Loader2, LockKeyhole } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePublicRrpMap, formatPublicRrpForDestination } from "@/hooks/usePublicRrp";
import { useShippingDestination } from "@/lib/shippingDestination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { trackFelixEvent } from "@/lib/felixEvents";

function sourcingId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `MA-${(hash % 90000 + 10000).toString()}`;
}

const DEFAULT_REFERENCE = "https://www.pinterest.com/luxuryhomefurniture/";
const DEFAULT_OBJECT_QUERY = "Ash dining chairs";

// Matching rules live in the `felix-sourcing` backend function; the client
// only receives the final ranked results.
type SourcedItem = { pick: { id: string; title: string; image: string; materials?: string }; designerName: string; status: "verified" | "similar" };
type SourcingSuggestion = { label: string; query: string };

export function useMoodboardSourcing() {
  const [mode, setMode] = useState<"prompt" | "reference">("prompt");
  const [prompt, setPrompt] = useState(DEFAULT_OBJECT_QUERY);
  const [reference, setReference] = useState(DEFAULT_REFERENCE);
  const [submitted, setSubmitted] = useState<{ value: string; mode: "prompt" | "reference"; track?: number } | null>({ value: DEFAULT_OBJECT_QUERY, mode: "prompt" });
  const [generating, setGenerating] = useState(false);
  // Unlock is driven ONLY by the server-verified trade/admin role — never by local form state.
  const { isTradeUser, isAdmin } = useAuth();
  const unlocked = isTradeUser || isAdmin;
  const [email, setEmail] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [error, setError] = useState("");
  const generateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (generateTimer.current) clearTimeout(generateTimer.current); }, []);

  const { data, isLoading, isError } = useQuery({
    // `track` (a submission counter) is only set for real user submissions, so
    // each click is logged once server-side while the default preview is not.
    queryKey: ["felix-sourcing", submitted?.mode, submitted?.value, submitted?.track ?? 0],
    enabled: !!submitted,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ matches: SourcedItem[]; suggestions: SourcingSuggestion[] }> => {
      const { data, error: fnError } = await supabase.functions.invoke("felix-sourcing", {
        body: { mode: submitted!.mode, value: submitted!.value, track: !!submitted!.track, path: window.location.pathname },
      });
      if (fnError) throw fnError;
      if (submitted!.track) trackFelixEvent("felix_generate_success", { mode: submitted!.mode, query: submitted!.value, result_count: data?.results?.length ?? 0 });
      const matches = ((data?.results ?? []) as Array<{ id: string; title: string; image: string; materials: string | null; designerName: string; status?: string }>)
        .map((r) => ({ pick: { id: r.id, title: r.title, image: r.image, materials: r.materials ?? undefined }, designerName: r.designerName, status: r.status === "similar" ? "similar" as const : "verified" as const }));
      return { matches, suggestions: (data?.suggestions ?? []) as SourcingSuggestion[] };
    },
  });
  const matches = data?.matches ?? [];
  const suggestions = data?.suggestions ?? [];
  const { data: rrpMap = {} } = usePublicRrpMap(matches.map(({ pick }) => pick.id));
  const destination = useShippingDestination();

  const captureLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setCapturing(true);
    setCaptureError("");
    const value = email.trim().toLowerCase();
    const { error: rpcError } = await supabase.rpc("moodboard_capture_lead", { _email: value, _reference: submitted?.value ?? null });
    setCapturing(false);
    if (rpcError) { setCaptureError("We couldn't record your request. Please try again."); return; }
    window.location.href = `/trade-program?email=${encodeURIComponent(value)}&source=moodboard`;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = (mode === "prompt" ? prompt : reference).trim();
    if (!value) return;
    if (mode === "reference") {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid link");
      } catch {
        setError("Enter a full image or Pinterest link starting with https://");
        return;
      }
    }
    setError("");
    trackFelixEvent("felix_generate_submit", { mode, query: value });
    setGenerating(true);
    setSubmitted(null);
    if (generateTimer.current) clearTimeout(generateTimer.current);
    generateTimer.current = setTimeout(() => {
      setSubmitted({ value, mode, track: Date.now() });
      setGenerating(false);
    }, 900);
  };

  const chooseSuggestion = (query: string) => {
    setMode("prompt");
    setPrompt(query);
    setError("");
    trackFelixEvent("felix_generate_submit", { mode: "prompt", query });
    setSubmitted({ value: query, mode: "prompt", track: Date.now() });
  };

  return {
    mode, setMode, prompt, setPrompt, reference, setReference,
    submitted, generating, unlocked, error, setError,
    matches, suggestions, chooseSuggestion, isLoading, isError, rrpMap, destination,
    email, setEmail, capturing, captureError, captureLead, submit,
  };
}

export type MoodboardSourcing = ReturnType<typeof useMoodboardSourcing>;

/* ─── Input controls: tabs, text field, action button ─── */
export function MoodboardControls({ mb, embedded = false }: { mb: MoodboardSourcing; embedded?: boolean }) {
  const { mode, setMode, prompt, setPrompt, reference, setReference, error, setError, generating, submit } = mb;

  const tabClass = (active: boolean) =>
    `rounded-none border-b-2 whitespace-nowrap ${embedded ? "px-2.5 py-2 text-[9.5px] tracking-[0.14em]" : "px-5 py-3 text-[11px] tracking-[0.18em]"} uppercase transition-colors ${
      active ? "border-moodboard-teal text-moodboard-teal" : "border-transparent text-moodboard-ink/50 hover:text-moodboard-ink"
    }`;

  return (
    <div className={embedded ? "mt-8 border-t border-moodboard-ink/10 pt-6" : ""}>
      <p className="mb-3 font-body text-xs uppercase tracking-[0.2em] text-moodboard-teal">Sourcing atelier / 01</p>
      <h2 id="moodboard-heading" className={`max-w-2xl font-display leading-tight text-moodboard-ink ${embedded ? "text-xl md:text-2xl" : "text-3xl md:text-5xl"}`}>One-Click Moodboard Generator</h2>

      <form onSubmit={submit} className={embedded ? "mt-5" : "mt-8"}>
        <div className={`mb-5 gap-0 border-b border-moodboard-ink/10 ${embedded ? "flex flex-wrap" : "flex flex-col sm:flex-row"}`} role="group" aria-label="Moodboard input type">
          <Button type="button" variant="ghost" onClick={() => { setMode("prompt"); setError(""); }} aria-pressed={mode === "prompt"} className={tabClass(mode === "prompt")}>Source by object / piece</Button>
          <Button type="button" variant="ghost" onClick={() => { setMode("reference"); setError(""); }} aria-pressed={mode === "reference"} className={tabClass(mode === "reference")}><ImageIcon aria-hidden="true" className="mr-2 size-3.5" />Image / Pinterest URL</Button>
        </div>
        <div className={`flex flex-col gap-3 ${embedded ? "" : "sm:flex-row"}`}>
          <label htmlFor="moodboard-input" className="sr-only">{mode === "prompt" ? "Object or piece to source" : "Image or Pinterest URL"}</label>
          <Input id="moodboard-input" key={mode} type={mode === "prompt" ? "text" : "url"} value={mode === "prompt" ? prompt : reference} onChange={(event) => { (mode === "prompt" ? setPrompt : setReference)(event.target.value); setError(""); }} required maxLength={500} placeholder={mode === "prompt" ? "E.g. Ash dining chairs" : "https://www.pinterest.com/pin/..."} className="h-12 flex-1 rounded-none border-moodboard-ink/20 bg-card px-4 text-moodboard-ink placeholder:text-moodboard-ink/40 focus-visible:ring-moodboard-teal" />
          <Button type="submit" disabled={generating} className="h-12 shrink-0 rounded-none bg-moodboard-teal px-7 text-xs uppercase tracking-[0.18em] text-moodboard-teal-foreground hover:bg-moodboard-teal/90">
            {generating ? <><Loader2 aria-hidden="true" className="animate-spin" /> Curating…</> : <>Generate edit <ArrowRight aria-hidden="true" /></>}
          </Button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}

/* ─── Output display: skeletons, the edit header, product grid, lock banner ─── */
export function MoodboardResults({ mb, embedded = false }: { mb: MoodboardSourcing; embedded?: boolean }) {
  const { submitted, generating, matches, suggestions, chooseSuggestion, isLoading, isError, rrpMap, destination, unlocked, email, setEmail, capturing, captureError, captureLead } = mb;

  // Gate-passing pieces are "verified"; the sourcing engine backfills the rest
  // of the grid with "similar" inventory so the edit is never dotted with
  // empty placeholders while material verification continues in the background.
  const verifiedCount = matches.filter((m) => m.status !== "similar").length;
  const similarCount = matches.length - verifiedCount;

  const cardBody = (pick: { id?: string; title: string; materials?: string | null }, designerName: string, locked: boolean) => (
    <div className={`flex flex-1 flex-col justify-between ${embedded ? "min-h-28 p-2.5" : "min-h-32 p-4"}`}>
      <div>
        <p className="truncate text-[10px] uppercase tracking-wider text-moodboard-teal">{locked ? "More from the collection" : designerName}</p>
        <h4 className="mt-1 truncate font-display text-base text-moodboard-ink">{locked ? "Selection locked" : pick.title}</h4>
        <p className="mt-1 truncate text-xs text-moodboard-ink/60">{locked ? "Materials hidden" : pick.materials || "Mixed materials"}</p>
      </div>
      <div className={`mt-3 gap-2 border-t border-moodboard-ink/10 pt-3 text-xs ${embedded ? "flex flex-col" : "flex items-center justify-between"}`}>
        <span className="shrink-0 text-moodboard-ink/50">{locked ? "Sourcing ID" : `ID ${sourcingId(pick.id ?? pick.title)}`}</span>
        <span className={`${embedded ? "leading-snug" : "truncate"} font-medium text-moodboard-teal`}>{locked ? "Locked" : embedded ? "Price upon Request" : formatPublicRrpForDestination(rrpMap[pick.id], destination.currency) ?? "Price upon Request"}</span>
      </div>
    </div>
  );

  // A website URL (like the studio's own homepage) is matched by its readable
  // words — only image or Pinterest links carry the image-matching disclaimer.
  const isImageReference = (value: string) => {
    try {
      const url = new URL(value);
      return /(^|\.)pinterest\./i.test(url.hostname) || /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(url.pathname);
    } catch { return false; }
  };

  const unlockPanel = (
    <div className="border-t-2 border-moodboard-teal bg-card/90 p-6 shadow-elegant backdrop-blur-md md:p-8">
      <LockKeyhole className="mb-4 size-5 text-moodboard-teal" aria-hidden="true" />
      <h4 className="font-display text-xl leading-snug text-moodboard-ink">Unlock the Complete Sourcing Matrix.</h4>
      <p className="mt-2 text-sm leading-relaxed text-moodboard-ink/60">Sign up for a free professional profile to reveal live pricing tiers, trade discounts, and global freight estimates.</p>
      <form onSubmit={captureLead} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="moodboard-email" className="sr-only">Professional email address</label>
        <Input id="moodboard-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your professional email" className="h-11 rounded-none border-moodboard-ink/20 bg-card text-moodboard-ink placeholder:text-moodboard-ink/40 focus-visible:ring-moodboard-teal sm:min-w-0 sm:flex-1" />
        <Button type="submit" disabled={capturing} className="h-11 shrink-0 rounded-none bg-moodboard-teal px-5 text-xs uppercase tracking-[0.18em] text-moodboard-teal-foreground hover:bg-moodboard-teal/90">{capturing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <>Unlock <ArrowRight aria-hidden="true" /></>}</Button>
      </form>
      {captureError && <p role="alert" className="mt-2 text-xs text-destructive">{captureError}</p>}
      <p className="mt-3 text-xs text-moodboard-ink/50">Access is granted after trade verification. Already verified? <Link to="/trade/login" className="text-moodboard-teal underline-offset-2 hover:underline">Sign in</Link></p>
    </div>
  );

  return (
    <div aria-live="polite">
      {generating && (
        <div role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Curating your edit">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-full flex-col animate-pulse border border-moodboard-ink/10 bg-card">
              <div className="aspect-square bg-moodboard-ink/5" />
              <div className="flex-1 space-y-2 p-4"><div className="h-2 w-1/3 bg-moodboard-ink/10" /><div className="h-3 w-2/3 bg-moodboard-ink/10" /><div className="h-2 w-1/2 bg-moodboard-ink/10" /></div>
            </div>
          ))}
        </div>
      )}

      {submitted && !generating && (
        <>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-moodboard-ink/10 pb-4">
            <div><p className="font-body text-[11px] uppercase tracking-[0.2em] text-moodboard-teal">The edit</p><h3 className="mt-1 font-display text-xl text-moodboard-ink">Selected for your brief</h3></div>
            <span className="font-body text-xs text-moodboard-ink/50">{submitted.mode === "prompt" ? (similarCount > 0 ? `${verifiedCount} verified · ${similarCount} in verification` : `${matches.length} pieces · Curated collection`) : `${matches.length} pieces · Curated from your source`}</span>
          </div>
          {submitted.mode === "reference" && (isImageReference(submitted.value)
            ? <p className="mb-5 text-xs leading-relaxed text-moodboard-ink/60">Reference links are matched by their readable words, not by analyzing the image. Describe its colors and materials for a more precise edit.</p>
            : <p className="mb-5 text-xs leading-relaxed text-moodboard-ink/60">Analyzing website source for matching collection architecture…</p>)}
          {similarCount > 0 && !isLoading && !isError && <p className="mb-5 text-xs leading-relaxed text-moodboard-ink/60">Verified pieces lead the edit. The remaining cards are similar collection pieces, shown while their materials are being confirmed.</p>}
          {isLoading && <p className="py-10 text-sm text-moodboard-ink/60" role="status">Preparing the collection…</p>}
          {isError && <p className="py-10 text-sm text-destructive" role="alert">The collection could not load. Please try again.</p>}
          {!isLoading && !isError && matches.length === 0 && <div className="py-10">
            <p className="font-display text-lg leading-relaxed text-moodboard-ink">{submitted?.value ? `No pieces in our collection match “${submitted.value}” exactly.` : "No pieces are available right now. Please try again later."}</p>
            {suggestions.length > 0 ? <p className="mt-3 max-w-xl font-body text-sm leading-7 text-moodboard-ink/65">
              However, you can explore our curated selections in {suggestions.map((suggestion, index) => <span key={suggestion.query}>
                {index > 0 ? (index === suggestions.length - 1 ? ", or " : ", ") : ""}
                <Button type="button" variant="link" onClick={() => chooseSuggestion(suggestion.query)} className="h-auto p-0 align-baseline font-display text-base text-moodboard-teal underline decoration-moodboard-teal/30 underline-offset-4 hover:decoration-moodboard-teal">{suggestion.label}</Button>
              </span>)}.
            </p> : submitted?.value && <p className="mt-3 text-sm text-moodboard-ink/60">Try a different colour or material.</p>}
          </div>}
          {matches.length > 0 && <>
            <div className={embedded ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
              {matches.slice(0, 3).map(({ pick, designerName }) => (
                <article key={pick.id} className="flex h-full min-w-0 flex-col border border-moodboard-ink/10 bg-card">
                  <div className="aspect-square overflow-hidden bg-moodboard-ink/5"><img src={pick.image} alt={pick.title} loading="lazy" className="h-full w-full object-cover object-center" /></div>
                  {cardBody(pick, designerName, false)}
                </article>
              ))}
            </div>
            {(embedded || matches.length > 3 || (!unlocked && matches.length > 0)) && <div className="relative mt-4">
              {embedded ? <div className="relative overflow-hidden border border-moodboard-ink/10 bg-moodboard-cream p-4">
                <div aria-hidden="true" className="pointer-events-none select-none space-y-3 blur-md"><div className="flex justify-between border-b border-moodboard-ink/10 pb-3"><span>Supplier & atelier network</span><span>Availability</span></div><div className="flex justify-between"><span>Material specification · Lead times</span><span>Trade margin</span></div><div className="flex justify-between"><span>Project presentation · Client export</span><span>Locked</span></div></div>
                <div className="absolute inset-0 bg-moodboard-cream/35 backdrop-blur-sm" aria-hidden="true" />
                <div className="relative z-10 mx-auto max-w-md border-t-2 border-moodboard-teal bg-card p-5 shadow-elegant">
                  <LockKeyhole className="mb-3 size-5 text-moodboard-teal" aria-hidden="true" />
                  <h4 className="font-display text-lg leading-snug text-moodboard-ink">Unlock Felix's Complete Automated Sourcing Engine.</h4>
                  <p className="mt-2 text-xs leading-relaxed text-moodboard-ink/70">Finish your Trade Program registration below to run unlimited image visual searches, calculate project margins instantly, and download white-label PDF client presentations.</p>
                  <Button type="button" onClick={() => document.getElementById("email")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="mt-4 w-full rounded-none bg-moodboard-teal text-moodboard-teal-foreground hover:bg-moodboard-teal/90">Continue registration <ArrowRight aria-hidden="true" className="ml-2 size-4" /></Button>
                  <p className="mt-3 text-xs text-moodboard-ink/50">Access follows trade verification. Already verified? <Link to="/trade/login" className="text-moodboard-teal underline-offset-2 hover:underline">Sign in</Link></p>
                </div>
              </div> : <>
              <div aria-hidden={!unlocked} className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${unlocked ? "" : "pointer-events-none select-none blur-md"}`}>
                {matches.slice(3).map(({ pick, designerName }) => (
                  <article key={pick.id} className="flex h-full min-w-0 flex-col border border-moodboard-ink/10 bg-card">
                    <div className="aspect-square overflow-hidden bg-moodboard-ink/5"><img src={pick.image} alt={unlocked ? pick.title : ""} loading="lazy" className="h-full w-full object-cover object-center" /></div>
                    {cardBody(pick, designerName, !unlocked)}
                  </article>
                ))}
                {!unlocked && matches.length <= 3 && [0, 1, 2].map((index) => (
                  <div key={`pending-${index}`} className="flex h-full flex-col border border-moodboard-ink/10 bg-card">
                    <div className="aspect-square bg-moodboard-ink/5" />
                    <div className="flex-1 p-4 font-display text-base text-moodboard-ink/50">Further sourcing pending verification</div>
                  </div>
                ))}
              </div>
              {!unlocked && <div className="pointer-events-none absolute inset-0 z-10 flex justify-center bg-moodboard-cream/30 px-3 backdrop-blur-sm">
                <div className="pointer-events-auto sticky top-28 mt-8 h-fit w-full max-w-lg border-t-2 border-moodboard-teal bg-card/90 p-6 shadow-elegant backdrop-blur-md md:p-8">
                  <LockKeyhole className="mb-4 size-5 text-moodboard-teal" aria-hidden="true" />
                  <h4 className="font-display text-xl leading-snug text-moodboard-ink">Unlock the Complete Sourcing Matrix.</h4>
                  <p className="mt-2 text-sm leading-relaxed text-moodboard-ink/60">Sign up for a free professional profile to reveal live pricing tiers, trade discounts, and global freight estimates.</p>
                  <form onSubmit={captureLead} className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="moodboard-email" className="sr-only">Professional email address</label>
                    <Input id="moodboard-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your professional email" className="h-11 rounded-none border-moodboard-ink/20 bg-card text-moodboard-ink placeholder:text-moodboard-ink/40 focus-visible:ring-moodboard-teal sm:min-w-0 sm:flex-1" />
                    <Button type="submit" disabled={capturing} className="h-11 shrink-0 rounded-none bg-moodboard-teal px-5 text-xs uppercase tracking-[0.18em] text-moodboard-teal-foreground hover:bg-moodboard-teal/90">{capturing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <>Unlock <ArrowRight aria-hidden="true" /></>}</Button>
                  </form>
                  {captureError && <p role="alert" className="mt-2 text-xs text-destructive">{captureError}</p>}
                  <p className="mt-3 text-xs text-moodboard-ink/50">Access is granted after trade verification. Already verified? <Link to="/trade/login" className="text-moodboard-teal underline-offset-2 hover:underline">Sign in</Link></p>
                </div>
              </div>}
              </>}
            </div>}
          </>}
        </>
      )}
    </div>
  );
}

/* ─── Standalone (non-embedded) page section ─── */
export default function OneClickMoodboard() {
  const mb = useMoodboardSourcing();
  return (
    <section aria-labelledby="moodboard-heading" className="bg-moodboard-cream py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <MoodboardControls mb={mb} />
        <p className="mt-4 max-w-sm font-body text-sm leading-relaxed text-moodboard-ink/60">Start with a piece or a reference link. Explore a precise edit from the Maison Affluency collection.</p>
        <div className="mt-10">
          <MoodboardResults mb={mb} />
        </div>
      </div>
    </section>
  );
}
