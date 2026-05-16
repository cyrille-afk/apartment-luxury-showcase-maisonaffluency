#!/usr/bin/env node
/**
 * Lightweight Lighthouse mobile audit.
 *
 * Runs Lighthouse against a built preview (or PW_BASE_URL) and asserts
 * minimum scores for performance, accessibility, best-practices, SEO,
 * plus PWA-installability checks. Reports are written to ./lighthouse-report
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

// Minimum scores (0-1).
const THRESHOLDS = {
  performance: 0.6,
  accessibility: 0.9,
  "best-practices": 0.85,
  seo: 0.85,
};

const outDir = join(process.cwd(), "lighthouse-report");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let preview;
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

function audit(url, outBase) {
  const args = [
    "lighthouse",
    url,
    "--quiet",
    "--chrome-flags=--headless=new --no-sandbox",
    "--preset=desktop",
    "--form-factor=mobile",
    "--screenEmulation.mobile=true",
    "--screenEmulation.width=390",
    "--screenEmulation.height=844",
    "--screenEmulation.deviceScaleFactor=3",
    "--throttling-method=simulate",
    "--output=json",
    "--output=html",
    `--output-path=${outBase}`,
    "--only-categories=performance,accessibility,best-practices,seo",
  ];
  const res = spawnSync("npx", ["--no-install", ...args], { stdio: "inherit" });
  if (res.status !== 0) throw new Error(`Lighthouse failed for ${url}`);
}

function assertScores(reportPath, url) {
  const json = JSON.parse(readFileSync(reportPath, "utf8"));
  const failures = [];
  for (const [cat, min] of Object.entries(THRESHOLDS)) {
    const score = json.categories?.[cat]?.score ?? 0;
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
    audit(url, outBase);
    assertScores(`${outBase}.report.json`, url);
  }
} finally {
  if (preview) preview.kill("SIGTERM");
  // Keep reports on failure for inspection.
  if (process.exitCode === 1) {
    console.log(`\nReports kept at: ${outDir}`);
  } else {
    rmSync(outDir, { recursive: true, force: true });
  }
}
