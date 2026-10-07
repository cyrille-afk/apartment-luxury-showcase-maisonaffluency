import { Suspense, useCallback, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AICuratedEnvironment from "@/components/trade/visualiser/AICuratedEnvironment";
import { DEFAULT_BRIEF, catalogueName, generateRoomLayout, summarise, type LayoutBrief } from "@/lib/mockAiLayoutService";
import type { AICuratedSceneSchema, Vec3 } from "@/types/aiCuratedScene";

const micro = "text-[10px] uppercase tracking-[0.15em] text-muted-foreground";
const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const TradeAILayoutStudio = () => {
  const [brief, setBrief] = useState<LayoutBrief>(DEFAULT_BRIEF);
  const [scene, setScene] = useState<AICuratedSceneSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const generate = async () => {
    setLoading(true);
    setSelectedId(null);
    try {
      setScene(await generateRoomLayout(brief));
    } finally {
      setLoading(false);
    }
  };

  const onAssetTransform = useCallback((index: number, position: Vec3, rotation: Vec3) => {
    setScene((s) => {
      if (!s) return s;
      const curatedAssets = s.curatedAssets.map((a, i) => (i === index ? { ...a, position, rotation } : a));
      const next = { ...s, curatedAssets };
      return { ...next, financialSummary: summarise(next) };
    });
  }, []);

  const fin = scene?.financialSummary;
  const pct = fin ? Math.min(100, (fin.allocatedSpend / fin.totalBudget) * 100) : 0;
  const dim = (k: keyof LayoutBrief["roomDimensions"], v: string) =>
    setBrief((b) => ({ ...b, roomDimensions: { ...b.roomDimensions, [k]: Math.max(3, Math.min(20, Number(v) || 0)) } }));

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6 px-6 py-8 lg:grid-cols-[360px_1fr]">
      <Helmet>
        <title>AI Layout Studio | Maison Affluency Trade</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <aside className="space-y-6 border border-border bg-card p-6">
        <div>
          <p className={micro}>AI Ingestion</p>
          <h1 className="mt-1 font-serif text-2xl">Curated Room Layout</h1>
          <p className="mt-1 text-xs text-muted-foreground">Mock pipeline — test pricing, not live RRPs.</p>
        </div>

        <section className="space-y-3">
          <p className={micro}>Brief criteria</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Room</Label>
              <Select value={brief.roomType} onValueChange={(v) => setBrief((b) => ({ ...b, roomType: v as LayoutBrief["roomType"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="living">Living</SelectItem>
                  <SelectItem value="lounge">Lounge</SelectItem>
                  <SelectItem value="salon">Salon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Style</Label>
              <Select value={brief.style} onValueChange={(v) => setBrief((b) => ({ ...b, style: v as LayoutBrief["style"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quiet-luxury">Quiet luxury</SelectItem>
                  <SelectItem value="sculptural">Sculptural</SelectItem>
                  <SelectItem value="warm-minimal">Warm minimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Total budget (EUR)</Label>
            <Input type="number" min={5000} step={1000} value={brief.totalBudget}
              onChange={(e) => setBrief((b) => ({ ...b, totalBudget: Math.max(0, Number(e.target.value) || 0) }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["width", "length", "height"] as const).map((k) => (
              <div key={k}>
                <Label className="text-xs capitalize">{k} (m)</Label>
                <Input type="number" step={0.1} value={brief.roomDimensions[k]} onChange={(e) => dim(k, e.target.value)} />
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate Room Layout
          </Button>
        </section>

        <section className="space-y-2">
          <p className={micro}>Budget status</p>
          <Progress value={pct} />
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-muted-foreground">Budget</dt><dd>{eur(fin?.totalBudget ?? brief.totalBudget)}</dd></div>
            <div><dt className="text-muted-foreground">Allocated</dt><dd>{eur(fin?.allocatedSpend ?? 0)}</dd></div>
            <div><dt className="text-muted-foreground">Buffer</dt><dd className={fin && fin.remainingBuffer < 0 ? "text-destructive" : ""}>{eur(fin?.remainingBuffer ?? brief.totalBudget)}</dd></div>
          </dl>
        </section>

        {scene && (
          <section className="space-y-1">
            <p className={micro}>Curated pieces ({scene.curatedAssets.length})</p>
            <ul className="divide-y divide-border text-xs">
              {scene.curatedAssets.map((a, i) => (
                <li key={`${a.sku}-${i}`} className="flex justify-between py-1.5">
                  <span>{catalogueName(a.sku)}</span><span className="text-muted-foreground">{eur(a.priceAtCuration)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      <div className="relative h-[70vh] min-h-[520px] border border-border bg-muted/30">
        {!scene && !loading && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Set a brief and generate a layout.</div>
        )}
        {scene && (
          <Canvas shadows dpr={[1, 1.5]} onPointerMissed={() => setSelectedId(null)}>
            <PerspectiveCamera makeDefault fov={45} position={[scene.roomDimensions.width * 0.9, scene.roomDimensions.height * 1.6, scene.roomDimensions.length * 1.1]} />
            <OrbitControls makeDefault enabled={!dragging} maxPolarAngle={Math.PI / 2.05} target={[0, 0.5, 0]} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1.1} castShadow />
            <Suspense fallback={null}><Environment preset="apartment" /></Suspense>
            <ContactShadows position={[0, 0.002, 0]} scale={20} opacity={0.3} blur={1.2} far={8} />
            <AICuratedEnvironment schema={scene} selectedId={selectedId} onSelect={setSelectedId}
              onAssetTransform={onAssetTransform} onDragStateChange={setDragging} />
          </Canvas>
        )}
      </div>
    </div>
  );
};

export default TradeAILayoutStudio;
