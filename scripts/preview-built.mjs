#!/usr/bin/env node
// Serves the production build (dist/) exactly as it runs once published:
// a Cloudflare Worker via wrangler. `vite preview` can't serve this build
// (it looks for dist/server/server.js, which the Worker build doesn't emit).
// Usage: node scripts/preview-built.mjs [--port 4173] [--strictPort]
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const i = args.indexOf("--port");
const port = i >= 0 ? args[i + 1] : "4173";

const child = spawn(
  "npx",
  ["-y", "wrangler@4", "dev", "--cwd", "./", "--ip", "127.0.0.1", "--port", port, "--log-level", "warn"],
  { cwd: "dist", stdio: "inherit", env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" } },
);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
