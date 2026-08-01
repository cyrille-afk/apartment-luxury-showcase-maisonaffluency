import { useEffect, useState } from "react";
import { Smartphone, FileText, Box, ExternalLink, BellRing, Check, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useStudioBridge, useStudioAlerts } from "@/hooks/useStudioBridge";
import { enablePush, disablePush, pushPermission, pushSupported } from "@/lib/push";
import { toast } from "sonner";

const CAD_FORMATS_3D = new Set(["glb", "gltf", "obj", "fbx", "3ds", "skp", "rvt", "3dm"]);

/**
 * Desktop-only "bridge" panel: everything the designer flagged from their
 * phone, with direct links to CAD, 3D and spec documentation.
 */
export function StudioBridgeSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, loading, markAllSeen } = useStudioBridge();
  const { alerts, dismiss } = useStudioAlerts();
  const [permission, setPermission] = useState(pushPermission());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setPermission(pushPermission());
  }, [open]);

  const togglePush = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (permission === "granted") {
        await disablePush();
        setPermission(pushPermission());
        toast("Push updates paused on this device");
      } else {
        const res = await enablePush(user.id);
        setPermission(pushPermission());
        if (res.ok) toast.success("Lead-time alerts enabled on this device");
        else if (res.reason === "denied") toast.error("Notifications are blocked in your browser settings");
        else if (res.reason === "unsupported") toast.error("This browser can't receive push updates");
        else toast.error("Couldn't enable alerts", { description: res.reason });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border text-left">
          <SheetTitle className="font-display text-lg tracking-wide flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-amber-600" />
            Flagged from mobile
          </SheetTitle>
          <SheetDescription className="font-body text-xs text-muted-foreground">
            Pieces you saved on the move, with their technical documentation ready to download.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {alerts.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Supply updates
              </h3>
              {alerts.map((a) => (
                <div key={a.id} className="border-l-2 border-amber-500 bg-amber-500/5 px-3 py-2">
                  <p className="font-body text-xs text-foreground">{a.title}</p>
                  <p className="font-body text-xs text-muted-foreground mt-1 leading-relaxed">{a.body}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {a.url && (
                      <button
                        onClick={() => {
                          onOpenChange(false);
                          navigate(a.url!);
                        }}
                        className="font-body text-[11px] uppercase tracking-wider text-foreground underline underline-offset-4"
                      >
                        Review
                      </button>
                    )}
                    <button
                      onClick={() => dismiss(a.id)}
                      className="font-body text-[11px] uppercase tracking-wider text-muted-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {loading && items.length === 0 && (
            <div className="flex items-center gap-2 text-muted-foreground font-body text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="font-body text-xs text-muted-foreground">
              Nothing new from mobile. Items you save from the PWA appear here.
            </p>
          )}

          {items.map((item) => {
            const three = item.cad_assets.filter((a) => CAD_FORMATS_3D.has(a.file_format.toLowerCase()));
            const cad = item.cad_assets.filter((a) => !CAD_FORMATS_3D.has(a.file_format.toLowerCase()));
            const finishes = [item.variant_label, item.fabric_label, item.wood_label].filter(Boolean);
            return (
              <article key={item.id} className="flex gap-3">
                <div className="w-16 h-16 shrink-0 bg-muted overflow-hidden">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {item.brand_name && (
                    <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {item.brand_name}
                    </p>
                  )}
                  <p className="font-display text-sm text-foreground truncate">{item.product_name}</p>
                  <p className="font-body text-[11px] text-muted-foreground">
                    {item.board_title} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                  {finishes.length > 0 && (
                    <p className="font-body text-[11px] text-muted-foreground italic">{finishes.join(" · ")}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                    {item.spec_sheet_url && (
                      <a
                        href={item.spec_sheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-wider text-foreground underline underline-offset-4"
                      >
                        <FileText className="h-3 w-3" /> Spec sheet
                      </a>
                    )}
                    {cad.map((a) => (
                      <a
                        key={a.id}
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-wider text-foreground underline underline-offset-4"
                      >
                        <ExternalLink className="h-3 w-3" /> {a.file_format.toUpperCase()}
                      </a>
                    ))}
                    {three.map((a) => (
                      <a
                        key={a.id}
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-wider text-foreground underline underline-offset-4"
                      >
                        <Box className="h-3 w-3" /> {a.file_format.toUpperCase()}
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="border-t border-border px-6 py-4 space-y-3">
          {pushSupported() && (
            <button
              onClick={togglePush}
              disabled={busy}
              className="w-full flex items-center justify-between font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <BellRing className="h-3.5 w-3.5" />
                Lead-time & availability alerts
              </span>
              <span className="inline-flex items-center gap-1 uppercase tracking-wider text-[10px]">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : permission === "granted" ? <Check className="h-3 w-3" /> : null}
                {permission === "granted" ? "On" : "Enable"}
              </span>
            </button>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-control font-body text-xs uppercase tracking-wider"
              onClick={() => {
                onOpenChange(false);
                navigate("/trade/boards");
              }}
            >
              Open project folders
            </Button>
            <Button
              className="flex-1 rounded-control font-body text-xs uppercase tracking-wider"
              disabled={items.length === 0}
              onClick={async () => {
                await markAllSeen();
                toast("Marked as reviewed");
              }}
            >
              Mark reviewed
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default StudioBridgeSidebar;
