import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Image as ImageIcon, Loader2, LockKeyhole } from "lucide-react";
import { useDbCuratorPicks } from "@/hooks/useDbCuratorPicks";
import { usePublicRrpMap, formatPublicRrpForDestination } from "@/hooks/usePublicRrp";
import { useShippingDestination } from "@/lib/shippingDestination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "the", "with", "room", "image", "pin", "pins", "www", "com", "https", "http"]);

function keywords(value: string) {
  return Array.from(new Set(value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word))));
}

function sourcingId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `MA-${(hash % 90000 + 10000).toString()}`;
}

const DEFAULT_REFERENCE = "https://kavehome.sg";
// Curated first row for the showcase reference link.
const PINNED_KAVEHOME = [
  { title: /^medallion chair/i, designer: /dagmar/i },
  { title: /^vega b chair/i, designer: /de la espada/i },
  { title: /^entre bench/i, designer: /dagmar/i },
];
const DEFAULT_OBJECT_QUERY = "Ash dining chairs";

// Lighting intent: these words force the edit into lighting fixtures only.
const LIGHTING_TERMS = new Set(["pendant", "pendants", "chandelier", "chandeliers", "lamp", "lamps", "lighting", "sconce", "sconces", "ceiling light", "ceiling lights"]);

function isLightingQuery(terms: string[]) {
  return terms.some((term) => LIGHTING_TERMS.has(term));
}

function isLightingItem(title: string, category: string | undefined, subcategory: string | undefined, materials: string | undefined) {
  const text = `${title} ${category || ""} ${subcategory || ""} ${materials || ""}`.toLowerCase();
  return /\blights?\b|\blamps?\b|\bpendants?\b|\bchandeliers?\b|\bsconces?\b|\blighting\b/.test(text);
}

// Rank lighting matches: pendants/chandeliers first, then lamps, then the
// broader lighting category. Weighting stays 2:1 (fixture type : wording).
function lightingScore(title: string, category: string | undefined, subcategory: string | undefined, materials: string | undefined) {
  const text = `${title} ${materials || ""}`.toLowerCase();
  const type = `${category || ""} ${subcategory || ""}`.toLowerCase();
  const fixture = /\bpendants?\b/.test(text) ? 2 : /\bchandeliers?\b/.test(text) ? 2 : /\blamps?\b/.test(text) ? 1.6 : /\bsconces?\b/.test(text) ? 1.4 : 1;
  const wording = /\bpendants?\b/.test(text) || /\bchandeliers?\b/.test(text) || /\blamps?\b/.test(text) ? 1 : /\blights?\b|\blighting\b/.test(text) ? 0.6 : 0.3;
  return 2 * fixture + wording + (/\blights?\b|\blighting\b/.test(type) ? 0.5 : 0);
}

function isAshDiningChair(materials: string | undefined, title: string, category: string | undefined, subcategory: string | undefined) {
  const material = (materials || "").toLowerCase();
  const type = `${title} ${category || ""} ${subcategory || ""}`.toLowerCase();
  // Do not infer an ash finish from a generic wood listing or an oak/walnut alternative.
  return /\bash\b/.test(material) && !/\b(oak|walnut|mahogany|beech)\b/.test(material)
    && /\bchairs?\b/.test(type) && !/\b(armchairs?|lounge|bar|stools?)\b/.test(type);
}

// Rank only published catalog picks: material is worth twice the object-type match.
// This mirrors the proposed SQL weighting without querying an unrelated catalog or
// relying on substring similarity (which would treat "ash" as part of "cashmere").
function ashDiningChairScore(title: string, category: string | undefined, subcategory: string | undefined) {
  const name = title.toLowerCase();
  const type = `${category || ""} ${subcategory || ""}`.toLowerCase();
  const objectSimilarity = /\bdining chairs?\b/.test(name) ? 1
    : /\bdining chairs?\b/.test(type) ? 0.9
    : /\bchairs?\b/.test(name) ? 0.7
    : /\bchairs?\b/.test(type) ? 0.5 : 0;
  return 2 * 1 + objectSimilarity;
}

type CatalogItem = Awaited<ReturnType<typeof useDbCuratorPicks>>["data"] extends infer T ? (T extends (infer U)[] | null | undefined ? U : never) : never;

