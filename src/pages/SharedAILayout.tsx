import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Film, Info, Pause, Play, Repeat, RotateCcw, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildCinematicPath, CINEMATIC_PRESETS, type CinematicPreset } from "@/hooks/useCinematicPath";
import CameraPathPreview from "@/components/trade/visualiser/CameraPathPreview";
import CinematicCameraRig from "@/components/trade/visualiser/CinematicCameraRig";
import { CINEMATIC_ENTRY_SECONDS, WALKTHROUGH_SPEEDS, playbackTimeLabel, steppedPlaybackSpeed, walkthroughShortcut } from "@/lib/cinematicPlayback";
import { buildCustomCinematicPath, type CustomPathNode } from "@/lib/customCameraPaths";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { supabase } from "@/integrations/supabase/client";
import AICuratedEnvironment from "@/components/trade/visualiser/AICuratedEnvironment";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";
import type { LayoutProductSnapshot } from "@/lib/aiLayoutStore";

const micro = "text-[10px] uppercase tracking-[0.15em] text-muted-foreground";
const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pathDescriptions: Record<CinematicPreset, string> = {
  sweep: "A sweeping overview of the room and its furniture arrangement.",
  "slow-orbit": "A leisurely full circle around the furniture, with views from every side.",
  "furniture-tour": "A piece-by-piece tour, starting with the sofa and focusing on each furnishing.",
};

type Shared = { title: string; scene: AICuratedSceneSchema; products: LayoutProductSnapshot[]; updated_at: string; camera_paths?: { id: string; name: string; nodes: CustomPathNode[] }[] };

