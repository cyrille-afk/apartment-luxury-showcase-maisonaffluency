#!/usr/bin/env node
/**
 * Lighthouse mobile performance gate.
 *
 * Runs Lighthouse (mobile form factor) against a built preview (or PW_BASE_URL),
 * takes the MEDIAN of N runs per route, and fails the build when the Core Web
 * Vitals lab metrics (FCP / LCP / CLS / TBT) or the category scores regress past
 * the budgets below. Reports (json + html) are written to ./lighthouse-report so
 * CI can upload them.
 *
 * Usage:
 *   npm run lighthouse:mobile                       # builds + previews + audits "/"
 *   ROUTES="/,/trade/login" LH_RUNS=3 npm run lighthouse:mobile
 *   PW_BASE_URL=https://example.com npm run lighthouse:mobile
 *
 * Env:
 *   ROUTES              comma-separated routes (default "/")
 *   LH_RUNS             audits per route, median wins (default 3)
 *   LH_THROTTLING       "simulate" (default) | "provided" | "devtools"
 *   LH_AUDIT_TIMEOUT_MS hard timeout per audit (default 240000)
 *   LH_WARN_ONLY        "1" → report but never fail (local exploration)
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const BASE = process.env.PW_BASE_URL?.replace(/\/$/, "") || "http://localhost:4173";
const ROUTES = (process.env.ROUTES || "/").split(",").map((s) => s.trim()).filter(Boolean);
const AUDIT_TIMEOUT_MS = Number(process.env.LH_AUDIT_TIMEOUT_MS || 240_000);
const RUNS = Math.max(1, Number(process.env.LH_RUNS || 3));
const THROTTLING = process.env.LH_THROTTLING || "simulate";
const WARN_ONLY = process.env.LH_WARN_ONLY === "1";

// Minimum category scores (0-1).
const SCORE_THRESHOLDS = {
  performance: 0.5,
  accessibility: 0.9,
};

// Maximum lab metric values (mobile, simulated 4G throttling).
// Keys are Lighthouse audit ids; values are numericValue budgets.
const METRIC_BUDGETS = {
  "first-contentful-paint": { max: 3000, unit: "ms", label: "FCP" },
  // Measured 3.7–4.6 s on the homepage under simulated 4G on CI-class hardware.
  "largest-contentful-paint": { max: 5000, unit: "ms", label: "LCP" },
  "cumulative-layout-shift": { max: 0.1, unit: "", label: "CLS" },
  // TBT is the noisiest metric on shared CI runners — budget is a regression
  // guard (measured ~1.6s on "/", ~0.2s on /trade/login), not a target.
  "total-blocking-time": { max: 2000, unit: "ms", label: "TBT" },
};

const outDir = join(process.cwd(), "lighthouse-report");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let preview;
let failed = false;

function fail(message) {
  console.error(message);
  if (!WARN_ONLY) process.exitCode = 1;
}

const T0 = Date.now();
const stamp = () => `${((Date.now() - T0) / 1000).toFixed(1)}s`;
const log = (msg) => console.log(`[${stamp()}] ${msg}`);

// Hard cap on the production build so a wedged pre-build data script can never
// eat the whole CI step budget silently (it used to hang past 18 minutes).
const BUILD_TIMEOUT_MS = Number(process.env.LH_BUILD_TIMEOUT_MS || 600_000);

async function runBuild() {
  log("→ Building production bundle…");
  const child = spawn("npm", ["run", "build"], { stdio: "inherit", detached: true });
  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      killProcessTree(child);
      resolve({ timedOut: true, status: null });
    }, BUILD_TIMEOUT_MS);
    child.once("error", (error) => { clearTimeout(timer); resolve({ error }); });
    child.once("exit", (status) => { clearTimeout(timer); resolve({ status }); });
  });
  if (result.timedOut) throw new Error(`Production build hard-timed-out after ${stamp()}`);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Production build failed (status ${result.status}) after ${stamp()}`);
  log("✓ Build complete");
}

async function startPreviewIfNeeded() {
  if (process.env.PW_BASE_URL) return;
  await runBuild();
  log("→ Starting preview server…");
  // Detached so the whole npm → vite process group can be killed at the end.
  // Without this, `npm run preview` dies but the vite child survives, keeps the
  // inherited pipes open and the CI step hangs until the job timeout.
  preview = spawn("npm", ["run", "preview", "--", "--port", "4173", "--strictPort"], {
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
  preview.unref();
  // Wait for preview to be reachable.
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) { log("✓ Preview reachable"); return; }
    } catch {}
    await wait(1000);
  }
  throw new Error("Preview server did not start in time");
}

function killProcessTree(child) {
  if (!child.pid) return;
  try {
    // Detached below gives Lighthouse/Chrome their own process group on Linux.
    process.kill(-child.pid, "SIGKILL");
  } catch (_) {
    try { child.kill("SIGKILL"); } catch (_) {}
  }
}

async function audit(url, outBase) {
  const args = [
    "lighthouse",
    url,
    "--quiet",
    // --disable-gpu + --no-sandbox prevents FAILED_DOCUMENT_REQUEST timeouts on
    // GitHub Actions headless runners.
    "--chrome-flags=--headless=new --no-sandbox --disable-setuid-sandbox --disable-gpu",
    "--form-factor=mobile",
    "--screenEmulation.mobile=true",
    "--screenEmulation.width=390",
    "--screenEmulation.height=844",
    "--screenEmulation.deviceScaleFactor=3",
    // Simulated mobile throttling by default so FCP/LCP/TBT reflect a real
    // phone on 4G instead of the (very fast) CI runner.
    `--throttling-method=${THROTTLING}`,
    "--disable-storage-reset",
    // Long-lived sockets (Supabase realtime, analytics beacons, version-watcher
    // polling) keep `networkidle` from ever firing on this app.
    "--max-wait-for-load=20000",
    "--output=json",
    "--output=html",
    `--output-path=${outBase}`,
    "--only-categories=performance,accessibility",
  ];
  const startedAt = Date.now();
  const child = spawn("npx", ["--no-install", ...args], {
    stdio: "inherit",
    detached: true,
  });
  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      killProcessTree(child);
      resolve({ timedOut: true, status: null, signal: "SIGKILL" });
    }, AUDIT_TIMEOUT_MS);

    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ error, status: null, signal: null, timedOut: false });
    });
    child.once("exit", (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, timedOut: false });
    });
  });
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (result.timedOut) throw new Error(`Lighthouse hard-timed-out after ${seconds}s for ${url}`);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Lighthouse failed after ${seconds}s for ${url} (status ${result.status}, signal ${result.signal ?? "none"})`);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function fmt(value, unit) {
  return unit === "ms" ? `${Math.round(value)} ms` : value.toFixed(3);
}

function collect(reportPaths) {
  const reports = reportPaths.map((p) => JSON.parse(readFileSync(p, "utf8")));
  const scores = {};
  for (const cat of Object.keys(SCORE_THRESHOLDS)) {
    const values = reports.map((r) => r.categories?.[cat]?.score).filter((v) => typeof v === "number");
    scores[cat] = values.length ? median(values) : null;
  }
  const metrics = {};
  for (const id of Object.keys(METRIC_BUDGETS)) {
    const values = reports
      .map((r) => r.audits?.[id]?.numericValue)
      .filter((v) => typeof v === "number");
    metrics[id] = values.length ? median(values) : null;
  }
  const mustPass = {};
  for (const id of ["viewport", "tap-targets", "content-width", "color-contrast", "viewport-meta"]) {
    const results = reports.map((r) => r.audits?.[id]).filter(Boolean);
    if (!results.length) continue;
    // Fail only when every run agrees the audit failed (kills one-off flakes).
    mustPass[id] = results.some((a) => a.score === 1 || a.score === null);
  }
  return { scores, metrics, mustPass };
}

function assertRoute(url, { scores, metrics, mustPass }) {
  const failures = [];

  for (const [id, budget] of Object.entries(METRIC_BUDGETS)) {
    const value = metrics[id];
    if (value === null) {
      failures.push(`${budget.label}: missing from Lighthouse report`);
      continue;
    }
    const ok = value <= budget.max;
    console.log(
      `  ${ok ? "✓" : "✗"} ${budget.label.padEnd(16)} ${fmt(value, budget.unit).padStart(9)}  (budget ${fmt(budget.max, budget.unit)})`
    );
    if (!ok) failures.push(`${budget.label}: ${fmt(value, budget.unit)} > ${fmt(budget.max, budget.unit)}`);
  }

  for (const [cat, min] of Object.entries(SCORE_THRESHOLDS)) {
    const score = scores[cat];
    if (score === null) {
      failures.push(`${cat}: missing from Lighthouse report`);
      continue;
    }
    const ok = score >= min;
    console.log(`  ${ok ? "✓" : "✗"} ${cat.padEnd(16)} ${(score * 100).toFixed(0).padStart(6)}/100  (min ${min * 100})`);
    if (!ok) failures.push(`${cat}: ${(score * 100).toFixed(0)} < ${min * 100}`);
  }

  for (const [id, passed] of Object.entries(mustPass)) {
    console.log(`  ${passed ? "✓" : "✗"} audit:${id}`);
    if (!passed) failures.push(`audit ${id} failed`);
  }

  if (failures.length) fail(`\n✗ ${url} failed:\n  - ${failures.join("\n  - ")}`);
}

try {
  await startPreviewIfNeeded();
  for (const route of ROUTES) {
    const url = `${BASE}${route.startsWith("/") ? route : `/${route}`}`;
    const slug = route.replace(/\W+/g, "_") || "root";
    console.log(`\n▸ Lighthouse mobile (${RUNS} run${RUNS > 1 ? "s" : ""}, throttling=${THROTTLING}): ${url}`);
    const reportPaths = [];
    for (let run = 1; run <= RUNS; run++) {
      const outBase = join(outDir, `report-${slug}-run${run}`);
      log(`→ audit run ${run}/${RUNS}`);
      await audit(url, outBase);
      log(`✓ audit run ${run}/${RUNS} done`);
      reportPaths.push(`${outBase}.report.json`);
    }
    assertRoute(url, collect(reportPaths));
  }
} catch (error) {
  failed = true;
  console.error(error);
  process.exitCode = 1;
} finally {
  if (preview) killProcessTree(preview);
  // Keep reports on failure for inspection.
  if (failed || process.exitCode === 1) {
    console.log(`\nReports kept at: ${outDir}`);
  } else {
    rmSync(outDir, { recursive: true, force: true });
  }
  clearTimeout(watchdog);
  // Force exit: stray Chrome/vite handles must never keep CI hanging.
  process.exit(process.exitCode ?? 0);
}
