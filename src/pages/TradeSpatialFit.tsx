import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Upload, Loader2, FileBox, Ruler, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type CadDoc = {
  id: string;
  file_name: string;
  format: string;
  status: "pending" | "parsing" | "ready" | "failed" | "unsupported";
  error: string | null;
  parsed_geometry: any;
  created_at: string;
};

type Room = {
  label: string | null;
  bbox_mm: { w: number; d: number; h: number };
  area_m2: number;
  polygon: Array<[number, number]>;
};

type FitResult = {
  ok: boolean;
  verdict: "pass" | "warn" | "fail" | "unknown";
  reasons: Array<{ code: string; severity: string; message: string }>;
  room: Room;
  product: { id: string; bbox_mm: { w: number; d: number; h: number } | null; source: string };
  clearance_mm: number;
};

const ACCEPTED = ".dxf,.dwg,.obj,.fbx,.skp,.step,.iges,.3ds,.rfa";

export default function TradeSpatialFit() {
  const { user, loading: authLoading } = useAuth();
  const { currentStudio } = useStudio();
  const [params] = useSearchParams();
  const [docs, setDocs] = useState<CadDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string>(params.get("product_id") || "");
  const [productName, setProductName] = useState<string>(params.get("product_name") || "");
  const [clearance, setClearance] = useState<number>(600);
  const [fitting, setFitting] = useState(false);
  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [selectedRoomLabel, setSelectedRoomLabel] = useState<string | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    const q = supabase
      .from("cad_documents")
      .select("id, file_name, format, status, error, parsed_geometry, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    const { data } = currentStudio
      ? await q.eq("studio_id", currentStudio.id)
      : await q;
    setDocs((data as CadDoc[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user) fetchDocs();
  }, [user, authLoading, currentStudio?.id]);

  const activeDoc = useMemo(() => docs.find((d) => d.id === activeDocId) || null, [docs, activeDocId]);
  const rooms: Room[] = useMemo(() => activeDoc?.parsed_geometry?.rooms || [], [activeDoc]);

  useEffect(() => {
    if (rooms.length && !selectedRoomLabel) setSelectedRoomLabel(rooms[0].label || "__first__");
  }, [rooms, selectedRoomLabel]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ACCEPTED.includes(ext)) {
      toast({ title: "Unsupported file", description: `Choose one of: ${ACCEPTED}` });
      return;
    }
    setUploading(true);
    const folder = currentStudio?.id || user.id;
    const path = `${folder}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("cad-uploads").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: row, error: insErr } = await supabase
      .from("cad_documents")
      .insert({
        studio_id: currentStudio?.id || null,
        uploaded_by: user.id,
        file_path: path,
        file_name: file.name,
        format: ext,
        file_size_bytes: file.size,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !row) {
      setUploading(false);
      toast({ title: "Could not register file", description: insErr?.message || "Unknown error", variant: "destructive" });
      return;
    }
    // Kick off parsing
    const { error: fnErr } = await supabase.functions.invoke("cad-parse-upload", {
      body: { cad_document_id: row.id },
    });
    setUploading(false);
    if (fnErr) {
      toast({ title: "Parsing failed", description: fnErr.message, variant: "destructive" });
    } else {
      toast({ title: "Floor plan parsed", description: "Rooms extracted — pick one to check product fit." });
    }
    await fetchDocs();
    setActiveDocId(row.id);
    setSelectedRoomLabel(null);
  };

  const handleCheckFit = async () => {
    if (!activeDoc) return;
    if (!productId) {
      toast({ title: "Product required", description: "Paste a trade_product UUID to check fit." });
      return;
    }
    setFitting(true);
    setFitResult(null);
    const room = rooms.find((r) => (r.label || "__first__") === selectedRoomLabel) || rooms[0];
    const { data, error } = await supabase.functions.invoke<FitResult>("cad-check-fit", {
      body: {
        cad_document_id: activeDoc.id,
        room_label: room?.label || undefined,
        product_id: productId,
        clearance_mm: clearance,
      },
    });
    setFitting(false);
    if (error || !data) {
      toast({ title: "Check failed", description: error?.message || "Unknown error", variant: "destructive" });
      return;
    }
    setFitResult(data);
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <p className="text-muted-foreground">Sign in to use Spatial Fit.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Trade Tools</p>
          <h1 className="font-display text-3xl text-foreground">Spatial Fit</h1>
          <p className="font-body text-sm text-muted-foreground max-w-2xl">
            Upload a floor plan (DXF best supported) and we'll extract the rooms, then check whether a product fits with circulation clearance.
            DWG, FBX and SKP are accepted but fall back to the product's declared dimensions in this phase.
          </p>
        </header>

        {/* Upload */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base">Upload floor plan</h2>
          </div>
          <input
            type="file"
            accept={ACCEPTED}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded file:border file:border-border file:bg-muted file:text-foreground"
          />
          {uploading && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading and parsing…
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Visible to {currentStudio ? <strong>{currentStudio.name}</strong> : "you only"}. Files are private.
          </p>
        </Card>

        {/* Existing docs */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileBox className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base">Floor plans</h2>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : docs.length === 0 ? <p className="text-sm text-muted-foreground">No floor plans yet.</p>
            : (
              <ul className="divide-y divide-border/60 border border-border/60 rounded">
                {docs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => { setActiveDocId(d.id); setSelectedRoomLabel(null); setFitResult(null); }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40 ${activeDocId === d.id ? "bg-muted/60" : ""}`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-body text-sm text-foreground truncate">{d.file_name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">.{d.format}</span>
                      </span>
                      <span className="text-[11px] flex items-center gap-1">
                        {d.status === "ready" && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                        {d.status === "failed" && <XCircle className="h-3 w-3 text-destructive" />}
                        {d.status === "unsupported" && <Info className="h-3 w-3 text-amber-600" />}
                        {(d.status === "pending" || d.status === "parsing") && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span className="text-muted-foreground">{d.status}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        {/* Active doc */}
        {activeDoc && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary" /> {activeDoc.file_name}
              </h2>
              {activeDoc.parsed_geometry?.bbox_mm && (
                <p className="text-[11px] text-muted-foreground">
                  Plan bbox: {activeDoc.parsed_geometry.bbox_mm.w} × {activeDoc.parsed_geometry.bbox_mm.d} mm
                </p>
              )}
            </div>

            {activeDoc.status === "unsupported" && (
              <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-3">
                {activeDoc.error || "Format not supported in Phase 1."}
              </p>
            )}
            {activeDoc.status === "failed" && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3">
                {activeDoc.error || "Parse failed."}
              </p>
            )}

            {rooms.length > 0 && (
              <>
                <RoomSvg rooms={rooms} selectedLabel={selectedRoomLabel} onSelect={setSelectedRoomLabel} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Room</Label>
                    <select
                      className="w-full mt-1 border border-border bg-background rounded px-2 py-2 text-sm"
                      value={selectedRoomLabel || ""}
                      onChange={(e) => setSelectedRoomLabel(e.target.value)}
                    >
                      {rooms.map((r, i) => {
                        const key = r.label || `__first__`;
                        return (
                          <option key={i} value={key}>
                            {(r.label || `Room ${i + 1}`)} — {r.bbox_mm.w}×{r.bbox_mm.d}mm · {r.area_m2}m²
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Clearance around product (mm)</Label>
                    <Input
                      type="number"
                      value={clearance}
                      onChange={(e) => setClearance(Number(e.target.value) || 0)}
                      min={0}
                      step={50}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div>
                    <Label className="text-xs">Trade product ID</Label>
                    <Input
                      placeholder="UUID of the trade_product to test"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="mt-1 font-mono text-xs"
                    />
                    {productName && <p className="text-[11px] text-muted-foreground mt-1">{productName}</p>}
                  </div>
                  <Button onClick={handleCheckFit} disabled={fitting || !productId}>
                    {fitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ruler className="h-4 w-4 mr-2" />}
                    Check fit
                  </Button>
                </div>
              </>
            )}

            {activeDoc.status === "ready" && rooms.length === 0 && (
              <p className="text-sm text-muted-foreground">No closed rooms detected. Make sure room outlines are closed polylines on a layer named ROOM, SPACE or A-AREA.</p>
            )}
          </Card>
        )}

        {fitResult && <FitResultCard r={fitResult} />}

        <p className="text-[11px] text-muted-foreground">
          Looking for CAD files attached to a product? Open any product page in the Trade portal — the <Link to="/trade" className="underline">Trade product sheet</Link> exposes downloads, and Spatial Fit reads their geometry automatically.
        </p>
      </div>
    </div>
  );
}

function RoomSvg({ rooms, selectedLabel, onSelect }: { rooms: Room[]; selectedLabel: string | null; onSelect: (s: string) => void }) {
  // Compute global bounds across all polygons
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) for (const [x, y] of r.polygon) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return null;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const pad = Math.max(w, h) * 0.05;
  const vb = `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`;
  return (
    <div className="border border-border/60 rounded bg-muted/20 p-2">
      <svg viewBox={vb} className="w-full h-64" preserveAspectRatio="xMidYMid meet" style={{ transform: "scaleY(-1)" }}>
        {rooms.map((r, i) => {
          const key = r.label || `__first__`;
          const selected = selectedLabel === key;
          const pts = r.polygon.map(([x, y]) => `${x},${y}`).join(" ");
          return (
            <polygon
              key={i}
              points={pts}
              onClick={() => onSelect(key)}
              style={{ cursor: "pointer" }}
              fill={selected ? "hsl(var(--primary) / 0.25)" : "hsl(var(--muted-foreground) / 0.08)"}
              stroke={selected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.5)"}
              strokeWidth={Math.max(w, h) / 300}
            />
          );
        })}
      </svg>
    </div>
  );
}

function FitResultCard({ r }: { r: FitResult }) {
  const tone = r.verdict === "pass" ? "emerald" : r.verdict === "warn" ? "amber" : r.verdict === "fail" ? "destructive" : "muted";
  const Icon = r.verdict === "pass" ? CheckCircle2 : r.verdict === "fail" ? XCircle : AlertTriangle;
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
        <h3 className="font-display text-base uppercase tracking-wide">{r.verdict}</h3>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-body uppercase tracking-wider text-muted-foreground">Room</p>
          <p>{r.room.label || "Unlabelled"} — {r.room.bbox_mm.w}×{r.room.bbox_mm.d} mm</p>
        </div>
        <div>
          <p className="font-body uppercase tracking-wider text-muted-foreground">Product</p>
          <p>
            {r.product.bbox_mm
              ? `${r.product.bbox_mm.w}×${r.product.bbox_mm.d}×${r.product.bbox_mm.h} mm`
              : "No geometry available — declared dimensions missing too."}
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {r.reasons.map((reason, i) => (
          <li key={i} className="flex items-start gap-2">
            {reason.severity === "error" ? <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5" />
              : reason.severity === "warn" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5" />
              : <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />}
            <span>{reason.message}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">Clearance applied: {r.clearance_mm} mm around the product on every side.</p>
    </Card>
  );
}