/** Read-only client view of a saved AI layout, opened by its unguessable share link. */
const SharedAILayout = () => {
  const { token = "" } = useParams();
  const [data, setData] = useState<Shared | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase.rpc("get_shared_ai_layout", { _token: token });
      const row = (rows as unknown as Shared[] | null)?.[0];
      if (error || !row) return setState("missing");
      setData(row);
      setState("ready");
    })();
  }, [token]);

  const scene = data?.scene ?? null;
  const [choice, setChoice] = useState<string>("sweep");
  const [guideOpen, setGuideOpen] = useState(true);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [seek, setSeek] = useState({ id: 0, time: 0, restart: false });
  const paths = data?.camera_paths ?? [];
  useEffect(() => { if (paths[0]) setChoice(`custom:${paths[0].id}`); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const isCustom = choice.startsWith("custom:");
  const selectedPath = paths.find((p) => `custom:${p.id}` === choice);
  const selectedLabel = selectedPath?.name ?? CINEMATIC_PRESETS.find((p) => p.value === choice)?.label;
  const describeCustomPath = (p: { nodes: CustomPathNode[] }) => `A curated route through ${p.nodes.length} saved viewpoints.`;
  const selectedDescription = selectedPath ? describeCustomPath(selectedPath) : pathDescriptions[choice as CinematicPreset];
  const pathOptions = useMemo(() => scene ? [
    ...(data?.camera_paths ?? []).map((p) => ({
      value: `custom:${p.id}`, label: p.name,
      description: `A curated route through ${p.nodes.length} saved viewpoints.`,
      path: buildCustomCinematicPath(scene, p.nodes),
    })),
    ...CINEMATIC_PRESETS.map((p) => ({ ...p, description: pathDescriptions[p.value],
      path: buildCinematicPath(scene, 120, 24, p.value) })),
  ] : [], [scene, data?.camera_paths]);
  const cinematic = pathOptions.find((p) => p.value === choice)?.path ?? null;
  const duration = cinematic ? cinematic.durationSec + CINEMATIC_ENTRY_SECONDS : 0;
  const doSeek = useCallback((t: number, restart = false) => { setTime(t); setSeek((s) => ({ id: s.id + 1, time: t, restart })); }, []);
  const start = () => { doSeek(0, true); setActive(true); setPlaying(true); };
  const stop = () => { setActive(false); setPlaying(false); setTime(0); };
  const restart = useCallback(() => { doSeek(0, true); setPlaying(true); }, [doSeek]);
  const toggle = useCallback(() => { if (!playing && time >= duration - 0.1) doSeek(0, true); setPlaying((p) => !p); }, [playing, time, duration, doSeek]);
  const done = useCallback(() => { if (loop) restart(); else setPlaying(false); }, [loop, restart]);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const a = walkthroughShortcut(e); if (!a) return; e.preventDefault();
      if (a === "toggle") toggle(); else if (a === "restart") restart(); else setSpeed((s) => steppedPlaybackSpeed(s, a === "faster" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [active, toggle, restart]);

  if (state !== "ready" || !data || !scene) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-sm text-muted-foreground">
        <Helmet><title>Room Layout | Maison Affluency</title><meta name="robots" content="noindex, nofollow" /></Helmet>
        {state === "loading" ? "Loading layout…" : "This layout link is no longer available."}
      </div>
    );
  }

  const { products } = data;
  const fin = scene.financialSummary;
  const r = scene.roomDimensions;

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6 px-6 py-8 lg:grid-cols-[360px_1fr]">
      <Helmet>
        <title>{`${data.title} | Maison Affluency`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <aside className="space-y-6 border border-border bg-card p-6">
        <div>
          <p className={micro}>Maison Affluency · Curated Room</p>
          <h1 className="mt-1 font-serif text-2xl">{data.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{r.width} × {r.length} m · {r.height} m ceiling</p>
        </div>
        <section className="space-y-2">
          <p className={micro}>Budget summary</p>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-muted-foreground">Budget</dt><dd>{eur(fin.totalBudget)}</dd></div>
            <div><dt className="text-muted-foreground">Allocated</dt><dd>{eur(fin.allocatedSpend)}</dd></div>
            <div><dt className="text-muted-foreground">Buffer</dt><dd>{eur(fin.remainingBuffer)}</dd></div>
          </dl>
        </section>
        <section className="space-y-1">
          <p className={micro}>Selected pieces ({products.length})</p>
          <ul className="divide-y divide-border text-xs">
            {products.map((p, i) => (
              <li key={`${p.componentId}-${i}`} className="py-2">
                <div className="flex justify-between gap-3"><span>{p.name}</span><span>{p.price != null ? eur(p.price) : "Price upon Request"}</span></div>
                <p className="mt-0.5 text-muted-foreground">{p.availability}</p>
              </li>
            ))}
          </ul>
        </section>
      </aside>
      <div className="relative h-[70vh] min-h-[520px] border border-border bg-muted/30">
        <Canvas shadows dpr={[1, 1.5]}>
          <PerspectiveCamera makeDefault fov={45} near={0.05} position={[r.width * 1.3, r.height * 2.2, r.length * 1.6]} />
          <OrbitControls makeDefault enabled={!active} maxPolarAngle={Math.PI / 2.05} target={[0, 0.5, 0]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 10, 5]} intensity={1.1} castShadow />
          <Suspense fallback={null}><Environment preset="apartment" /></Suspense>
          <ContactShadows position={[0, 0.002, 0]} scale={20} opacity={0.3} blur={1.2} far={8} />
          <AICuratedEnvironment schema={scene} selectedId={null} onSelect={() => {}} onAssetTransform={() => {}} onDragStateChange={() => {}} isEditable={false} />
          <CinematicCameraRig path={cinematic} enabled={active} playing={playing} speed={speed} seek={seek} onTimeChange={setTime} onDone={done} />
        </Canvas>
        <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap justify-end gap-2">
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger aria-label="Camera path" aria-describedby="camera-path-description" className="h-8 w-[180px] bg-background/95 text-xs"><SelectValue>{selectedLabel}</SelectValue></SelectTrigger>
            <SelectContent className="w-[400px] max-w-[calc(100vw-2rem)]">
              {pathOptions.map((p) => <SelectItem key={p.value} value={p.value} textValue={p.label} disabled={!p.path} className="py-2 [&>span:last-child]:w-full">
                <span className="flex items-center gap-3">
                  <CameraPathPreview scene={scene} path={p.path} name={p.label} />
                  <span className="min-w-0 flex-1 whitespace-normal">
                    <span className="block text-xs font-medium">{p.label}</span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                      <Clock aria-hidden="true" className="h-3 w-3 shrink-0" />
                      {p.path ? `≈ ${playbackTimeLabel(Math.ceil((p.path.durationSec + CINEMATIC_ENTRY_SECONDS) / speed))} · ${speed}×` : "Unavailable"}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{p.description}</span>
                  </span>
                </span>
              </SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="secondary" onClick={active ? stop : start} disabled={!cinematic}>
            <Film className="mr-1.5 h-3.5 w-3.5" />{active ? "Stop walkthrough" : "Play walkthrough"}
          </Button>
          <p id="camera-path-description" aria-live="polite" className="max-w-[340px] basis-full bg-background/95 px-3 py-2 text-xs text-muted-foreground sm:basis-auto">{selectedDescription}</p>
        </div>
        {!active && guideOpen && cinematic && (
          <div role="note" aria-label="Walkthrough guide" className="absolute bottom-3 left-3 z-10 max-w-[280px] border border-border bg-background/95 p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 font-serif text-xs uppercase tracking-[0.15em]">Guided tour</p>
              <button aria-label="Dismiss walkthrough guide" onClick={() => setGuideOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>Press <span className="font-medium text-foreground">Play walkthrough</span> (top right) to start the camera tour.</li>
              <li>While playing: pause, scrub the timeline, restart, loop, or change speed from the bar below.</li>
              <li>Keyboard: <span className="font-medium text-foreground">Space</span> pause/resume · <span className="font-medium text-foreground">R</span> restart · <span className="font-medium text-foreground">− / +</span> speed.</li>
              <li>Choose a different camera route from the path menu, or drag the room to look around when stopped.</li>
            </ul>
          </div>
        )}
        {active && cinematic && (
          <div role="group" aria-label="Walkthrough playback controls" className="absolute inset-x-3 bottom-3 z-10 space-y-3 border border-border bg-background/95 p-3 shadow-sm">
            <Slider thumbLabel="Walkthrough timeline" min={0} max={duration} step={0.1} value={[time]}
              onValueChange={([t]) => { if (t !== undefined) { setPlaying(false); doSeek(t); } }} />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="icon" variant="ghost" aria-label={playing ? "Pause walkthrough" : "Resume walkthrough"} aria-keyshortcuts="Space" onClick={toggle}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
              <Button size="icon" variant="ghost" aria-label="Restart walkthrough" aria-keyshortcuts="R" onClick={restart}><RotateCcw className="h-4 w-4" /></Button>
              <Button size="icon" variant={loop ? "secondary" : "ghost"} aria-label="Loop walkthrough" aria-pressed={loop} onClick={() => setLoop((l) => !l)}><Repeat className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Stop walkthrough" onClick={stop}><Square className="h-3.5 w-3.5" /></Button>
              <output aria-label="Walkthrough time" className="text-xs tabular-nums text-muted-foreground">{playbackTimeLabel(time)} / {playbackTimeLabel(duration)}</output>
              <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
                <SelectTrigger aria-label="Playback speed" className="ml-auto h-8 w-[88px]"><SelectValue /></SelectTrigger>
                <SelectContent>{WALKTHROUGH_SPEEDS.map((s) => <SelectItem key={s} value={String(s)}>{s}×</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-muted-foreground">Space pause/resume · R restart · −/+ speed</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedAILayout;
