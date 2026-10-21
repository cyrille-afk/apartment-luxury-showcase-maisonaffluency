import type { Plugin } from "vite";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

/** Build-time outputs ported from the pre-TanStack Vite config. */
export function emitVersionPlugin(buildId: string): Plugin {
  // Stamp the git commit SHA so the admin GitHub sync panel can tell whether
  // the deployed app is ahead of the synced GitHub repo (i.e. a sync is due).
  let commitSha: string | null = null;
  try {
    commitSha = execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    commitSha = null;
  }
  // Git-free fallback: digest of git blob SHAs for every file under src/.
  // The github-sync-status function computes the same digest from the repo tree.
  const sourceDigest = computeSourceDigest();
  return {
    name: "emit-version",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId, builtAt: new Date().toISOString(), commitSha, sourceDigest }),
      });
    },
  };
}

export function emitOgManifestPlugin(): Plugin {
  return {
    name: "emit-og-manifest",
    apply: "build",
    buildStart() {
      const publicDir = path.resolve(process.cwd(), "public");
      const ogTag = /<meta\s+property="og:image"\s+content=/i;
      const excludeNames = new Set(["index.html", "404.html"]);

      const out: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(abs);
          } else if (entry.isFile() && entry.name.endsWith(".html") && !excludeNames.has(entry.name)) {
            const html = fs.readFileSync(abs, "utf-8");
            if (ogTag.test(html)) {
              out.push(path.relative(publicDir, abs).split(path.sep).join("/"));
            }
          }
        }
      };
      walk(publicDir);
      out.sort();
      fs.writeFileSync(
        path.join(publicDir, "og-manifest.json"),
        JSON.stringify(out, null, 2) + "\n",
      );
    },
  };
}

export function environmentRobotsPlugin(): Plugin {
  const BLOCKED = "User-agent: *\nDisallow: /\nSitemap:\n";
  const isProductionHost = (host: string) =>
    /(^|\.)maisonaffluency\.com(:\d+)?$/i.test((host || "").split(",")[0].trim());

  const middleware = (req: any, res: any, next: any) => {
    const url = (req.url || "").split("?")[0];
    if (url !== "/robots.txt") return next();
    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    if (isProductionHost(String(host))) return next();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(BLOCKED);
  };

  return {
    name: "environment-robots",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

/** sha256 over sorted "path blobSha" lines for src/** (git blob SHA-1 per file). */
function computeSourceDigest(): string | null {
  try {
    const base = process.cwd();
    const lines: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.isFile()) {
          const buf = fs.readFileSync(full);
          const blob = crypto.createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
          lines.push(`${path.relative(base, full).split(path.sep).join("/")} ${blob}`);
        }
      }
    };
    walk(path.resolve(base, "src"));
    lines.sort();
    return crypto.createHash("sha256").update(lines.join("\n")).digest("hex");
  } catch {
    return null;
  }
}
