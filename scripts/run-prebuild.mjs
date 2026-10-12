#!/usr/bin/env node
// Runs a data pre-build script with a hard time limit. If the backend is slow
// or unreachable, the script is killed and the previously committed output is
// kept, so publishing never hangs on a network call.
import { spawn } from "node:child_process";

const [script, limitArg] = process.argv.slice(2);
const limitMs = Number(limitArg || 90) * 1000;

const child = spawn(process.execPath, [script], { stdio: "inherit" });
const timer = setTimeout(() => {
  console.warn(`[prebuild] ${script} exceeded ${limitMs / 1000}s — keeping existing output`);
  child.kill("SIGKILL");
}, limitMs);

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  if (signal || code !== 0) {
    console.warn(`[prebuild] ${script} did not complete (code=${code}, signal=${signal}); continuing with existing output`);
  }
  process.exit(0);
});
