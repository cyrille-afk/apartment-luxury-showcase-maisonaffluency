#!/usr/bin/env node
/**
 * Lightweight Lighthouse mobile audit.
 *
 * Runs Lighthouse against a built preview (or PW_BASE_URL) and asserts
 * minimum scores for the mobile UX categories we actually request from
 * Lighthouse. PWA installability is covered by the Playwright manifest test.
 * Reports are written to ./lighthouse-report
 * so CI can upload them when the job fails.
 *
 * Usage:
 *   npm run lighthouse:mobile               # builds + previews + audits "/"
 *   PW_BASE_URL=https://example.com \
 *   ROUTES="/, /trade/login" npm run lighthouse:mobile
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const BASE = process.env.PW_BASE_URL?.replace(/\/$/, "") || "http://localhost:4173";
const ROUTES = (process.env.ROUTES || "/").split(",").map((s) => s.trim()).filter(Boolean);
const AUDIT_TIMEOUT_MS = Number(process.env.LH_AUDIT_TIMEOUT_MS || 240_000);

// Minimum scores (0-1).
const THRESHOLDS = {
  performance: 0.6,
  accessibility: 0.9,
};

const outDir = join(process.cwd(), "lighthouse-report");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let preview;
let failed = false;
async function startPreviewIfNeeded() {
  if (process.env.PW_BASE_URL) return;
  console.log("→ Building & starting preview…");
  const build = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
  preview = spawn("npm", ["run", "preview", "--", "--port", "4173", "--strictPort"], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  // Wait for preview to be reachable.
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
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
    // GitHub Actions headless runners (PWA CI fixes #1).
    "--chrome-flags=--headless=new --no-sandbox --disable-setuid-sandbox --disable-gpu",
    "--form-factor=mobile",
    "--screenEmulation.mobile=true",
    "--screenEmulation.width=390",
    "--screenEmulation.height=844",
    "--screenEmulation.deviceScaleFactor=3",
    // 'provided' disables Lighthouse's CPU/network throttling so tests are
    // less sensitive to variable CI runner specs (PWA CI fixes #2).
    "--throttling-method=provided",
    "--disable-storage-reset",
    // Tightened from 45s → 20s. Long-lived sockets (Supabase realtime,
    // analytics beacons, version-watcher polling) keep `networkidle` from
    // ever firing on this app, so LH would wait the full window every run.
    "--max-wait-for-load=20000",
    "--output=json",
    "--output=html",
    `--output-path=${outBase}`,
    // Dropped 'seo' and 'best-practices' from the CI pass — performance +
    // accessibility are the signals that gate mobile UX. Run the full set
    // locally when needed.
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

function assertScores(reportPath, url) {
  const json = JSON.parse(readFileSync(reportPath, "utf8"));
  const failures = [];
  for (const [cat, min] of Object.entries(THRESHOLDS)) {
    const category = json.categories?.[cat];
    if (!category) {
      failures.push(`${cat}: missing from Lighthouse report`);
      continue;
    }
    const score = category.score ?? 0;
    const status = score >= min ? "✓" : "✗";
    console.log(`  ${status} ${cat.padEnd(16)} ${(score * 100).toFixed(0)}/100 (min ${min * 100})`);
    if (score < min) failures.push(`${cat}: ${score} < ${min}`);
  }
  // Mobile-specific audits we always want green.
  const mustPass = ["viewport", "tap-targets", "content-width", "color-contrast", "viewport-meta"];
  for (const id of mustPass) {
    const a = json.audits?.[id];
    if (!a) continue;
    const passed = a.score === 1 || a.score === null;
    console.log(`  ${passed ? "✓" : "✗"} audit:${id}`);
    if (!passed) failures.push(`audit ${id} failed (${a.displayValue || ""})`);
  }
  if (failures.length) {
    console.error(`\n✗ ${url} failed:\n  - ${failures.join("\n  - ")}`);
    process.exitCode = 1;
  }
}

try {
  await startPreviewIfNeeded();
  for (const route of ROUTES) {
    const url = `${BASE}${route.startsWith("/") ? route : `/${route}`}`;
    const outBase = join(outDir, `report-${route.replace(/\W+/g, "_") || "root"}`);
    console.log(`\n▸ Lighthouse mobile: ${url}`);
    await audit(url, outBase);
    assertScores(`${outBase}.report.json`, url);
  }
} catch (error) {
  failed = true;
  console.error(error);
  process.exitCode = 1;
} finally {
  if (preview) preview.kill("SIGTERM");
  // Keep reports on failure for inspection.
  if (failed || process.exitCode === 1) {
    console.log(`\nReports kept at: ${outDir}`);
  } else {
    rmSync(outDir, { recursive: true, force: true });
  }
}
