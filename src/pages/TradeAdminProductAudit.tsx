/**
 * Side-by-side audit of Public vs Trade product sheets.
 * Embeds both pages directly when possible, with a top-level split-window
 * renderer for the Lovable editor where nested iframes go blank.
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  const splitWindowRef = useRef<Window | null>(null);

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
    const currentId = params.get("id");
    if (selectedId === currentId) return;

    const next = new URLSearchParams(params);
    if (selectedId) next.set("id", selectedId);
    else next.delete("id");
    setParams(next, { replace: true });
  }, [params, selectedId, setParams]);

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

    try { splitWindowRef.current?.close(); } catch { /* noop */ }

    const splitWin = window.open("", "audit-split-inspector", "popup=yes,noopener=no,width=1600,height=1000,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes");
    splitWindowRef.current = splitWin;

    if (!splitWin) {
      toast({
        title: "Popups blocked",
        description:
          "Allow pop-ups for this site so the split inspector can open.",
        variant: "destructive",
      });
      return;
    }

    const title = selected ? `${selected.designerName} — ${selected.title}` : "Product Sheet Audit";
    splitWin.document.open();
    splitWin.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Split inspector</title>
<style>
html,body{margin:0;height:100%;background:#f7f4ee;color:#1f1b16;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}.bar{height:48px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 16px;border-bottom:1px solid rgba(31,27,22,.14);background:#fffdf8}.title{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.actions{display:flex;gap:8px;flex-shrink:0}a,button{height:30px;border:1px solid rgba(31,27,22,.18);background:#fffdf8;color:#1f1b16;padding:0 10px;border-radius:6px;font:inherit;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;cursor:pointer}.grid{height:calc(100% - 48px);display:grid;grid-template-columns:1fr 1fr}.pane{min-width:0;border-right:1px solid rgba(31,27,22,.14);display:flex;flex-direction:column}.pane:last-child{border-right:0}.pane-head{height:34px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;border-bottom:1px solid rgba(31,27,22,.1);font-size:11px;text-transform:uppercase;letter-spacing:.08em;background:#efe8dc}.pane-head span:last-child{text-transform:none;letter-spacing:0;color:#6f675d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%}iframe{width:100%;height:calc(100% - 34px);border:0;background:white}@media(max-width:900px){.grid{grid-template-columns:1fr}.pane{height:70vh;border-right:0;border-bottom:1px solid rgba(31,27,22,.14)}}
</style></head><body>
<div class="bar"><div class="title">${escapeHtml(title)}</div><div class="actions"><button onclick="location.reload()">Reload</button><a href="${escapeHtml(publicUrl)}" target="_blank" rel="noreferrer">Public tab</a><a href="${escapeHtml(tradeUrl)}" target="_blank" rel="noreferrer">Trade tab</a></div></div>
<main class="grid"><section class="pane"><div class="pane-head"><span>Public</span><span>${escapeHtml(publicUrl)}</span></div><iframe src="${escapeHtml(publicUrl)}" title="Public view"></iframe></section><section class="pane"><div class="pane-head"><span>Trade</span><span>${escapeHtml(tradeUrl)}</span></div><iframe src="${escapeHtml(tradeUrl)}" title="Trade view"></iframe></section></main>
</body></html>`);
    splitWin.document.close();
    try { splitWin.focus(); } catch { /* noop */ }
  };

  const reload = () => {
    setReloadKey((key) => key + 1);
    try { splitWindowRef.current?.location.reload(); } catch { /* noop */ }
  };

  const closeAll = () => {
    try { splitWindowRef.current?.close(); } catch { /* noop */ }
    splitWindowRef.current = null;
  };

  // Close popups if user navigates away from the audit page
  useEffect(() => () => closeAll(), []);

  // Detect being framed inside the Lovable editor — nested same-origin iframes
  // are blocked there, so embedded previews go blank. We force users to open
  // the audit in its own top-level tab where the iframes render normally.
  const isFramed =
    typeof window !== "undefined" && window.self !== window.top;
  const standaloneAuditUrl =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "";

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Product Sheet Audit</h1>
          <p className="text-sm text-muted-foreground">
            {isFramed
              ? "Open this page in its own tab to see Public & Trade side-by-side (nested iframes are blocked inside the editor)."
              : "Inspect the Public and Trade product sheets side by side in-page."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFramed && (
            <a
              href={standaloneAuditUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
            >
              <LayoutPanelLeft className="h-4 w-4" /> Open side-by-side in own tab
            </a>
          )}
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
        Tip: if an embedded preview looks blank (auth gate on Trade), use Open Trade tab.
      </p>
    </div>
  );
}
