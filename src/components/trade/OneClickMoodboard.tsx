import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Image as ImageIcon, LockKeyhole, Sparkles } from "lucide-react";
import { useDbCuratorPicks } from "@/hooks/useDbCuratorPicks";
import { usePublicRrpMap, formatPublicRrpForDestination } from "@/hooks/usePublicRrp";
import { useShippingDestination } from "@/lib/shippingDestination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "the", "with", "room", "image", "pin", "pins", "www", "com", "https", "http"]);

function keywords(value: string) {
  return Array.from(new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word))));
}

export default function OneClickMoodboard() {
  const [mode, setMode] = useState<"prompt" | "reference">("prompt");
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState("");
  const [submitted, setSubmitted] = useState<{ value: string; mode: "prompt" | "reference" } | null>(null);
  const [email, setEmail] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const { data: catalog = [], isLoading, isError } = useDbCuratorPicks();
  const destination = useShippingDestination();

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
  const { data: rrpMap = {} } = usePublicRrpMap(matches.map(({ item, pick }: any) => (item ?? pick)?.id));

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
    setSubmitted({ value, mode });
  };

  const unlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setUnlocked(true);
  };

  return (
    <section aria-labelledby="moodboard-heading" className="border-y border-border bg-background py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <div className="mb-9 border-b border-border pb-9 md:flex md:items-end md:justify-between md:gap-12">
          <div>
            <p className="mb-3 font-body text-xs uppercase tracking-[0.2em] text-primary">Sourcing atelier / 01</p>
            <h2 id="moodboard-heading" className="max-w-2xl font-display text-3xl leading-tight text-foreground md:text-5xl">One-Click Moodboard Generator</h2>
          </div>
          <p className="mt-5 max-w-sm font-body text-sm leading-relaxed text-muted-foreground md:mt-0">Start with a room idea or a reference link. Explore a quick edit from the Maison Affluency collection.</p>
        </div>

        <form onSubmit={submit} className="mb-10">
          <div className="mb-4 flex gap-0 border-b border-border" role="group" aria-label="Moodboard input type">
            <Button type="button" variant="ghost" onClick={() => { setMode("prompt"); setError(""); }} aria-pressed={mode === "prompt"} className={`rounded-none border-b-2 px-5 text-xs uppercase tracking-wider ${mode === "prompt" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Describe a space</Button>
            <Button type="button" variant="ghost" onClick={() => { setMode("reference"); setError(""); }} aria-pressed={mode === "reference"} className={`rounded-none border-b-2 px-5 text-xs uppercase tracking-wider ${mode === "reference" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><ImageIcon aria-hidden="true" />Image / Pinterest URL</Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="moodboard-input" className="sr-only">{mode === "prompt" ? "Describe your moodboard" : "Image or Pinterest URL"}</label>
            <Input id="moodboard-input" key={mode} type={mode === "prompt" ? "text" : "url"} value={mode === "prompt" ? prompt : reference} onChange={(event) => { (mode === "prompt" ? setPrompt : setReference)(event.target.value); setError(""); }} required maxLength={500} placeholder={mode === "prompt" ? "E.g. Sculptural walnut seating and warm brass lighting" : "https://www.pinterest.com/pin/..."} className="h-12 flex-1 rounded-none border-border px-4" />
            <Button type="submit" className="h-12 shrink-0 rounded-none px-6 text-xs uppercase tracking-wider">Generate edit <ArrowRight aria-hidden="true" /></Button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        </form>

        {submitted && (
          <div aria-live="polite">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
              <div><p className="font-body text-[11px] uppercase tracking-[0.2em] text-primary">The edit</p><h3 className="mt-1 font-display text-xl text-foreground">Selected for your brief</h3></div>
              <span className="font-body text-xs text-muted-foreground">{matches.length} pieces · Public collection</span>
            </div>
            {submitted.mode === "reference" && <p className="mb-5 text-xs leading-relaxed text-muted-foreground">Reference links are matched by their readable words, not by analyzing the image. Describe its colors and materials for a more precise edit.</p>}
            {isLoading && <p className="py-10 text-sm text-muted-foreground" role="status">Preparing the collection…</p>}
            {isError && <p className="py-10 text-sm text-destructive" role="alert">The collection could not load. Please try again.</p>}
            {!isLoading && !isError && matches.length === 0 && <p className="py-10 text-sm text-muted-foreground">No pieces are available right now. Please try again later.</p>}
            {matches.length > 0 && <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {matches.slice(0, 3).map(({ pick, designerName }) => (
                  <article key={pick.id} className="min-w-0 border border-border bg-card">
                    <div className="aspect-[4/5] overflow-hidden bg-muted"><img src={pick.image} alt={pick.title} loading="lazy" className="h-full w-full object-cover" /></div>
                    <div className="flex min-h-32 flex-col justify-between p-4"><div><p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{designerName}</p><h4 className="mt-1 truncate font-display text-base text-card-foreground">{pick.title}</h4></div><div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs"><span className="truncate text-muted-foreground">SKU · Not listed</span><span className="shrink-0 font-medium text-primary">{formatPublicRrpForDestination(rrpMap[pick.id], destination.currency) ?? "Price upon Request"}</span></div></div>
                  </article>
                ))}
              </div>
              {matches.length > 3 && <div className="relative mt-4">
                <div aria-hidden={!unlocked} className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${unlocked ? "" : "pointer-events-none select-none blur-md"}`}>
                  {matches.slice(3).map(({ pick, designerName }) => (
                    <article key={pick.id} className="min-w-0 border border-border bg-card">
                      <div className="aspect-[4/5] overflow-hidden bg-muted"><img src={pick.image} alt={unlocked ? pick.title : ""} loading="lazy" className="h-full w-full object-cover" /></div>
                      <div className="flex min-h-32 flex-col justify-between p-4"><div><p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{unlocked ? designerName : "More from the collection"}</p><h4 className="mt-1 truncate font-display text-base text-card-foreground">{unlocked ? pick.title : "Selection locked"}</h4></div><div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs"><span className="text-muted-foreground">SKU · Not listed</span><span className="shrink-0 font-medium text-primary">{unlocked ? formatPublicRrpForDestination(rrpMap[pick.id], destination.currency) ?? "Price upon Request" : "Locked"}</span></div></div>
                    </article>
                  ))}
                </div>
                {!unlocked && <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex justify-center px-3 sm:sticky sm:bottom-6 sm:-mt-64 sm:pb-6">
                  <div className="pointer-events-auto w-full max-w-lg border border-border bg-card p-6 shadow-elegant md:p-8">
                    <LockKeyhole className="mb-4 size-5 text-primary" aria-hidden="true" />
                    <h4 className="font-display text-xl leading-snug text-card-foreground">Unlock the Full Astra 6 Sourcing List.</h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Create a free account to reveal all remaining matching items, direct supplier links, and custom dimensions.</p>
                    <form onSubmit={unlock} className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <label htmlFor="moodboard-email" className="sr-only">Email address</label>
                      <Input id="moodboard-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" className="h-11 rounded-none sm:min-w-0 sm:flex-1" />
                      <Button type="submit" className="h-11 rounded-none px-5">Unlock edit <ArrowRight aria-hidden="true" /></Button>
                    </form>
                    <p className="mt-3 text-xs text-muted-foreground">Preview only: this unlocks the edit on this page. No account is created or email sent.</p>
                  </div>
                </div>}
              </div>}
              {unlocked && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-primary"><Sparkles className="size-4" aria-hidden="true" />Full edit revealed. A real account was not created; supplier details and custom dimensions are not included in this preview.</p>}
            </>}
          </div>
        )}
      </div>
    </section>
  );
}