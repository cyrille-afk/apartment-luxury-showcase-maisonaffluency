import { describe, expect, it, vi } from "vitest";
import { cachedModelBytes } from "./visualiserModelCache";

describe("cachedModelBytes", () => {
  it("downloads a model once and reuses it on restart", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const a = await cachedModelBytes("https://x.test/m.glb", fetcher as unknown as typeof fetch);
    const b = await cachedModelBytes("https://x.test/m.glb", fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new Uint8Array(b)).toEqual(new Uint8Array(a));
  });
});
