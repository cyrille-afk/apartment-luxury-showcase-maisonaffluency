import type { Plugin } from "vite";

/** DOM source labels use hyphen-path setters in R3F and cannot enter its host tree. */
export function visualiserSourceLabels(): Plugin {
  return {
    name: "visualiser-dom-label-guard",
    enforce: "post",
    transform(code, id) {
      if (!id.replaceAll("\\", "/").includes("/src/components/trade/visualiser/") || !code.includes("data-tsd-source")) return null;
      return { code: code.replace(/\s*["']data-tsd-source["']\s*:\s*["'][^"']*["']\s*,?/g, ""), map: null };
    },
  };
}