import { GRAPH, getMetaToken, getInstagramMediaConnection } from "./metaToken.ts";

function assert(value: unknown, message: string) { if (!value) throw new Error(message); }

async function isolated(run: (requests: URL[]) => Promise<void>, reply: (url: URL) => unknown) {
  const fetchBefore = globalThis.fetch;
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "META_ACCESS_TOKEN"];
  const before = keys.map((key) => Deno.env.get(key));
  Deno.env.set("SUPABASE_URL", "http://localhost:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  Deno.env.set("META_ACCESS_TOKEN", "old-secret");
  const requests: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url);
    return new Response(JSON.stringify(reply(url)), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try { await run(requests); } finally {
    globalThis.fetch = fetchBefore;
    keys.forEach((key, index) => { const value = before[index]; if (value === undefined) Deno.env.delete(key); else Deno.env.set(key, value); });
  }
}

Deno.test("reconnected token replaces the old secret on every read", async () => {
  let saved = "new-login";
  await isolated(async () => {
    assert(await getMetaToken() === "new-login", "Saved login must win");
    saved = "next-login";
    assert(await getMetaToken() === "next-login", "Reconnect must take effect without cached tokens");
  }, () => ({ access_token: saved }));
});

Deno.test("missing saved connection retains the secret fallback", async () => {
  await isolated(async () => assert(await getMetaToken() === "old-secret", "Legacy token must remain available"), () => null);
});

Deno.test("saved Facebook login resolves linked IG media on Facebook Graph", async () => {
  await isolated(async (requests) => {
    const result = await getInstagramMediaConnection("new-login");
    assert(result.graph === GRAPH && result.accountId === "ig-123", "Media must address the linked IG account");
    assert(requests.length === 1 && requests[0].searchParams.get("access_token") === "new-login", "Must use the new login only");
  }, () => ({ data: [{ instagram_business_account: { id: "ig-123", username: "myaffluency" } }] }));
});

Deno.test("rejected saved login never falls back to old credentials", async () => {
  await isolated(async (requests) => {
    let rejected = false;
    try { await getInstagramMediaConnection("new-login"); } catch { rejected = true; }
    assert(rejected && requests.length === 1, "Reject the saved login without switching account/API");
  }, () => ({ error: { message: "Invalid login" } }));
});

Deno.test("legacy Instagram Login secret uses the Instagram Graph host", async () => {
  await isolated(async () => {
    const result = await getInstagramMediaConnection("old-secret");
    assert(result.graph === "https://graph.instagram.com/v21.0" && result.accountId === "legacy-ig", "Legacy media and carousel host must stay compatible");
  }, (url) => url.hostname === "graph.instagram.com" ? { id: "legacy-ig" } : { error: { message: "Not a Facebook login" } });
});