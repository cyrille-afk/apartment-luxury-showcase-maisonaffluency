// Classification layer for the AI Curatorial Guide.
// Returns { route: "FLASH" | "FRONTIER" }. The client enforces the 800ms
// budget and defaults to FRONTIER on timeout or failure.
import { requireUser } from "../_shared/auth.ts";
import { classifyCuratorialQuery } from "../_shared/curatorialRouter.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = await requireUser(req, "curatorial-route");
  if (!auth.ok) return json(auth.body, auth.status);

  const { prompt } = await req.json().catch(() => ({}));
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000) {
    return json({ error: "Invalid prompt" }, 400);
  }
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured" }, 500);

  try {
    const { classification, cache } = await classifyCuratorialQuery(prompt.trim(), apiKey);
    return json({
      route: classification.complexity === "complex" ? "FRONTIER" : "FLASH",
      confidence: classification.confidence,
      cached: cache.hit,
    });
  } catch (e) {
    console.error("curatorial-route failed", (e as Error).message);
    // Accuracy first: never silently downgrade.
    return json({ route: "FRONTIER", fallback: true });
  }
});
