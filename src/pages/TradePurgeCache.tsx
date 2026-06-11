import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";

const DOMAIN = "https://maisonaffluency.com";

const CORE_PATHS = [
  "/",
  "/designers",
  "/collectibles",
  "/gallery",
  "/new-in",
  "/journal",
  "/contact",
  "/concierge",
  "/apartment-tour",
  "/studios",
  "/trade-program",
  "/trade/login",
  "/trade/register",
  "/favorites",
];

export default function TradePurgeCache() {
  const [designerSlugs, setDesignerSlugs] = useState<string[]>([]);
  const [journalSlugs, setJournalSlugs] = useState<string[]>([]);
  const [studioSlugs, setStudioSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, j, s] = await Promise.all([
        supabase.from("designers").select("slug").not("slug", "is", null),
        supabase.from("journal_articles").select("slug").eq("published", true).not("slug", "is", null),
        supabase.from("studios").select("slug").not("slug", "is", null),
      ]);
      setDesignerSlugs(((d.data as any[]) || []).map((r) => r.slug).filter(Boolean));
      setJournalSlugs(((j.data as any[]) || []).map((r) => r.slug).filter(Boolean));
      setStudioSlugs(((s.data as any[]) || []).map((r) => r.slug).filter(Boolean));
    } catch (e: any) {
      toast.error(`Failed to load slugs: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const fullList = useMemo(() => {
    const urls = [
      ...CORE_PATHS,
      ...designerSlugs.map((s) => `/designers/${s}`),
      ...journalSlugs.map((s) => `/journal/${s}`),
      ...studioSlugs.map((s) => `/studios/${s}`),
    ].map((p) => `${DOMAIN}${p}`);
    return Array.from(new Set(urls)).sort();
  }, [designerSlugs, journalSlugs, studioSlugs]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied (${text.split("\n").length} line${text.includes("\n") ? "s" : ""})`);
    } catch {
      toast.error("Clipboard blocked");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <Helmet>
        <title>Purge Cloudflare Cache · Trade Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="space-y-2">
        <h1 className="text-3xl font-serif">Purge Cloudflare Cache</h1>
        <p className="text-muted-foreground">
          Use this when published changes don't appear on <code className="font-mono">maisonaffluency.com</code>.
          Cloudflare's edge can hold stale HTML even when the Lovable origin serves the latest build.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="font-medium">Quick steps</h2>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          <li>Open <a className="underline" href="https://dash.cloudflare.com/?to=/:account/:zone/caching/configuration" target="_blank" rel="noreferrer">Cloudflare → Caching → Configuration <ExternalLink className="inline h-3 w-3" /></a></li>
          <li>For a global fix: click <strong>Purge Everything</strong>.</li>
          <li>For a surgical fix: use <strong>Custom Purge → URL</strong> and paste the list below.</li>
          <li>To prevent recurrence, add a Cache Rule for <code className="font-mono">maisonaffluency.com/*</code> → <strong>Bypass cache</strong> for HTML (origin already sends <code className="font-mono">no-cache</code>).</li>
        </ol>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-medium">Critical URLs (always purge these)</h2>
          <Button size="sm" variant="outline" onClick={() => copy(CORE_PATHS.map((p) => `${DOMAIN}${p}`).join("\n"), "Critical URLs")}>
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
        </div>
        <Textarea
          readOnly
          rows={8}
          className="font-mono text-xs"
          value={CORE_PATHS.map((p) => `${DOMAIN}${p}`).join("\n")}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-medium">Full URL list</h2>
            <p className="text-xs text-muted-foreground">
              {fullList.length} URLs · {designerSlugs.length} designers · {journalSlugs.length} journal · {studioSlugs.length} studios
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Reload
            </Button>
            <Button size="sm" onClick={() => copy(fullList.join("\n"), "Full list")}>
              <Copy className="h-4 w-4 mr-1" /> Copy all
            </Button>
          </div>
        </div>
        <Textarea readOnly rows={16} className="font-mono text-xs" value={fullList.join("\n")} />
        <p className="text-xs text-muted-foreground">
          Cloudflare's Custom Purge accepts up to 30 URLs per request on Free / 500 on Pro+. Split the list if needed.
        </p>
      </section>

      <section className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
        <strong className="text-foreground">Why this happens:</strong> the Lovable origin sends{" "}
        <code className="font-mono">cache-control: no-cache, must-revalidate, max-age=0</code>, but Cloudflare can still
        serve HTML from its edge if a Cache Rule or page rule overrides it. Hashed JS/CSS under{" "}
        <code className="font-mono">/assets/*</code> are safe to cache — only the HTML shells need purging.
      </section>
    </div>
  );
}
