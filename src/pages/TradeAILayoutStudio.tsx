import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Copy, Link2, Loader2, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { deleteLayout, listLayouts, saveLayout, setShared, shareUrl, snapshotProducts, type SavedLayout } from "@/lib/aiLayoutStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AICuratedEnvironment from "@/components/trade/visualiser/AICuratedEnvironment";
import { DEFAULT_BRIEF, fetchLiveCatalogue, generateRoomLayout, repriceScene, summarise, toAsset, type LayoutBrief, type LiveCatalogueItem } from "@/lib/mockAiLayoutService";
import type { AICuratedSceneSchema, Vec3 } from "@/types/aiCuratedScene";

const micro = "text-[10px] uppercase tracking-[0.15em] text-muted-foreground";
const stockLabel = (s: string | null) => (s ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Available");
const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const TradeAILayoutStudio = () => {
  const [brief, setBrief] = useState<LayoutBrief>(DEFAULT_BRIEF);
  const [scene, setScene] = useState<AICuratedSceneSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [catalogue, setCatalogue] = useState<LiveCatalogueItem[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [title, setTitle] = useState("Living room proposal");
  const [current, setCurrent] = useState<SavedLayout | null>(null);
  const [saved, setSaved] = useState<SavedLayout[]>([]);
  const [saving, setSaving] = useState(false);

  const refreshSaved = useCallback(async () => {
    try { setSaved(await listLayouts()); } catch { /* list stays empty */ }
  }, []);
  useEffect(() => { void refreshSaved(); }, [refreshSaved]);

  const save = async (asNew = false) => {
    if (!scene) return;
    setSaving(true);
    try {
      const row = await saveLayout({ id: asNew ? undefined : current?.id, title, brief, scene, products: snapshotProducts(scene, catalogue) });
      setCurrent(row);
      toast.success("Layout saved");
      void refreshSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save layout");
    } finally {
      setSaving(false);
    }
  };

  const toggleShare = async (on: boolean) => {
    if (!current) return;
    try {
      // Re-save first so the client sees the latest pieces and budget.
      if (on && scene) await saveLayout({ id: current.id, title, brief, scene, products: snapshotProducts(scene, catalogue) });
      await setShared(current.id, on);
      setCurrent({ ...current, is_shared: on });
      void refreshSaved();
      if (on) { await navigator.clipboard?.writeText(shareUrl(current.share_token)).catch(() => {}); toast.success("Share link copied"); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update sharing");
    }
  };

  const openSaved = (l: SavedLayout) => {
    setCurrent(l);
    setTitle(l.title);
    setBrief(l.brief);
    setSelectedId(null);
    setSkipped([]);
    setScene(catalogue.length ? repriceScene(l.scene, catalogue) : l.scene);
  };

  const removeSaved = async (l: SavedLayout) => {
    try {
      await deleteLayout(l.id);
      if (current?.id === l.id) setCurrent(null);
      void refreshSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete layout");
    }
  };

  const byId = useMemo(() => new Map(catalogue.map((c) => [c.componentId, c])), [catalogue]);

  const loadCatalogue = useCallback(async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const live = await fetchLiveCatalogue();
      setCatalogue(live);
      // Products changed upstream → re-price the current layout.
      setScene((s) => (s ? repriceScene(s, live) : s));
      return live;
    } catch (e) {
      setCatError(e instanceof Error ? e.message : "Could not load catalogue prices");
      return null;
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => { void loadCatalogue(); }, [loadCatalogue]);

  const generate = async () => {
    setLoading(true);
    setSelectedId(null);
    setCurrent(null);
    try {
      const live = (await loadCatalogue()) ?? catalogue;
      const { scene: next, skipped: miss } = await generateRoomLayout(brief, live);
      setScene(next);
      setSkipped(miss);
    } finally {
      setLoading(false);
    }
  };

  const withLedger = (next: AICuratedSceneSchema) => ({ ...next, financialSummary: summarise(next) });

  const swapAsset = (index: number, componentId: string) => {
    const item = byId.get(componentId);
    if (!item) return;
    setScene((s) => s && withLedger({
      ...s,
      curatedAssets: s.curatedAssets.map((a, i) => (i === index ? toAsset(item, a.position, a.rotation, a.scale) : a)),
    }));
  };

  const removeAsset = (index: number) => {
    setSelectedId(null);
    setScene((s) => s && withLedger({ ...s, curatedAssets: s.curatedAssets.filter((_, i) => i !== index) }));
  };

  // Budget edits apply to the live ledger immediately.
  useEffect(() => {
    setScene((s) => s && s.financialSummary.totalBudget !== brief.totalBudget
      ? withLedger({ ...s, financialSummary: { ...s.financialSummary, totalBudget: brief.totalBudget } })
      : s);
  }, [brief.totalBudget]);

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
          <p className="mt-1 text-xs text-muted-foreground">
            {catLoading ? "Loading live catalogue prices…" : catError ? `Prices unavailable: ${catError}` : `Live RRPs · ${catalogue.filter((c) => c.available).length} of ${catalogue.length} pieces available`}
          </p>
          <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs" onClick={() => void loadCatalogue()} disabled={catLoading}>
            <RefreshCw className={`mr-1 h-3 w-3 ${catLoading ? "animate-spin" : ""}`} /> Refresh prices
          </Button>
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
          <Button className="w-full" onClick={generate} disabled={loading || catLoading || !!catError}>
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
          <section className="space-y-2">
            <p className={micro}>Save &amp; share</p>
            <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Layout title" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => save()} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}{current ? "Save changes" : "Save layout"}
              </Button>
              {current && <Button size="sm" variant="ghost" onClick={() => save(true)} disabled={saving}>Save as new</Button>}
            </div>
            {current && (
              <div className="space-y-2 border border-border p-3">
                <label className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Read-only client link</span>
                  <Switch checked={current.is_shared} onCheckedChange={toggleShare} aria-label="Share with client" />
                </label>
                {current.is_shared && (
                  <div className="flex items-center gap-2">
                    <Input readOnly value={shareUrl(current.share_token)} className="h-8 text-xs" />
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Copy link"
                      onClick={() => navigator.clipboard?.writeText(shareUrl(current.share_token)).then(() => toast.success("Link copied"))}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {saved.length > 0 && (
          <section className="space-y-1">
            <p className={micro}>Saved layouts ({saved.length})</p>
            <ul className="divide-y divide-border text-xs">
              {saved.map((l) => (
                <li key={l.id} className="flex items-center gap-2 py-1.5">
                  <button className="flex-1 truncate text-left hover:underline" onClick={() => openSaved(l)}>
                    {l.title}{current?.id === l.id ? " ·" : ""}
                  </button>
                  {l.is_shared && <Link2 className="h-3 w-3 text-muted-foreground" aria-label="Shared" />}
                  <button aria-label="Delete layout" onClick={() => removeSaved(l)} className="text-muted-foreground hover:text-foreground"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {scene && (
          <section className="space-y-1">
            <p className={micro}>Curated pieces ({scene.curatedAssets.length})</p>
            <ul className="divide-y divide-border text-xs">
              {scene.curatedAssets.map((a, i) => {
                const item = byId.get(a.componentId);
                const options = catalogue.filter((c) => c.role === item?.role && c.available && c.price != null);
                return (
                  <li key={`${a.componentId}-${i}`} className="py-2">
                    <div className="flex items-center gap-2">
                      <Select value={a.componentId} onValueChange={(v) => swapAsset(i, v)}>
                        <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder={a.sku} /></SelectTrigger>
                        <SelectContent>
                          {options.map((c) => (
                            <SelectItem key={c.componentId} value={c.componentId} className="text-xs">{c.name} · {eur(c.price ?? 0)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="w-20 text-right">{item?.price != null ? eur(a.priceAtCuration) : "Price upon Request"}</span>
                      <button aria-label="Remove piece" onClick={() => removeAsset(i)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    <p className={`mt-0.5 ${item && !item.available ? "text-destructive" : "text-muted-foreground"}`}>
                      {!item ? "Not in live catalogue" : !item.available ? "No longer available" : item.leadWeeks ? `${stockLabel(item.stockStatus)} · ${item.leadWeeks[0]}–${item.leadWeeks[1]} weeks` : stockLabel(item.stockStatus)}
                    </p>
                  </li>
                );
              })}
            </ul>
            {skipped.length > 0 && <p className="pt-1 text-xs text-muted-foreground">Skipped: {skipped.join(", ")}</p>}
          </section>
        )}
      </aside>

      <div className="relative h-[70vh] min-h-[520px] border border-border bg-muted/30">
        {!scene && !loading && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Set a brief and generate a layout.</div>
        )}
        {scene && (
          <Canvas shadows dpr={[1, 1.5]} onPointerMissed={() => setSelectedId(null)}>
            <PerspectiveCamera makeDefault fov={45} position={[scene.roomDimensions.width * 1.3, scene.roomDimensions.height * 2.2, scene.roomDimensions.length * 1.6]} />
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
