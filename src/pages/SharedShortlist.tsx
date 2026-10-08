import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";

export interface ShortlistItem {
  id: string; product_name: string; brand_name: string; category?: string;
  dimensions?: string; materials?: string; lead_time?: string | null; image_url: string | null;
}

/** Client-facing shortlist: public-safe snapshot only, never prices. */
export default function SharedShortlist() {
  const { token } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["shared-shortlist", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shared_shortlist", { p_token: token! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const items = ((data?.items as unknown) as ShortlistItem[]) ?? [];
  const rows: [keyof ShortlistItem, string][] = [["brand_name", "Designer"], ["category", "Category"], ["dimensions", "Dimensions"], ["materials", "Materials"], ["lead_time", "Lead Time"]];
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Helmet><title>Shortlist — Maison Affluency</title><meta name="robots" content="noindex" /></Helmet>
      <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Maison Affluency</p>
      {isLoading ? <div className="py-20 flex justify-center"><DotCircleLoader size="sm" /></div> : !data ? (
        <p className="py-20 text-center font-body text-sm text-muted-foreground">This shortlist is unavailable.</p>
      ) : <>
        <h1 className="mt-2 font-display text-3xl text-foreground">{data.name}</h1>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[700px] table-fixed text-left">
            <thead><tr className="border-b border-border"><th className="w-36" />{items.map((p) => (
              <th key={p.id} className="px-4 py-4 align-top">
                {p.image_url && <img src={p.image_url} alt="" className="mb-3 h-36 w-full bg-muted object-contain" />}
                <p className="font-display text-sm font-normal text-foreground">{p.product_name}</p>
              </th>))}</tr></thead>
            <tbody>
              {rows.map(([k, label]) => (
                <tr key={k} className="border-b border-border/50">
                  <td className="px-4 py-2.5 font-body text-[10px] uppercase tracking-wider text-muted-foreground">{label}</td>
                  {items.map((p) => <td key={p.id} className="px-4 py-3 font-body text-sm text-foreground align-top">{(p[k] as string) || "—"}</td>)}
                </tr>))}
              <tr><td className="px-4 py-2.5 font-body text-[10px] uppercase tracking-wider text-muted-foreground">Price</td>
                {items.map((p) => <td key={p.id} className="px-4 py-3 font-body text-sm text-foreground">Price upon Request</td>)}</tr>
            </tbody>
          </table>
        </div>
      </>}
    </main>
  );
}
