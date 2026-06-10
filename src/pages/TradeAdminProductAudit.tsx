/**
 * Side-by-side audit of Public vs Trade product sheets.
 * Lets admins pick any curator pick and view both renditions in iframes to
 * verify UI/UX parity.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink, RefreshCw } from "lucide-react";

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Row = {
  id: string;
  title: string;
  subtitle: string | null;
  designerSlug: string | null;
  designerName: string;
  productSlug: string;
};

export default function TradeAdminProductAudit() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  const [nonce, setNonce] = useState(0);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-picks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select("id, title, subtitle, designer_id, designers:designer_id(name, slug)")
        .order("title");
      if (error) throw error;
      return (data || []).map((p: any): Row => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        designerSlug: p.designers?.slug ?? null,
        designerName: p.designers?.name ?? "—",
        productSlug: slugify(p.title + (p.subtitle ? `-${p.subtitle}` : "")),
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows.slice(0, 200);
    return rows
      .filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.designerName.toLowerCase().includes(q) ||
          (r.subtitle || "").toLowerCase().includes(q)
      )
      .slice(0, 200);
  }, [rows, query]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (selectedId) setParams({ id: selectedId }, { replace: true });
  }, [selectedId, setParams]);

  // Preserve Lovable preview token so iframed routes boot with the same session.
  // Also append a cache-busting nonce so "Reload frames" actually refetches.
  const appendQs = (path: string) => {
    if (typeof window === "undefined") return path;
    const token = new URLSearchParams(window.location.search).get("__lovable_token");
    const qs = new URLSearchParams();
    if (token) qs.set("__lovable_token", token);
    qs.set("_n", String(nonce));
    return `${path}?${qs.toString()}`;
  };

  const publicUrl = selected?.designerSlug
    ? appendQs(`/designers/${selected.designerSlug}/${selected.productSlug}`)
    : null;
  const tradeUrl = selected?.designerSlug
    ? appendQs(`/trade/products/${selected.designerSlug}/${selected.productSlug}`)
    : selected
    ? appendQs(`/trade/products/${selected.id}`)
    : null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Product Sheet Audit</h1>
          <p className="text-sm text-muted-foreground">
            Side-by-side review of Public vs Trade product pages.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setNonce((n) => n + 1)}
          disabled={!selected}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Reload frames
        </Button>
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            placeholder="Search product or designer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="md:max-w-sm"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm md:flex-1"
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            <option value="">
              {isLoading ? "Loading…" : `Select product (${filtered.length} shown)`}
            </option>
            {filtered.map((r) => (
              <option key={r.id} value={r.id}>
                {r.designerName} — {r.title}
                {r.subtitle ? ` (${r.subtitle})` : ""}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {!selected ? (
        <Card className="p-12 text-center text-muted-foreground">
          Pick a product above to compare its Public and Trade sheets side by side.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[
            { label: "Public view", url: publicUrl, tone: "Public sees 'Price on Request'" },
            { label: "Trade view", url: tradeUrl, tone: "Trade sees pricing & spec sheets" },
          ].map((pane) => (
            <Card key={pane.label} className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{pane.label}</div>
                  <div className="text-xs text-muted-foreground">{pane.tone}</div>
                </div>
                {pane.url && (
                  <a
                    href={pane.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {pane.url ? (
                <iframe
                  key={`${pane.label}-${nonce}-${pane.url}`}
                  src={pane.url}
                  title={pane.label}
                  className="h-[calc(100vh-220px)] w-full bg-white"
                />
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Designer slug missing — cannot build URL.
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