export function useMoodboardSourcing() {
  const [mode, setMode] = useState<"prompt" | "reference">("prompt");
  const [prompt, setPrompt] = useState(DEFAULT_OBJECT_QUERY);
  const [reference, setReference] = useState(DEFAULT_REFERENCE);
  const [submitted, setSubmitted] = useState<{ value: string; mode: "prompt" | "reference" } | null>({ value: DEFAULT_OBJECT_QUERY, mode: "prompt" });
  const [generating, setGenerating] = useState(false);
  // Unlock is driven ONLY by the server-verified trade/admin role — never by local form state.
  const { isTradeUser, isAdmin } = useAuth();
  const unlocked = isTradeUser || isAdmin;
  const [email, setEmail] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [error, setError] = useState("");
  const generateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: catalog = [], isLoading, isError } = useDbCuratorPicks();

  useEffect(() => () => { if (generateTimer.current) clearTimeout(generateTimer.current); }, []);

  const matches = useMemo(() => {
    if (!submitted) return [];
    const search = submitted.mode === "reference" ? (() => {
      try {
        const url = new URL(submitted.value);
        return decodeURIComponent(url.pathname);
      } catch { return submitted.value; }
    })() : submitted.value;
    const terms = keywords(search);
    const strictAshChair = submitted.mode === "prompt" && terms.includes("ash") && terms.some((term) => term === "chair" || term === "chairs");
    // Lighting keywords ("pendants", "chandelier", "lamp", "lighting", …) force
    // the edit into lighting fixtures — sofas/tables must never surface.
    const lightingIntent = submitted.mode === "prompt" && isLightingQuery(terms);
    const pinned = /kavehome\./i.test(submitted.value) ? PINNED_KAVEHOME : [];
    const eligible = strictAshChair
      ? catalog.filter(({ pick }) => isAshDiningChair(pick.materials, pick.title, pick.category, pick.subcategory))
      : lightingIntent
      ? catalog.filter(({ pick }) => isLightingItem(pick.title, pick.category, pick.subcategory, pick.materials))
      : catalog;
    const ranked = eligible.map((item, index) => {
      const haystack = keywords([item.pick.title, item.pick.category, item.pick.subcategory, item.pick.materials, item.designerName].filter(Boolean).join(" "));
      let score = strictAshChair
        ? ashDiningChairScore(item.pick.title, item.pick.category, item.pick.subcategory)
        : lightingIntent
        ? lightingScore(item.pick.title, item.pick.category, item.pick.subcategory, item.pick.materials) +
          terms.reduce((sum, term) => sum + (haystack.some((word) => word === term || word.replace(/s$/, "") === term.replace(/s$/, "")) ? 3 : 0), 0)
        : terms.reduce((sum, term) => sum + (haystack.some((word) => word === term || word.replace(/s$/, "") === term.replace(/s$/, "")) ? 3 : haystack.some((word) => word.includes(term)) ? 1 : 0), 0);
      const pinIndex = pinned.findIndex((p) => p.title.test(item.pick.title) && p.designer.test(item.designerName || ""));
      if (pinIndex >= 0) score = 10000 - pinIndex;
      return { item, index, score };
    }).sort((a, b) => b.score - a.score || a.index - b.index);
    // Dedupe parent-house/designer twins (e.g. "Vega B Chair" vs "Vega B Chair by Anthony Guerrée")
    const seen = new Set<string>();
    const unique: CatalogItem[] = [];
    for (const { item } of ranked) {
      const key = item.pick.title.toLowerCase().replace(/\s+by\s+.+$/, "").replace(/[^a-z0-9]/g, "");
      const imgKey = (item.pick.image || "").split("?")[0];
      if (seen.has(key) || (imgKey && seen.has(imgKey))) continue;
      seen.add(key);
      if (imgKey) seen.add(imgKey);
      unique.push(item);
      if (unique.length === 9) break;
    }
    return unique;
  }, [catalog, submitted]);
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
    setGenerating(true);
    setSubmitted(null);
    if (generateTimer.current) clearTimeout(generateTimer.current);
    generateTimer.current = setTimeout(() => {
      setSubmitted({ value, mode });
      setGenerating(false);
    }, 900);
  };

  return {
    mode, setMode, prompt, setPrompt, reference, setReference,
    submitted, generating, unlocked, error, setError,
    matches, isLoading, isError, rrpMap, destination,
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
  const { submitted, generating, matches, isLoading, isError, rrpMap, destination, unlocked, email, setEmail, capturing, captureError, captureLead } = mb;

  const cardBody = (pick: { id?: string; title: string; materials?: string | null }, designerName: string, locked: boolean) => (
    <div className={`flex flex-col justify-between ${embedded ? "min-h-28 p-2.5" : "min-h-32 p-4"}`}>
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

  const ashPending = embedded && submitted?.mode === "prompt" && /\bash\b/i.test(submitted.value) && /\bchairs?\b/i.test(submitted.value);

  return (
    <div aria-live="polite">
      {generating && (
        <div role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Curating your edit">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse border border-moodboard-ink/10 bg-card">
              <div className="aspect-[4/5] bg-moodboard-ink/5" />
              <div className="space-y-2 p-4"><div className="h-2 w-1/3 bg-moodboard-ink/10" /><div className="h-3 w-2/3 bg-moodboard-ink/10" /><div className="h-2 w-1/2 bg-moodboard-ink/10" /></div>
            </div>
          ))}
        </div>
      )}

      {submitted && !generating && (
        <>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-moodboard-ink/10 pb-4">
            <div><p className="font-body text-[11px] uppercase tracking-[0.2em] text-moodboard-teal">The edit</p><h3 className="mt-1 font-display text-xl text-moodboard-ink">Selected for your brief</h3></div>
            <span className="font-body text-xs text-moodboard-ink/50">{embedded && /\bash\b/i.test(submitted.value) && /\bchairs?\b/i.test(submitted.value) ? `${matches.slice(0, 3).length} verified · ${Math.max(0, 3 - matches.length)} pending` : `${matches.length} pieces · Public collection`}</span>
          </div>
          {submitted.mode === "reference" && <p className="mb-5 text-xs leading-relaxed text-moodboard-ink/60">Reference links are matched by their readable words, not by analyzing the image. Describe its colors and materials for a more precise edit.</p>}
          {submitted.mode === "prompt" && /\bash\b/i.test(submitted.value) && /\bchairs?\b/i.test(submitted.value) && !isLoading && !isError && matches.length < 3 && <p className="mb-5 text-xs leading-relaxed text-moodboard-ink/60">Only verified ash chair listings are shown. Further pieces await material confirmation.</p>}
          {isLoading && <p className="py-10 text-sm text-moodboard-ink/60" role="status">Preparing the collection…</p>}
          {isError && <p className="py-10 text-sm text-destructive" role="alert">The collection could not load. Please try again.</p>}
          {!isLoading && !isError && matches.length === 0 && !ashPending && <p className="py-10 text-sm text-moodboard-ink/60">No pieces are available right now. Please try again later.</p>}
          {(matches.length > 0 || ashPending) && <>
            <div className={embedded ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
              {matches.slice(0, 3).map(({ pick, designerName }) => (
                <article key={pick.id} className="min-w-0 border border-moodboard-ink/10 bg-card">
                  <div className="aspect-[4/5] overflow-hidden bg-moodboard-ink/5"><img src={pick.image} alt={pick.title} loading="lazy" className="h-full w-full object-contain" /></div>
                  {cardBody(pick, designerName, false)}
                </article>
              ))}
              {ashPending && Array.from({ length: Math.max(0, 3 - matches.length) }, (_, index) => (
                <article key={`pending-${index}`} className="flex min-w-0 flex-col border border-moodboard-ink/10 bg-card">
                  <div className="aspect-[4/5] bg-moodboard-ink/5" aria-hidden="true" />
                  <div className="p-2.5"><p className="font-display text-sm text-moodboard-ink">Further sourcing pending</p><p className="mt-1 text-xs text-moodboard-ink/60">Material verification required</p><p className="mt-3 border-t border-moodboard-ink/10 pt-2 text-xs text-moodboard-teal">Price upon Request</p></div>
                </article>
              ))}
            </div>
            {(embedded || matches.length > 3 || (submitted.mode === "prompt" && /\bash\b/i.test(submitted.value) && /\bchairs?\b/i.test(submitted.value))) && <div className="relative mt-4">
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
                  <article key={pick.id} className="min-w-0 border border-moodboard-ink/10 bg-card">
                    <div className="aspect-[4/5] overflow-hidden bg-moodboard-ink/5"><img src={pick.image} alt={unlocked ? pick.title : ""} loading="lazy" className="h-full w-full object-cover" /></div>
                    {cardBody(pick, designerName, !unlocked)}
                  </article>
                ))}
                {!unlocked && matches.length <= 3 && [0, 1, 2].map((index) => (
                  <div key={`pending-${index}`} className="border border-moodboard-ink/10 bg-card">
                    <div className="aspect-[4/5] bg-moodboard-ink/5" />
                    <div className="p-4 font-display text-base text-moodboard-ink/50">Further sourcing pending verification</div>
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
