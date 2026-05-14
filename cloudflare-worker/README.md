# Maison Affluency — Crawler Prerender Worker

Cloudflare Worker that fronts the Lovable origin on `maisonaffluency.com`.
Real users pass through unchanged; crawlers (Googlebot, social previews, AI
bots) get a fully-rendered HTML snapshot via Cloudflare Browser Rendering.

This lives **outside** the Lovable codebase — it deploys to your own
Cloudflare account, not through Lovable.

---

## What it does

| Request | Behavior |
|---|---|
| Real browser UA | Transparent reverse-proxy to `ORIGIN_HOST` (Lovable). No latency added. |
| Asset (`.png`, `.js`, `.css`, etc.) | Always proxied straight through. |
| Auth/admin routes (`/trade/*`, `/studio/*`, `/admin/*`, `/board/*`, `/api/*`) | Always proxied straight through. |
| Crawler UA on HTML route | Render with headless Chromium → cache in KV 24h → return snapshot. |
| Crawler UA, snapshot already cached | Return cached snapshot in ~10ms. |

Detected crawler UAs include: Googlebot, Bingbot, Yandex, Baidu, Applebot,
DuckDuckBot, GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot,
Anthropic-AI, facebookexternalhit, Twitterbot, LinkedInBot, Slackbot,
WhatsApp, TelegramBot, Discord, Pinterest, SemrushBot, AhrefsBot, MJ12Bot.

---

## Prerequisites

You need all of the following before this Worker can serve traffic:

1. **A Cloudflare account that owns `maisonaffluency.com`'s DNS zone.**
   The domain is currently fronted by Lovable's Cloudflare. To put your
   own Worker in front you must move authoritative DNS for the zone to
   your account and add Lovable's hosting as a CNAME origin record.
   - In your Cloudflare dashboard: **Add a site → maisonaffluency.com**.
   - Cloudflare will give you 2 nameservers — update them at your registrar.
   - Once active, add a DNS record:
     `CNAME  @  apartment-luxury-showcase-maisonaffluency.lovable.app  Proxied`
     and the same for `www`.

2. **Workers Paid plan** (~$5/mo). Required for Browser Rendering.

3. **Browser Rendering enabled.** In the dashboard:
   **Workers & Pages → Browser Rendering → Enable.**

4. **Node 20+** locally to run Wrangler.

---

## One-time setup

```bash
cd cloudflare-worker
npm install
npx wrangler login

# Create the KV namespace for snapshot cache; copy the returned id
# into wrangler.toml under [[kv_namespaces]].
npx wrangler kv namespace create PRERENDER_CACHE
```

Edit `wrangler.toml`:
- Paste the KV namespace `id` you just got.
- Confirm `ORIGIN_HOST` matches your Lovable hostname
  (current: `apartment-luxury-showcase-maisonaffluency.lovable.app`).

---

## Deploy

```bash
npm run deploy
```

Wrangler attaches the Worker to the routes listed in `wrangler.toml`
(`maisonaffluency.com/*` and `www.maisonaffluency.com/*`) automatically,
**provided the zone lives in the same Cloudflare account** you authed into.

---

## Verify

After deploy, run the same crawler-UA curl from before:

```bash
for url in "/" "/designers" "/journal" "/designers/alexander-lamont" "/journal/thierry-lemaire-radical-simplicity"; do
  echo "=== $url ==="
  curl -sA "Googlebot" -D- "https://maisonaffluency.com$url" -o /tmp/snap.html
  grep -oE '<title>[^<]*</title>' /tmp/snap.html | head -1
  grep -c '<div id="root">' /tmp/snap.html
done
```

Expected:
- Each route returns its **own** unique `<title>` (designer name, journal
  title, etc.) — not the homepage title.
- `x-prerender: 1` and `x-prerender-source: render` (first hit) or `cache`
  (subsequent hits) headers are present.
- The snapshot HTML contains the actual rendered content, not just
  `<div id="root">`.

Sanity check that real users still pass through:

```bash
curl -sA "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" -D- \
  "https://maisonaffluency.com/" -o /dev/null | grep -i x-prerender
# Should print nothing — real users bypass the renderer.
```

---

## Costs (rough)

- Workers Paid: $5/mo flat (10M req/mo included).
- Browser Rendering: priced per browser-minute. With 24h KV caching, you
  re-render each unique URL at most once per day. ~300 routes × 1 render/day
  × ~5s each ≈ 25 browser-minutes/day. Stay well within the free tier of
  10 hours/month included on the Paid plan.
- KV: trivial — snapshots are < 200 KB each, ~60 MB total.

---

## Tuning

Edit `src/worker.js`:
- `CRAWLER_UA` — extend the regex if a new bot starts hitting the site.
- `SKIP_PATTERNS` — add routes that should never be prerendered.
- `stripScripts()` — currently removes all `<script>` tags from snapshots.
  Remove the call in `renderSnapshot()` if you'd rather ship the bundle too.
- `CACHE_TTL_SEC` env var — shorten if content updates need to reach
  crawlers faster than 24h.

To purge a snapshot manually:

```bash
npx wrangler kv key delete --binding=CACHE "snap:/designers/alexander-lamont"
```

---

## Rollback

If anything misbehaves, disable the Worker route in the Cloudflare dashboard
(**Workers & Pages → maison-affluency-prerender → Triggers → Routes → delete**).
Traffic instantly resumes hitting the origin directly — no DNS change needed.
