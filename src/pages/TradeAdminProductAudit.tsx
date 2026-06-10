/**
 * Side-by-side audit of Public vs Trade product sheets.
 * Embeds both pages directly for fast UI/UX inspection, with popup/tab
 * actions kept as fallbacks for browser-specific preview issues.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ExternalLink, LayoutPanelLeft, RefreshCw, X } from "lucide-react";

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
  const [reloadKey, setReloadKey] = useState(0);
  const popupsRef = useRef<{ left: Window | null; right: Window | null }>({
    left: null,
    right: null,
  });

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

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const publicUrl = selected?.designerSlug
    ? `${origin}/designers/${selected.designerSlug}/${selected.productSlug}`
    : null;
  const tradeUrl = selected?.designerSlug
    ? `${origin}/trade/products/${selected.designerSlug}/${selected.productSlug}`
    : selected
    ? `${origin}/trade/products/${selected.id}`
    : null;

  const openSideBySide = () => {
    if (!publicUrl || !tradeUrl) return;

    // Close existing popups if still open
    try { popupsRef.current.left?.close(); } catch { /* noop */ }
    try { popupsRef.current.right?.close(); } catch { /* noop */ }

    const screenW = window.screen.availWidth || window.innerWidth;
    const screenH = window.screen.availHeight || window.innerHeight;
    const screenLeft = (window.screen as any).availLeft ?? 0;
    const screenTop = (window.screen as any).availTop ?? 0;
    const w = Math.floor(screenW / 2);
    const h = screenH;

    const features = (left: number) =>
      `popup=yes,noopener=no,width=${w},height=${h},left=${left},top=${screenTop},menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes`;

    const leftWin = window.open(publicUrl, "audit-public", features(screenLeft));
    const rightWin = window.open(tradeUrl, "audit-trade", features(screenLeft + w));

    popupsRef.current.left = leftWin;
    popupsRef.current.right = rightWin;

    if (!leftWin || !rightWin) {
      toast({
        title: "Popups blocked",
        description:
          "Allow pop-ups for this site so both audit windows can open side by side.",
        variant: "destructive",
      });
    } else {
      // Pull both windows to the front
      try { leftWin.focus(); } catch { /* noop */ }
      try { rightWin.focus(); } catch { /* noop */ }
    }
  };

  const reload = () => {
    setReloadKey((key) => key + 1);
    try { popupsRef.current.left?.location.reload(); } catch { /* noop */ }
    try { popupsRef.current.right?.location.reload(); } catch { /* noop */ }
  };

  const closeAll = () => {
    try { popupsRef.current.left?.close(); } catch { /* noop */ }
    try { popupsRef.current.right?.close(); } catch { /* noop */ }
    popupsRef.current = { left: null, right: null };
  };

  // Close popups if user navigates away from the audit page
  useEffect(() => () => closeAll(), []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Product Sheet Audit</h1>
          <p className="text-sm text-muted-foreground">
            Inspect the Public and Trade product sheets side by side in-page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={publicUrl || "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!publicUrl}
            onClick={(e) => { if (!publicUrl) e.preventDefault(); }}
            className={`inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent ${!publicUrl ? "pointer-events-none opacity-50" : ""}`}
          >
            <ExternalLink className="h-4 w-4" /> Open Public tab
          </a>
          <a
            href={tradeUrl || "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!tradeUrl}
            onClick={(e) => { if (!tradeUrl) e.preventDefault(); }}
            className={`inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent ${!tradeUrl ? "pointer-events-none opacity-50" : ""}`}
          >
            <ExternalLink className="h-4 w-4" /> Open Trade tab
          </a>
          <Button variant="outline" size="sm" onClick={reload} disabled={!selected}>
            <RefreshCw className="mr-2 h-4 w-4" /> Reload previews
          </Button>
        </div>

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
          Pick a product above to load both views side by side.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[
            { label: "Public view", url: publicUrl, tone: "Public sees 'Price on Request'" },
            { label: "Trade view", url: tradeUrl, tone: "Trade sees pricing & spec sheets" },
          ].map((pane) => (
            <Card key={pane.label} className="overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{pane.label}</div>
                  <div className="text-xs text-muted-foreground">{pane.tone}</div>
                  {pane.url && (
                    <div className="mt-2 break-all text-[11px] text-muted-foreground/80">
                      {pane.url}
                    </div>
                  )}
                </div>
                {pane.url && (
                  <a
                    href={pane.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open tab <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {pane.url && (
                <iframe
                  key={`${pane.label}-${pane.url}-${reloadKey}`}
                  src={pane.url}
                  title={pane.label}
                  className="h-[calc(100vh-230px)] min-h-[720px] w-full bg-background"
                />
              )}
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Tip: use Open popups only if your browser blocks an embedded preview interaction.
      </p>
    </div>
  );
}
