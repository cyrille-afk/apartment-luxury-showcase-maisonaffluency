import { useEffect, useState } from "react";
import { Box, Download, FileBox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

interface CadAsset {
  id: string;
  variant_label: string | null;
  file_url: string;
  file_format: string;
  file_size_bytes: number | null;
  version: string | null;
}

const FORMAT_LABELS: Record<string, string> = {
  dwg: "AutoCAD (.dwg)",
  dxf: "Drawing Exchange (.dxf)",
  "3ds": "3ds Max (.3ds)",
  skp: "SketchUp (.skp)",
  rfa: "Revit Family (.rfa)",
  obj: "Wavefront (.obj)",
  fbx: "FBX (.fbx)",
  step: "STEP (.step)",
  iges: "IGES (.iges)",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  productId: string | null;
  productName?: string;
}

/**
 * CAD / 3D asset downloads for a trade product.
 * Files are grouped by optional variant_label (e.g. per size, per finish).
 * Trade-only: anonymous users see nothing; if no assets exist the section is hidden.
 */
export default function CadAssetsSection({ productId, productName }: Props) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<CadAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!productId || !user) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("trade_product_cad_assets")
        .select("id, variant_label, file_url, file_format, file_size_bytes, version")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("variant_label", { ascending: true, nullsFirst: true })
        .order("file_format", { ascending: true });
      if (!cancelled) {
        setAssets((data as CadAsset[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId, user]);

  if (!user || loading || !productId || assets.length === 0) return null;

  const handleDownload = async (asset: CadAsset) => {
    trackEvent("trade_cad_asset_download", {
      event_category: "Trade Product",
      event_label: `${productName || productId} – ${asset.file_format}`,
      product_id: productId,
      cad_format: asset.file_format,
      variant_label: asset.variant_label || "default",
    });
    try {
      await supabase.from("cad_asset_downloads").insert({
        cad_asset_id: asset.id,
        product_id: productId,
        file_format: asset.file_format,
        user_id: user.id,
      });
    } catch {
      /* non-blocking */
    }
    window.open(asset.file_url, "_blank", "noopener,noreferrer");
  };

  // Group by variant_label
  const groups = new Map<string, CadAsset[]>();
  for (const a of assets) {
    const key = a.variant_label || "__default__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return (
    <section className="border border-border rounded-md bg-card/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileBox className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="font-display text-sm text-foreground tracking-wide">CAD &amp; 3D Files</h3>
        <span className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Trade only
        </span>
      </div>
      <div className="space-y-3">
        {Array.from(groups.entries()).map(([variant, list]) => (
          <div key={variant}>
            {variant !== "__default__" && (
              <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                {variant}
              </p>
            )}
            <ul className="divide-y divide-border/60 rounded-md border border-border/60 overflow-hidden">
              {list.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => handleDownload(asset)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-background hover:bg-muted/40 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Box className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                      <span className="font-body text-xs text-foreground truncate">
                        {FORMAT_LABELS[asset.file_format] || asset.file_format.toUpperCase()}
                        {asset.version ? <span className="text-muted-foreground"> · {asset.version}</span> : null}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {asset.file_size_bytes ? (
                        <span className="font-body text-[10px] text-muted-foreground">
                          {formatBytes(asset.file_size_bytes)}
                        </span>
                      ) : null}
                      <Download className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
