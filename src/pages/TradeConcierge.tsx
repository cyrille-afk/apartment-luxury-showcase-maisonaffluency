import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowUp, Plus, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurationThread } from "@/hooks/useCurationThread";
import { FlashSkeleton, FrontierSkeleton } from "@/components/CuratorialGuideRouter";

const QUICK_STARTS = [
  "Create a living room scheme",
  "Check COM fabric compatibility",
  "Pair a bronze side table with a bouclé lounge chair",
  "Suggest lighting for a double-height entrance",
];

interface ThreadRow { id: string; title: string; updated_at: string }

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function TradeConcierge() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("curation_threads")
      .select("id, title, updated_at").order("updated_at", { ascending: false }).limit(50);
    if (!error) setThreads(data ?? []);
    setThreadsLoaded(true);
  }, [user]);

  useEffect(() => { void loadThreads(); }, [loadThreads]);

  const { loadedFor, messages, phase, route, fallback, error, send, stop, busy } = useCurationThread(threadId, loadThreads);

  // A prompt typed on the blank page creates a thread, navigates, then sends.
  useEffect(() => {
    if (threadId && loadedFor === threadId && phase === "idle" && pendingRef.current) {
      const p = pendingRef.current; pendingRef.current = null;
      void send(p, threadId);
    }
  }, [threadId, loadedFor, phase, send]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [busy, threadId]);

  const submit = async (text: string) => {
    const p = text.trim();
    if (!p || busy || !user) return;
    setPrompt("");
    if (threadId) { void send(p); return; }
    const { data, error: e } = await supabase.from("curation_threads")
      .insert({ user_id: user.id }).select("id").single();
    if (e || !data) return;
    pendingRef.current = p;
    navigate(`/trade/concierge/${data.id}`);
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); busy ? stop() : void submit(prompt); };

  const removeThread = async (id: string) => {
    const { error: e } = await supabase.from("curation_threads").delete().eq("id", id);
    if (e) return;
    setThreads((t) => t.filter((x) => x.id !== id));
    if (id === threadId) navigate("/trade/concierge");
  };

  const firstName = profile?.first_name?.trim();
  const last = messages[messages.length - 1];
  const awaitingFirstToken = busy && (!last || last.role === "user" || !last.content);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-6">
      <Helmet><title>Trade Concierge · Maison Affluency</title><meta name="robots" content="noindex" /></Helmet>
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left — persistent rail */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)] lg:overflow-y-auto">
          <section className="relative overflow-hidden rounded-sm border border-border/60 bg-muted/40 p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent/0 via-accent/70 to-accent/0" />
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Trade Concierge</p>
            <h1 className="mt-3 font-display text-3xl italic leading-tight text-foreground">
              {greeting()}{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {profile?.company ? `Curating for ${profile.company}. ` : ""}Ask for schemes, specifications or finish guidance.
            </p>
          </section>

          <section>
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Begin with</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_STARTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => void submit(q)}
                  className="rounded-full border border-border bg-background px-3.5 py-1.5 text-left text-xs text-foreground transition-colors hover:border-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Past curations</p>
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                <Link to="/trade/concierge"><Plus className="h-3.5 w-3.5" /> New</Link>
              </Button>
            </div>
            {!threadsLoaded ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-sm bg-foreground/[0.05]" />)}</div>
            ) : threads.length === 0 ? (
              <p className="font-display text-sm italic text-muted-foreground">Your curations will appear here.</p>
            ) : (
              <ul className="space-y-1">
                {threads.map((t) => (
                  <li key={t.id} className={cn("group flex items-center rounded-sm border-l-2 transition-colors",
                    t.id === threadId ? "border-accent bg-muted/60" : "border-transparent hover:bg-muted/40")}>
                    <Link to={`/trade/concierge/${t.id}`} className="min-w-0 flex-1 px-3 py-2">
                      <span className="block truncate text-sm text-foreground">{t.title}</span>
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {new Date(t.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                    </Link>
                    <button type="button" aria-label={`Delete ${t.title}`} onClick={() => void removeThread(t.id)}
                      className="mr-2 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        {/* Right — full-height guide */}
        <section className="flex h-[calc(100dvh-8rem)] min-h-[520px] flex-col overflow-hidden rounded-sm border border-border/60 bg-background">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
            {messages.length === 0 && phase !== "loading" && !busy ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Curatorial Guide</p>
                <h2 className="mt-3 max-w-md font-display text-3xl italic text-foreground">What shall we curate today?</h2>
                <div className="mt-5 h-px w-24 bg-gradient-to-r from-accent/0 via-accent to-accent/0" />
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-8">
                {phase === "loading" && <FlashSkeleton />}
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[80%] whitespace-pre-wrap rounded-sm bg-primary px-4 py-3 text-sm text-primary-foreground">{m.content}</p>
                    </div>
                  ) : m.content ? (
                    <article key={m.id} className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {m.route === "FLASH" ? "Swift answer" : "Deep curation"}
                      </p>
                      <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{m.content}</div>
                    </article>
                  ) : null,
                )}
                {awaitingFirstToken && (
                  phase === "streaming" && route === "FRONTIER" ? (
                    <div className="space-y-2">
                      {fallback && <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prioritising accuracy</p>}
                      <FrontierSkeleton />
                    </div>
                  ) : <FlashSkeleton />
                )}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="sticky bottom-0 border-t border-border/60 bg-background/95 px-4 py-4 backdrop-blur md:px-8">
            <div className="relative mx-auto max-w-3xl">
              <Textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); busy ? undefined : void submit(prompt); } }}
                placeholder="Ask the Curatorial Guide…"
                maxLength={4000}
                rows={2}
                className="resize-none rounded-sm pr-14"
              />
              <Button type="submit" size="icon" aria-label={busy ? "Stop" : "Send"} disabled={!busy && !prompt.trim()}
                className="absolute bottom-2.5 right-2.5 h-9 w-9 rounded-full">
                {busy ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
