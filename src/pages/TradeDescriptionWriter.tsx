import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles, Copy, Check, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Tone = "editorial" | "technical" | "seo";
type Source = "curator_picks" | "trade_products";

const TONES: { value: Tone; label: string; desc: string }[] = [
  { value: "editorial", label: "Editorial", desc: "Evocative storytelling for journals & social" },
  { value: "technical", label: "Technical", desc: "Precise specs for trade sheets & quotes" },
  { value: "seo", label: "SEO", desc: "Keyword-rich copy for product pages" },
];

export default function TradeDescriptionWriter() {
  const { isAdmin, loading } = useAuth();
  const [source, setSource] = useState<Source>("curator_picks");
  const [productId, setProductId] = useState("");
  const [tone, setTone] = useState<Tone>("editorial");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  // Fetch curator picks
  const { data: curatorPicks = [] } = useQuery({
    queryKey: ["desc-writer-curator-picks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designer_curator_picks")
        .select("id, title, designer_id, designers(display_name, name)")
        .order("title")
        .limit(500);
      return (data || []) as any[];
    },
    enabled: source === "curator_picks",
  });

  // Fetch trade products
  const { data: tradeProducts = [] } = useQuery({
    queryKey: ["desc-writer-trade-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name")
        .eq("is_active", true)
        .order("product_name")
        .limit(500);
      return (data || []) as any[];
    },
    enabled: source === "trade_products",
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-description-writer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ product_id: productId, source, tone }),
        }
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(body.error || `Error ${resp.status}`);
      }
      return resp.json();
    },
    onSuccess: (data) => {
      setResult(data.description || "");
      toast.success("Description generated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (source === "curator_picks") {
        const { error } = await supabase
          .from("designer_curator_picks")
          .update({ description: result })
          .eq("id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trade_products")
          .update({ description: result })
          .eq("id", productId);
        if (error) throw error;
      }
    },
    onSuccess: () => toast.success("Description saved to catalog"),
    onError: () => toast.error("Failed to save — check permissions"),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const items = source === "curator_picks" ? curatorPicks : tradeProducts;

  return (
    <>
      <Helmet><title>Description Writer — Admin — Maison Affluency</title></Helmet>

      <div className="max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-foreground">Product Description Writer</h1>
            <p className="font-body text-sm text-muted-foreground mt-0.5">
              AI-powered copy grounded in your catalog data
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Source */}
          <div className="space-y-1.5">
            <label className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Source</label>
            <select
              value={source}
              onChange={(e) => { setSource(e.target.value as Source); setProductId(""); setResult(""); }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
            >
              <option value="curator_picks">Curator Picks (Gallery)</option>
              <option value="trade_products">Trade Products (Showroom)</option>
            </select>
          </div>

          {/* Product */}
          <div className="space-y-1.5">
            <label className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Product</label>
            <select
              value={productId}
              onChange={(e) => { setProductId(e.target.value); setResult(""); }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
            >
              <option value="">Select a product…</option>
              {source === "curator_picks"
                ? items.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.title} — {p.designers?.display_name || p.designers?.name || "Unknown"}
                    </option>
                  ))
                : items.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name} — {p.brand_name}
                    </option>
                  ))
              }
            </select>
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <label className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tone</label>
            <div className="flex gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setTone(t.value); setResult(""); }}
                  title={t.desc}
                  className={`flex-1 rounded-md border px-2 py-2 font-body text-xs transition-colors ${
                    tone === t.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={() => generateMutation.mutate()}
          disabled={!productId || generateMutation.isPending}
          className="flex items-center gap-2 rounded-md bg-foreground text-background px-5 py-2.5 font-body text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {generateMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generateMutation.isPending ? "Generating…" : "Generate Description"}
        </button>

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="prose prose-sm max-w-none font-body text-foreground">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>

              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Saving…" : "Save to Catalog"}
              </button>

              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
