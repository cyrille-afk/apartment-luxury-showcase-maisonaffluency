import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Image as ImageIcon, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { useDbCuratorPicks } from "@/hooks/useDbCuratorPicks";
import { usePublicRrpMap, formatPublicRrpForDestination } from "@/hooks/usePublicRrp";
import { useShippingDestination } from "@/lib/shippingDestination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "the", "with", "room", "image", "pin", "pins", "www", "com", "https", "http"]);

function keywords(value: string) {
  return Array.from(new Set(value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word))));
}

function sourcingId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `MA-${(hash % 90000 + 10000).toString()}`;
}

export default function OneClickMoodboard() {
  const [mode, setMode] = useState<"prompt" | "reference">("prompt");
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState("");
  const [submitted, setSubmitted] = useState<{ value: string; mode: "prompt" | "reference" } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [email, setEmail] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const generateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: catalog = [], isLoading, isError } = useDbCuratorPicks();
  const destination = useShippingDestination();

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
    const ranked = catalog.map((item, index) => {
      const haystack = keywords([item.pick.title, item.pick.category, item.pick.subcategory, item.pick.materials, item.designerName].filter(Boolean).join(" "));
      const score = terms.reduce((sum, term) => sum + (haystack.some((word) => word === term) ? 3 : haystack.some((word) => word.includes(term)) ? 1 : 0), 0);
      return { item, index, score };
    }).sort((a, b) => b.score - a.score || a.index - b.index);
    return ranked.slice(0, 9).map(({ item }) => item);
  }, [catalog, submitted]);
  const { data: rrpMap = {} } = usePublicRrpMap(matches.map(({ pick }) => pick.id));

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
    setUnlocked(false);
    setGenerating(true);
    setSubmitted(null);
    if (generateTimer.current) clearTimeout(generateTimer.current);
    generateTimer.current = setTimeout(() => {
      setSubmitted({ value, mode });
      setGenerating(false);
    }, 900);
  };

  const unlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setUnlocked(true);
  };

  const tabClass = (active: boolean) =>
    `rounded-none border-b-2 px-5 py-3 text-[11px] uppercase tracking-[0.18em] transition-colors ${
      active ? "border-moodboard-teal text-moodboard-teal" : "border-transparent text-moodboard-ink/50 hover:text-moodboard-ink"
    }`;

  const cardBody = (pick: { id?: string; title: string; materials?: string | null }, designerName: string, locked: boolean) => (
    <div className="flex min-h-32 flex-col justify-between p-4">
      <div>
        <p className="truncate text-[10px] uppercase tracking-wider text-moodboard-teal">{locked ? "More from the collection" : designerName}</p>
        <h4 className="mt-1 truncate font-display text-base text-moodboard-ink">{locked ? "Selection locked" : pick.title}</h4>
        <p className="mt-1 truncate text-xs text-moodboard-ink/60">{locked ? "Materials hidden" : pick.materials || "Mixed materials"}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-moodboard-ink/10 pt-3 text-xs">
        <span className="shrink-0 text-moodboard-ink/50">{locked ? "Sourcing ID" : `ID ${sourcingId(pick.id ?? pick.title)}`}</span>
        <span className="truncate font-medium text-moodboard-teal">{locked ? "Locked" : formatPublicRrpForDestination(rrpMap[pick.id], destination.currency) ?? "Price upon Request"}</span>
      </div>
    </div>
  );

  return (
    <section aria-labelledby="moodboard-heading" className="bg-moodboard-cream py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <div className="mb-9 border-b border-moodboard-ink/10 pb-9 md:flex md:items-end md:justify-between md:gap-12">
          <div>
            <p className="mb-3 font-body text-xs uppercase tracking-[0.2em] text-moodboard-teal">Sourcing atelier / 01</p>
            <h2 id="moodboard-heading" className="max-w-2xl font-display text-3xl leading-tight text-moodboard-ink md:text-5xl">One-Click Moodboard Generator</h2>
          </div>
          <p className="mt-5 max-w-sm font-body text-sm leading-relaxed text-moodboard-ink/60 md:mt-0">Start with a room idea or a reference link. Explore a quick edit from the Maison Affluency collection.</p>
        </div>

        <form onSubmit={submit} className="mb-10">
          <div className="mb-5 flex gap-0 border-b border-moodboard-ink/10" role="group" aria-label="Moodboard input type">
            <Button type="button" variant="ghost" onClick={() => { setMode("prompt"); setError(""); }} aria-pressed={mode === "prompt"} className={tabClass(mode === "prompt")}>Describe a space</Button>
            <Button type="button" variant="ghost" onClick={() => { setMode("reference"); setError(""); }} aria-pressed={mode === "reference"} className={tabClass(mode === "reference")}><ImageIcon aria-hidden="true" className="mr-2 size-3.5" />Image / Pinterest URL</Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="moodboard-input" className="sr-only">{mode === "prompt" ? "Describe your moodboard" : "Image or Pinterest URL"}</label>
            <Input id="moodboard-input" key={mode} type={mode === "prompt" ? "text" : "url"} value={mode === "prompt" ? prompt : reference} onChange={(event) => { (mode === "prompt" ? setPrompt : setReference)(event.target.value); setError(""); }} required maxLength={500} placeholder={mode === "prompt" ? "E.g. Sculptural walnut seating and warm brass lighting" : "https://www.pinterest.com/pin/..."} className="h-12 flex-1 rounded-none border-moodboard-ink/20 bg-card px-4 text-moodboard-ink placeholder:text-moodboard-ink/40 focus-visible:ring-moodboard-teal" />
            <Button type="submit" disabled={generating} className="h-12 shrink-0 rounded-none bg-moodboard-teal px-7 text-xs uppercase tracking-[0.18em] text-moodboard-teal-foreground hover:bg-moodboard-teal/90">
              {generating ? <><Loader2 aria-hidden="true" className="animate-spin" /> Curating…</> : <>Generate edit <ArrowRight aria-hidden="true" /></>}
            </Button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        </form>

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
          <div aria-live="polite">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-moodboard-ink/10 pb-4">
              <div><p className="font-body text-[11px] uppercase tracking-[0.2em] text-moodboard-teal">The edit</p><h3 className="mt-1 font-display text-xl text-moodboard-ink">Selected for your brief</h3></div>
              <span className="font-body text-xs text-moodboard-ink/50">{matches.length} pieces · Public collection</span>
            </div>
            {submitted.mode === "reference" && <p className="mb-5 text-xs leading-relaxed text-moodboard-ink/60">Reference links are matched by their readable words, not by analyzing the image. Describe its colors and materials for a more precise edit.</p>}
            {isLoading && <p className="py-10 text-sm text-moodboard-ink/60" role="status">Preparing the collection…</p>}
            {isError && <p className="py-10 text-sm text-destructive" role="alert">The collection could not load. Please try again.</p>}
            {!isLoading && !isError && matches.length === 0 && <p className="py-10 text-sm text-moodboard-ink/60">No pieces are available right now. Please try again later.</p>}
            {matches.length > 0 && <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {matches.slice(0, 3).map(({ pick, designerName }) => (
                  <article key={pick.id} className="min-w-0 border border-moodboard-ink/10 bg-card">
                    <div className="aspect-[4/5] overflow-hidden bg-moodboard-ink/5"><img src={pick.image} alt={pick.title} loading="lazy" className="h-full w-full object-cover" /></div>
                    {cardBody(pick, designerName, false)}
                  </article>
                ))}
              </div>
              {matches.length > 3 && <div className="relative mt-4">
                <div aria-hidden={!unlocked} className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${unlocked ? "" : "pointer-events-none select-none blur-md"}`}>
                  {matches.slice(3).map(({ pick, designerName }) => (
                    <article key={pick.id} className="min-w-0 border border-moodboard-ink/10 bg-card">
                      <div className="aspect-[4/5] overflow-hidden bg-moodboard-ink/5"><img src={pick.image} alt={unlocked ? pick.title : ""} loading="lazy" className="h-full w-full object-cover" /></div>
                      {cardBody(pick, designerName, !unlocked)}
                    </article>
                  ))}
                </div>
                {!unlocked && <div className="pointer-events-none absolute inset-0 z-10 flex justify-center bg-moodboard-cream/30 px-3 backdrop-blur-sm">
                  <div className="pointer-events-auto sticky top-28 mt-8 h-fit w-full max-w-lg border-t-2 border-moodboard-teal bg-card/90 p-6 shadow-elegant backdrop-blur-md md:p-8">
                    <LockKeyhole className="mb-4 size-5 text-moodboard-teal" aria-hidden="true" />
                    <h4 className="font-display text-xl leading-snug text-moodboard-ink">Unlock the Complete Sourcing Matrix.</h4>
                    <p className="mt-2 text-sm leading-relaxed text-moodboard-ink/60">Sign up for a free professional profile to reveal live pricing tiers, trade discounts, and global freight estimates.</p>
                    <form onSubmit={unlock} className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <label htmlFor="moodboard-email" className="sr-only">Professional email address</label>
                      <Input id="moodboard-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your professional email" className="h-11 rounded-none border-moodboard-ink/20 bg-card text-moodboard-ink placeholder:text-moodboard-ink/40 focus-visible:ring-moodboard-teal sm:min-w-0 sm:flex-1" />
                      <Button type="submit" className="h-11 shrink-0 rounded-none bg-moodboard-teal px-5 text-xs uppercase tracking-[0.18em] text-moodboard-teal-foreground hover:bg-moodboard-teal/90">Unlock <ArrowRight aria-hidden="true" /></Button>
                    </form>
                    <p className="mt-3 text-xs text-moodboard-ink/50">Preview only: this unlocks the edit on this page. No account is created or email sent.</p>
                  </div>
                </div>}
              </div>}
              {unlocked && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-moodboard-teal"><Sparkles className="size-4" aria-hidden="true" />Full edit revealed. A real account was not created; supplier details and custom dimensions are not included in this preview.</p>}
            </>}
          </div>
        )}
      </div>
    </section>
  );
}
