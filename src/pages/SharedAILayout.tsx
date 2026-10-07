import { Suspense, useEffect, useState } from "react";
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

type Shared = { title: string; scene: AICuratedSceneSchema; products: LayoutProductSnapshot[]; updated_at: string };

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

  if (state !== "ready" || !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-sm text-muted-foreground">
        <Helmet><title>Room Layout | Maison Affluency</title><meta name="robots" content="noindex, nofollow" /></Helmet>
        {state === "loading" ? "Loading layout…" : "This layout link is no longer available."}
      </div>
    );
  }

  const { scene, products } = data;
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
          <PerspectiveCamera makeDefault fov={45} position={[r.width * 1.3, r.height * 2.2, r.length * 1.6]} />
          <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} target={[0, 0.5, 0]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 10, 5]} intensity={1.1} castShadow />
          <Suspense fallback={null}><Environment preset="apartment" /></Suspense>
          <ContactShadows position={[0, 0.002, 0]} scale={20} opacity={0.3} blur={1.2} far={8} />
          <AICuratedEnvironment schema={scene} selectedId={null} onSelect={() => {}} onAssetTransform={() => {}} onDragStateChange={() => {}} isEditable={false} />
        </Canvas>
      </div>
    </div>
  );
};

export default SharedAILayout;
