import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertTriangle, CheckCircle2, ExternalLink, Image as ImageIcon, Wrench, Copy } from "lucide-react";
import { toast } from "sonner";

type Result = {
  requestedUrl: string;
  elapsedMs: number;
  wouldRender: boolean;
  issues: string[];
  warnings: string[];
  facebook: { status: number; finalUrl: string; contentType: string; bytes: number; error?: string };
  whatsapp: { status: number; finalUrl: string; contentType: string; bytes: number; error?: string };
  parsed: {
    og: Record<string, string>;
    tw: Record<string, string>;
    title: string;
    description: string;
    canonical: string;
  };
  imageCheck: null | { status: number; contentType: string; sizeKb?: number; ok: boolean; error?: string };
};

type Fix = {
  severity: "issue" | "warning";
  problem: string;
  tag: string;
  current?: string;
  expected: string;
  snippet: string;
  why: string;
};

const truncate = (s: string, n = 80) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const esc = (s: string) => s.replace(/"/g, "&quot;");

function buildFixes(r: Result): Fix[] {
  const og = r.parsed.og;
  const tw = r.parsed.tw;
  const fixes: Fix[] = [];

  const titleGuess = og["og:title"] || r.parsed.title || "Your page title";
  const descGuess = og["og:description"] || r.parsed.description || "Short, compelling description (max ~200 chars).";
  const urlGuess = og["og:url"] || r.parsed.canonical || r.requestedUrl;
  const imageGuess = og["og:image"] || "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:good,f_jpg/your-image.jpg";

  const addOg = (severity: Fix["severity"], problem: string, prop: string, expected: string, why: string, current?: string) => {
    fixes.push({
      severity, problem, tag: prop, current, expected, why,
      snippet: `<meta property="${prop}" content="${esc(expected)}" />`,
    });
  };

  for (const issue of r.issues) {
    if (issue.includes("og:title")) {
      addOg("issue", issue, "og:title", titleGuess,
        "Crawlers fall back to <title>, which is often too generic to render a rich card.", og["og:title"]);
    } else if (issue.includes("og:image fetch failed")) {
      addOg("issue", issue, "og:image", imageGuess,
        "The current og:image returns an error or wrong content-type. Use a publicly reachable HTTPS JPG/PNG.",
        og["og:image"]);
    } else if (issue.includes("og:image too large")) {
      addOg("issue", issue, "og:image",
        og["og:image"]?.replace(/q_[^/,]+/, "q_auto:good") || imageGuess,
        "WhatsApp drops images >300 KB; Facebook caps at ~8 MB. Lower quality or use f_auto.",
        og["og:image"]);
    } else if (issue.includes("missing og:image")) {
      addOg("issue", issue, "og:image", imageGuess,
        "No og:image means NO preview card — links render as plain text on every platform.");
    } else if (issue.includes("missing og:url")) {
      addOg("issue", issue, "og:url", urlGuess,
        "Without og:url, crawlers may dedupe to the wrong canonical and reuse stale previews.");
    } else if (issue.includes("missing og:site_name")) {
      addOg("issue", issue, "og:site_name", "Maison Affluency",
        "Sets the brand label shown above the title in WhatsApp / iMessage previews.");
    } else {
      fixes.push({ severity: "issue", problem: issue, tag: "—", expected: "", snippet: "", why: "Manual review required." });
    }
  }

  for (const w of r.warnings) {
    if (w.includes("og:url")) {
      addOg("warning", w, "og:url", urlGuess, "Helps crawlers identify the canonical page for caching.");
    } else if (w.includes("og:type")) {
      const guess = /\/journal\//.test(urlGuess) ? "article"
        : /\/(designers|collectibles|products)\//.test(urlGuess) ? "product"
        : "website";
      addOg("warning", w, "og:type", guess, "Controls how the card is classified (article/product/website).");
    } else if (w.includes("og:description")) {
      addOg("warning", w, "og:description", descGuess, "Without a description, the preview shows only the title.");
    } else if (w.includes("og:image dimensions")) {
      fixes.push({
        severity: "warning", problem: w, tag: "og:image:width / og:image:height",
        expected: "1200 × 630",
        snippet: `<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />`,
        why: "Lets crawlers pre-allocate the card; reduces flicker and avoids fallback rendering.",
      });
    } else if (w.includes("og:image is http")) {
      addOg("warning", w, "og:image", (og["og:image"] || "").replace(/^http:/, "https:") || imageGuess,
        "Facebook & WhatsApp reject mixed-content (http) images on https pages.",
        og["og:image"]);
    } else if (/og:image is \d+ KB/.test(w)) {
      const kb = w.match(/(\d+) KB/)?.[1];
      addOg("warning", w, "og:image",
        og["og:image"]?.replace(/q_[^/,]+/, "q_auto:good") || imageGuess,
        `Currently ${kb} KB — WhatsApp recommends ≤300 KB. Lower Cloudinary quality (q_auto:good) or use f_auto.`,
        og["og:image"]);
    } else {
      fixes.push({ severity: "warning", problem: w, tag: "—", expected: "", snippet: "", why: "Minor — won't block previews." });
    }
  }

  if (og["og:image"] && !tw["twitter:card"]) {
    fixes.push({
      severity: "warning", problem: "missing twitter:card", tag: "twitter:card",
      expected: "summary_large_image",
      snippet: `<meta name="twitter:card" content="summary_large_image" />`,
      why: "Without this, X/Twitter renders a small thumbnail instead of the large preview.",
    });
  }

  return fixes;
}

const TradeAdminSharePreview = () => {
  const [url, setUrl] = useState("");

  const run = useMutation({
    mutationFn: async (target: string): Promise<Result> => {
      const { data, error } = await supabase.functions.invoke("og-preview-check", {
        body: { url: target },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as Result;
    },
  });

  const r = run.data;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Share Preview Tester — Trade Admin</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <Link to="/trade/admin-dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Admin
            </Button>
          </Link>
          <h1 className="text-3xl font-serif mb-2">Share Preview Tester</h1>
          <p className="text-muted-foreground text-sm">
            Paste any URL. We fetch it as Facebook's and WhatsApp's crawler, parse the
            Open Graph tags, and HEAD-check the og:image to confirm a preview will render.
          </p>
        </div>

        <Card className="p-6 mb-6">
          <form
            className="grid gap-4 md:grid-cols-[1fr_auto] items-end"
            onSubmit={(e) => { e.preventDefault(); if (url.trim()) run.mutate(url.trim()); }}
          >
            <div>
              <Label htmlFor="url">URL to test</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://maisonaffluency.com/designers/..."
                autoFocus
              />
            </div>
            <Button type="submit" disabled={run.isPending || !url.trim()}>
              {run.isPending ? "Checking…" : "Check preview"}
            </Button>
          </form>
          {run.isError && (
            <p className="text-sm text-destructive mt-3">
              {(run.error as Error)?.message ?? "Check failed"}
            </p>
          )}
        </Card>

        {r && (
          <div className="space-y-4">
            <Card className={`p-5 border-2 ${r.wouldRender ? "border-green-600/40" : "border-destructive/40"}`}>
              <div className="flex items-start gap-3">
                {r.wouldRender ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {r.wouldRender
                      ? "Preview should render on Facebook and WhatsApp."
                      : "Preview will NOT render reliably."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Checked in {(r.elapsedMs / 1000).toFixed(1)}s · note: Meta/WhatsApp cache by URL for ~7 days.
                  </p>
                  {r.issues.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {r.issues.map((i) => (
                        <li key={i} className="text-sm text-destructive flex gap-2">
                          <span>•</span><span>{i}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.warnings.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {r.warnings.map((w) => (
                        <li key={w} className="text-sm text-amber-600 flex gap-2">
                          <span>•</span><span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>

            <FixesEditor result={r} />




            {r.parsed.og["og:image"] && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="h-4 w-4" />
                  <h2 className="font-medium">Preview card (what crawlers see)</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-[300px_1fr]">
                  <div className="aspect-[1.91/1] bg-muted overflow-hidden rounded border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.parsed.og["og:image"]}
                      alt="og:image"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                    />
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{r.parsed.og["og:title"] || r.parsed.title || <em className="text-muted-foreground">— no title —</em>}</p>
                    <p className="text-muted-foreground">{r.parsed.og["og:description"] || r.parsed.description || ""}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mt-2">
                      {(() => { try { return new URL(r.parsed.og["og:url"] || r.requestedUrl).hostname; } catch { return ""; } })()}
                    </p>
                    {r.imageCheck && (
                      <div className="mt-3 text-xs">
                        <Badge variant={r.imageCheck.ok ? "secondary" : "destructive"}>
                          image: HTTP {r.imageCheck.status} · {r.imageCheck.contentType || "?"}{r.imageCheck.sizeKb ? ` · ${r.imageCheck.sizeKb} KB` : ""}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-5">
              <h2 className="font-medium mb-3">Crawler responses</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <CrawlerBlock label="facebookexternalhit" info={r.facebook} />
                <CrawlerBlock label="WhatsApp" info={r.whatsapp} />
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-medium mb-3">Parsed tags</h2>
              <dl className="text-xs grid gap-1">
                {Object.entries(r.parsed.og).map(([k, v]) => (
                  <Field key={k} label={k} value={v} mono={k.includes("image") || k === "og:url"} />
                ))}
                {Object.entries(r.parsed.tw).map(([k, v]) => (
                  <Field key={k} label={k} value={v} mono={k.includes("image")} />
                ))}
                {r.parsed.canonical && <Field label="canonical" value={r.parsed.canonical} mono />}
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="font-medium mb-3">Force-rescrape elsewhere</h2>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(r.requestedUrl)}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm underline"
                >
                  Facebook Sharing Debugger <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(r.requestedUrl)}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm underline"
                >
                  LinkedIn Post Inspector <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                WhatsApp/iMessage have no public debugger — they refresh their cache on their own (~7 days).
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

const CrawlerBlock = ({ label, info }: { label: string; info: Result["facebook"] }) => (
  <div className="border rounded p-3">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm font-medium">{label}</span>
      <Badge variant={info.status === 200 ? "secondary" : "destructive"}>{info.status || "ERR"}</Badge>
    </div>
    <dl className="text-xs grid gap-1">
      <Field label="content-type" value={info.contentType} mono />
      <Field label="bytes" value={String(info.bytes)} mono />
      <Field label="final URL" value={info.finalUrl} mono />
      {info.error && <Field label="error" value={info.error} mono />}
    </dl>
  </div>
);

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="grid grid-cols-[110px_1fr] gap-2">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={mono ? "font-mono break-all" : "break-words"}>
      {value || <span className="italic text-muted-foreground">— empty —</span>}
    </dd>
  </div>
);

export default TradeAdminSharePreview;
