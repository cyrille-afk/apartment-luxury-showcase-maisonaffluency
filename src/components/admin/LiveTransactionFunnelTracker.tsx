import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RefreshCw, Zap } from "lucide-react";

/**
 * Live Transaction Funnel Tracker
 * A self-contained telemetry simulator: animated particle stream across the
 * four commerce funnel stages, secondary conversion metrics, and admin controls.
 * No backend calls — it models traffic locally so admins can eyeball the shape
 * of the funnel under different volume / drop-off assumptions.
 */

type Region = "global" | "na" | "eu" | "apac";

const REGIONS: { id: Region; label: string; weight: number; aovBias: number }[] = [
  { id: "global", label: "Global", weight: 1, aovBias: 1 },
  { id: "na", label: "North America", weight: 0.38, aovBias: 1.12 },
  { id: "eu", label: "Europe", weight: 0.34, aovBias: 1.05 },
  { id: "apac", label: "Asia-Pacific", weight: 0.28, aovBias: 0.93 },
];

const STAGES = [
  { key: "views", label: "Views", color: "#3b82f6" },
  { key: "cart", label: "Cart Adds", color: "#22c55e" },
  { key: "checkout", label: "Checkout", color: "#f59e0b" },
  { key: "purchases", label: "Purchases", color: "#0f766e" },
] as const;

type Particle = {
  id: number;
  x: number; // 0..1 progress along the stream
  y: number; // -1..1 vertical jitter
  speed: number;
  r: number;
  dropAt: number | null; // x at which the session abandons
};

