import { useEffect, useState, type FormEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCuratorialRouter } from "@/hooks/useCuratorialRouter";

const FRONTIER_STAGES = [
  "AI Curating Bespoke Specifications…",
  "Cross-referencing ateliers & finishes…",
  "Weighing proportion, material & provenance…",
  "Composing your curatorial brief…",
];

export function FrontierSkeleton() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStage((s) => (s + 1) % FRONTIER_STAGES.length), 2400);
    return () => clearInterval(id);
  }, []);
  return (
    <div role="status" aria-live="polite" className="relative overflow-hidden rounded-sm border border-border/60 bg-muted/40 p-6">
      <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[curatorial-sheen_2.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent/15 to-transparent" />
      <div className="flex items-center gap-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Deep curation</p>
      </div>
      <p key={stage} className="mt-4 font-display text-lg italic text-foreground animate-fade-in">
        {FRONTIER_STAGES[stage]}
      </p>
      <div className="mt-6 space-y-3" aria-hidden>
        {["w-11/12", "w-9/12", "w-10/12", "w-6/12"].map((w, i) => (
          <div key={i} className={cn("h-2 rounded-full bg-foreground/[0.07] animate-pulse", w)} style={{ animationDelay: `${i * 180}ms` }} />
        ))}
      </div>
      <div className="mt-6 h-px w-full bg-gradient-to-r from-accent/0 via-accent/60 to-accent/0" />
    </div>
  );
}

export function FlashSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-2 py-2" aria-label="Preparing answer">
      <div className="h-2 w-8/12 animate-pulse rounded-full bg-foreground/[0.07]" />
      <div className="h-2 w-5/12 animate-pulse rounded-full bg-foreground/[0.07]" />
    </div>
  );
}

export default function CuratorialGuideRouter({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState("");
  const { phase, route, fallback, text, error, busy, ask, stop } = useCuratorialRouter();

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return stop();
    if (prompt.trim()) void ask(prompt);
  };

  const waiting = busy && !text;

  return (
    <section className={cn("mx-auto w-full max-w-2xl space-y-6", className)}>
      <header className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Curatorial Guide</p>
        <h2 className="font-display text-2xl text-foreground">Ask our curators</h2>
      </header>

      <form onSubmit={submit} className="relative">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="e.g. Specify a bronze side table to pair with a bouclé lounge chair…"
          maxLength={4000}
          rows={3}
          className="resize-none rounded-sm pr-14"
        />
        <Button
          type="submit"
          size="icon"
          aria-label={busy ? "Stop" : "Ask"}
          disabled={!busy && !prompt.trim()}
          className="absolute bottom-3 right-3 h-9 w-9 rounded-full"
        >
          {busy ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
        </Button>
      </form>

      {route && (
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {route === "FLASH" ? "Swift answer" : "Deep curation"}
          {fallback && " · prioritising accuracy"}
        </p>
      )}

      {phase === "routing" && <FlashSkeleton />}
      {waiting && phase === "streaming" && (route === "FRONTIER" ? <FrontierSkeleton /> : <FlashSkeleton />)}

      {text && (
        <article className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{text}</article>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}
    </section>
  );
}