type LogEntry = { id: number; tone: "success" | "info"; text: string };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function LiveTransactionFunnelTracker() {
  const [running, setRunning] = useState(true);
  const [trafficVolume, setTrafficVolume] = useState(25); // req/s
  const [dropOff, setDropOff] = useState(40); // %
  const [region, setRegion] = useState<Region>("global");

  const [counts, setCounts] = useState({ views: 0, cart: 0, checkout: 0, purchases: 0 });
  const [revenue, setRevenue] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [, forceTick] = useState(0);

  const particlesRef = useRef<Particle[]>([]);
  const idRef = useRef(0);
  const spawnDebtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  const regionMeta = REGIONS.find((r) => r.id === region)!;

  const pushLog = useCallback((entry: Omit<LogEntry, "id">) => {
    setLogs((prev) => [{ ...entry, id: idRef.current++ }, ...prev].slice(0, 3));
  }, []);

  const reset = useCallback(() => {
    particlesRef.current = [];
    setCounts({ views: 0, cart: 0, checkout: 0, purchases: 0 });
    setRevenue(0);
    setLogs([]);
  }, []);

  // Animation + simulation loop
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    lastRef.current = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - lastRef.current) / 1000);
      lastRef.current = now;

      // Spawn new sessions proportional to traffic volume x regional weight.
      spawnDebtRef.current += dt * trafficVolume * regionMeta.weight * 0.5;
      let spawned = 0;
      while (spawnDebtRef.current >= 1 && particlesRef.current.length < 140) {
        spawnDebtRef.current -= 1;
        spawned += 1;
        const abandons = Math.random() < dropOff / 100;
        particlesRef.current.push({
          id: idRef.current++,
          x: 0,
          y: rand(-1, 1),
          speed: rand(0.09, 0.2) * (reduced ? 0.4 : 1),
          r: rand(2.5, 6),
          dropAt: abandons ? rand(0.2, 0.92) : null,
        });
      }

      let cart = 0;
      let checkout = 0;
      let purchases = 0;
      const alive: Particle[] = [];
      for (const p of particlesRef.current) {
        const prevX = p.x;
        p.x += p.speed * dt;
        p.y += Math.sin((now / 900 + p.id) % (Math.PI * 2)) * dt * 0.25;
        p.y = Math.max(-1, Math.min(1, p.y));

        if (p.dropAt !== null && p.x >= p.dropAt) continue; // abandoned
        if (prevX < 0.33 && p.x >= 0.33) cart += 1;
        if (prevX < 0.66 && p.x >= 0.66) checkout += 1;
        if (p.x >= 1) {
          purchases += 1;
          continue;
        }
        alive.push(p);
      }
      particlesRef.current = alive;

      if (spawned || cart || checkout || purchases) {
        setCounts((c) => ({
          views: c.views + spawned,
          cart: c.cart + cart,
          checkout: c.checkout + checkout,
          purchases: c.purchases + purchases,
        }));
      }
      if (purchases) {
        const value = purchases * rand(28, 46) * regionMeta.aovBias;
        setRevenue((r) => r + value);
        if (Math.random() < 0.4) {
          pushLog({ tone: "success", text: `Trigger: Order verified ($${(value / purchases).toFixed(0)})` });
        }
      } else if (Math.random() < dt * 0.35) {
        pushLog({ tone: "info", text: "Trigger: Dynamic load balanced" });
      }

      forceTick((t) => (t + 1) % 1000);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, trafficVolume, dropOff, regionMeta, pushLog]);

  const convRate = counts.views ? (counts.purchases / counts.views) * 100 : 0;
  const avgOrderVal = counts.purchases ? revenue / counts.purchases : 0;
  const abandonRate = counts.cart ? Math.max(0, (1 - counts.purchases / counts.cart) * 100) : 0;

  const particles = particlesRef.current;

  const stageColorFor = (x: number) =>
    x < 0.33 ? STAGES[0].color : x < 0.66 ? STAGES[1].color : x < 0.98 ? STAGES[2].color : STAGES[3].color;

  const nodePositions = useMemo(() => [0.04, 0.34, 0.66, 0.96], []);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-foreground">Live Transaction Funnel Tracker</h2>
          <p className="font-body text-xs text-muted-foreground mt-1">
            Simulated telemetry — tune traffic and drop-off to model conversion behaviour by market.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            aria-label="Reset simulation"
            className="h-9 w-9 grid place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            aria-label={running ? "Pause simulation" : "Resume simulation"}
            aria-pressed={running}
            className="h-9 w-9 grid place-items-center rounded-full bg-muted text-foreground hover:bg-accent transition-colors"
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* 1. Funnel hierarchy */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAGES.map((s) => (
          <div key={s.key} className="rounded-xl bg-muted/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-body text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{s.label}</span>
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {counts[s.key as keyof typeof counts].toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Particle stream */}
      <div className="relative mt-5 overflow-hidden rounded-xl bg-muted/30 ring-1 ring-border">
        <svg viewBox="0 0 1000 260" className="w-full h-[220px] sm:h-[260px]" role="img" aria-label="Live funnel particle stream">
          <defs>
            <linearGradient id="funnel-track" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
              <stop offset="45%" stopColor="#22c55e" stopOpacity="0.18" />
              <stop offset="75%" stopColor="#f59e0b" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#0f766e" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* narrowing track */}
          <path d="M 20 40 L 980 108 L 980 152 L 20 220 Z" fill="url(#funnel-track)" />
          <line x1="20" y1="130" x2="980" y2="130" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />

          {/* stage nodes */}
          {STAGES.map((s, i) => {
            const x = 20 + nodePositions[i] * 960;
            return <circle key={s.key} cx={x} cy={130} r={11} fill={s.color} opacity={0.9} />;
          })}

          {/* live particles */}
          {particles.map((p) => {
            const x = 20 + p.x * 960;
            const halfHeight = 88 - p.x * 58;
            const y = 130 + p.y * halfHeight * 0.55;
            const dropping = p.dropAt !== null && p.x > p.dropAt - 0.05;
            return (
              <circle
                key={p.id}
                cx={x}
                cy={dropping ? y + 46 * ((p.x - (p.dropAt ?? 0) + 0.05) / 0.05) : y}
                r={p.r}
                fill={dropping ? "#f87171" : stageColorFor(p.x)}
                opacity={dropping ? 0.4 : 0.85}
              />
            );
          })}
        </svg>

        {/* floating trigger logs */}
        <div className="pointer-events-none absolute left-3 bottom-3 flex flex-col gap-2">
          {logs.map((l) => (
            <span
              key={l.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium animate-fade-in ${
                l.tone === "success"
                  ? "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/25"
                  : "bg-blue-500/12 text-blue-700 ring-1 ring-blue-500/25"
              }`}
            >
              <Zap className="h-3 w-3" />
              {l.text}
            </span>
          ))}
        </div>
      </div>

      {/* 3. Secondary metrics */}
      <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-xl border border-border">
        {[
          { label: "Conv. Rate", value: `${convRate.toFixed(1)}%` },
          { label: "Avg Order Val", value: `$${avgOrderVal.toFixed(2)}` },
          { label: "Abandon Rate", value: `${abandonRate.toFixed(1)}%` },
        ].map((m) => (
          <div key={m.label} className="px-3 py-4 text-center">
            <div className="font-body text-[11px] text-muted-foreground">{m.label}</div>
            <div className="mt-1 text-base font-semibold tabular-nums text-foreground">{m.value}</div>
          </div>
        ))}
      </div>

      {/* 4. Controls */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="font-body text-xs text-muted-foreground">Traffic volume</span>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={120}
              value={trafficVolume}
              onChange={(e) => setTrafficVolume(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Traffic volume in requests per second"
            />
            <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{trafficVolume} req/s</span>
          </div>
        </label>

        <label className="block">
          <span className="font-body text-xs text-muted-foreground">Checkout drop-off</span>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={95}
              value={dropOff}
              onChange={(e) => setDropOff(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Checkout drop-off percentage"
            />
            <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{dropOff}%</span>
          </div>
        </label>
      </div>

      <div className="mt-5">
        <span className="font-body text-xs text-muted-foreground">Regional telemetry filter</span>
        <div className="mt-2 flex flex-wrap gap-1 rounded-full bg-muted p-1">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegion(r.id)}
              aria-pressed={region === r.id}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                region === r.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
