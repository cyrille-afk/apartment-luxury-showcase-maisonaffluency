import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Upload, Sparkles, Trash2, Save, FileText, Paintbrush, FileSpreadsheet, Scissors, RotateCw, Plus, Minus, Image as ImageIcon, Check, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";

type Placement = {
  product_id: string;
  reason: string;
  x: number; y: number; w: number; h: number; rotation: number;
  product: {
    id: string; title: string; designer: string; category: string;
    subcategory: string; materials: string; dimensions: string; image_url: string;
  };
};
type Room = { name: string; summary: string; items: Placement[] };
type Suggestions = { rooms: Room[] };

const BOARD_STORAGE_KEY = "mood-board-items";

export default function TradeFloorPlanFFE() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState("Untitled plan");
  const [uploading, setUploading] = useState(false);

  // Brief
  const [roomsText, setRoomsText] = useState("Living, Dining, Bedroom");
  const [style, setStyle] = useState("Refined modern, warm minimal");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  const [suggesting, setSuggesting] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [activeRoom, setActiveRoom] = useState<number>(0);
  const [selectedItem, setSelectedItem] = useState<{ room: number; item: number } | null>(null);
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);

  const PROGRESS_STEPS = [
    "Reading floor plan…",
    "Detecting rooms & circulation…",
    "Matching catalog pieces to brief…",
    "Placing furniture & fixtures…",
    "Refining proportions…",
    "Finalising layout…",
  ];

  // Auto-load most recent plan
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("trade_floor_plans")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setPlanId(data.id);
        setPlanUrl(data.plan_image_url);
        setPlanName(data.name);
        const b = (data.brief || {}) as any;
        if (Array.isArray(b.rooms)) setRoomsText(b.rooms.join(", "));
        if (b.style) setStyle(b.style);
        if (b.budget) setBudget(b.budget);
        if (b.notes) setNotes(b.notes);
        if (data.suggestions && (data.suggestions as any).rooms) {
          setSuggestions(data.suggestions as Suggestions);
          setConfirmed(true);
        }
      }
    })();
  }, [user]);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 20 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("floor-plans").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("floor-plans").createSignedUrl(path, 60 * 60 * 24 * 30);
      const url = signed?.signedUrl;
      if (!url) throw new Error("Could not sign URL");
      setPlanUrl(url);

      const { data: row, error: insErr } = await supabase
        .from("trade_floor_plans")
        .insert({ user_id: user.id, name: planName, plan_image_url: url })
        .select()
        .single();
      if (insErr) throw insErr;
      setPlanId(row.id);
      setSuggestions(null);
      setConfirmed(false);
      toast({ title: "Floor plan uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const runSuggest = async () => {
    if (!planUrl) {
      toast({ title: "Upload a floor plan first", variant: "destructive" });
      return;
    }
    setSuggesting(true);
    setProgressStep(0);
    setElapsed(0);
    const startedAt = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    const stepTimer = setInterval(() => {
      setProgressStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 2));
    }, 4500);
    try {
      const brief = {
        rooms: roomsText.split(",").map((s) => s.trim()).filter(Boolean),
        style, budget, notes,
      };
      const { data, error } = await supabase.functions.invoke("suggest-ffe-layout", {
        body: { plan_image_url: planUrl, brief },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const next = data as Suggestions;
      setProgressStep(PROGRESS_STEPS.length - 1);
      setSuggestions(next);
      setConfirmed(false);
      setActiveRoom(0);
      setSelectedItem(null);
      toast({
        title: "Layout ready for review",
        description: `${next.rooms?.length || 0} rooms · adjust on the plan, then Confirm & Save.`,
      });
    } catch (e: any) {
      toast({ title: "Could not generate layout", description: e.message, variant: "destructive" });
    } finally {
      clearInterval(tick);
      clearInterval(stepTimer);
      setSuggesting(false);
    }
  };

  const updateItem = (roomIdx: number, itemIdx: number, patch: Partial<Placement>) => {
    if (!suggestions) return;
    const next = { ...suggestions, rooms: suggestions.rooms.map((r) => ({ ...r, items: [...r.items] })) };
    next.rooms[roomIdx].items[itemIdx] = { ...next.rooms[roomIdx].items[itemIdx], ...patch };
    setSuggestions(next);
    setConfirmed(false);
  };

  const removeItem = (roomIdx: number, itemIdx: number) => {
    if (!suggestions) return;
    const next = { ...suggestions, rooms: suggestions.rooms.map((r, i) => ({
      ...r, items: i === roomIdx ? r.items.filter((_, j) => j !== itemIdx) : r.items,
    }))};
    setSuggestions(next);
    setSelectedItem(null);
    setConfirmed(false);
  };

  const discardSuggestions = () => {
    setSuggestions(null);
    setConfirmed(false);
    setSelectedItem(null);
    toast({ title: "Suggestion discarded" });
  };

  const saveLayout = async () => {
    if (!planId || !suggestions || !user) return;
    const brief = {
      rooms: roomsText.split(",").map((s) => s.trim()).filter(Boolean),
      style, budget, notes,
    };
    const { error } = await supabase
      .from("trade_floor_plans")
      .update({ suggestions: suggestions as any, brief, name: planName })
      .eq("id", planId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setConfirmed(true);
      toast({ title: "Layout confirmed & saved" });
    }
  };

  const allItems = useMemo(() => suggestions?.rooms.flatMap((r) => r.items) || [], [suggestions]);

  // Handoffs
  const sendToMoodBoard = () => {
    try {
      const existing = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY) || "[]");
      const seen = new Set(existing.map((x: any) => x.id));
      const additions = allItems
        .filter((it) => !seen.has(it.product_id))
        .map((it) => ({
          id: it.product_id,
          title: it.product.title,
          subtitle: it.product.designer,
          image_url: it.product.image_url,
          category: it.product.category,
          brand: it.product.designer,
        }));
      localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify([...existing, ...additions]));
      toast({ title: `Added ${additions.length} items to Mood Board` });
      navigate("/trade/mood-boards");
    } catch (e: any) {
      toast({ title: "Could not stage mood board", description: e.message, variant: "destructive" });
    }
  };

  const stageHandoff = (key: string, route: string, label: string) => {
    try {
      const payload = allItems.map((it) => ({
        curator_pick_id: it.product_id,
        title: it.product.title,
        designer: it.product.designer,
        image_url: it.product.image_url,
        reason: it.reason,
        room: suggestions?.rooms.find((r) => r.items.includes(it))?.name,
      }));
      sessionStorage.setItem(key, JSON.stringify({ source: "floor-plan-ffe", plan_id: planId, items: payload, ts: Date.now() }));
      toast({ title: `${payload.length} items staged for ${label}`, description: "Open the tool to review." });
      navigate(route);
    } catch (e: any) {
      toast({ title: "Could not stage", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Helmet>
        <title>Floor Plan → FF&E | Maison Affluency Trade</title>
        <meta name="description" content="Upload a floor plan, get an AI-suggested FF&E layout drawn from the Maison Affluency catalog, with adjustable placement preview." />
      </Helmet>

      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">Floor Plan → FF&amp;E</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Upload a plan, share a brief, and let the catalog do the heavy lifting.
          </p>
        </div>

        {/* Upload + Brief */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 p-5 rounded-xl border border-border bg-background">
            <h2 className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground">1 · Floor plan</h2>
            <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Plan name" />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading…" : (planUrl ? "Replace plan" : "Upload floor plan (image or PDF)")}
            </Button>
            {planUrl && (
              <div className="aspect-[4/3] w-full rounded-md overflow-hidden bg-muted border border-border">
                {/\.pdf($|\?)/i.test(planUrl) ? (
                  <iframe src={planUrl} className="w-full h-full" title="Floor plan" />
                ) : (
                  <img src={planUrl} alt="Floor plan" className="w-full h-full object-contain" />
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 p-5 rounded-xl border border-border bg-background">
            <h2 className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground">2 · Brief</h2>
            <div>
              <label className="font-body text-xs text-muted-foreground">Rooms (comma-separated)</label>
              <Input value={roomsText} onChange={(e) => setRoomsText(e.target.value)} placeholder="Living, Dining, Bedroom" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Style</label>
              <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Refined modern, warm minimal" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Budget (optional)</label>
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. €120k FF&E" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Client preferences, materials to avoid, anchor pieces…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={runSuggest} disabled={!planUrl || suggesting} className="w-full">
              {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {suggesting ? "Composing layout…" : "Suggest FF&E layout"}
            </Button>
            {suggesting && (
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3" aria-live="polite">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${Math.round(((progressStep + 1) / PROGRESS_STEPS.length) * 100)}%` }}
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-foreground">{PROGRESS_STEPS[progressStep]}</p>
                    <p className="font-body text-xs text-muted-foreground mt-0.5">
                      Step {progressStep + 1} of {PROGRESS_STEPS.length} · {elapsed}s elapsed · usually 20–45s
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {PROGRESS_STEPS.map((label, i) => (
                    <li
                      key={label}
                      className={`flex items-center gap-2 text-xs font-body ${
                        i < progressStep ? "text-foreground/70" : i === progressStep ? "text-foreground" : "text-muted-foreground/60"
                      }`}
                    >
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          i < progressStep ? "bg-primary" : i === progressStep ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                        }`}
                      />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Suggestions */}
        {suggestions && suggestions.rooms.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-display text-lg text-foreground">Proposed layout</h2>
                {confirmed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-body bg-primary/10 text-primary border border-primary/20">
                    <Check className="w-3 h-3" /> Confirmed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-body bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    <AlertCircle className="w-3 h-3" /> Pending review
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={confirmed ? "outline" : "default"}
                  size="sm"
                  onClick={saveLayout}
                  disabled={confirmed}
                >
                  <Check className="w-4 h-4" />{confirmed ? "Saved" : "Confirm & Save"}
                </Button>
                <Button variant="outline" size="sm" onClick={discardSuggestions}>
                  <X className="w-4 h-4" />Discard
                </Button>
                <Button variant="outline" size="sm" onClick={sendToMoodBoard}><Paintbrush className="w-4 h-4" />Mood Board</Button>
                <Button variant="outline" size="sm" onClick={() => stageHandoff("trade:pendingFFE", "/trade/ffe-schedule", "FF&E Schedule")}>
                  <FileSpreadsheet className="w-4 h-4" />FF&amp;E Schedule
                </Button>
                <Button variant="outline" size="sm" onClick={() => stageHandoff("trade:pendingQuote", "/trade/quotes", "Quote Builder")}>
                  <FileText className="w-4 h-4" />Quote
                </Button>
                <Button variant="outline" size="sm" onClick={() => stageHandoff("trade:pendingTearsheet", "/trade/tearsheets", "Tearsheets")}>
                  <Scissors className="w-4 h-4" />Tearsheets
                </Button>
              </div>
            </div>

            {!confirmed && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-body text-xs text-amber-800 dark:text-amber-300">
                Drag pieces on the floor plan, adjust size & rotation, or remove items. Then{" "}
                <strong>Confirm &amp; Save</strong> to lock this layout in.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {suggestions.rooms.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveRoom(i); setSelectedItem(null); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-body border transition-colors ${
                    i === activeRoom ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {r.name} · {r.items.length}
                </button>
              ))}
            </div>

            {/* Desktop canvas */}
            {!isMobile && planUrl && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                <CanvasPreview
                  planUrl={planUrl}
                  room={suggestions.rooms[activeRoom]}
                  selectedIdx={selectedItem?.room === activeRoom ? selectedItem?.item ?? null : null}
                  onSelect={(idx) => setSelectedItem({ room: activeRoom, item: idx })}
                  onMove={(idx, x, y) => updateItem(activeRoom, idx, { x, y })}
                />
                <SidePanel
                  room={suggestions.rooms[activeRoom]}
                  selectedIdx={selectedItem?.room === activeRoom ? selectedItem?.item ?? null : null}
                  onSelect={(idx) => setSelectedItem({ room: activeRoom, item: idx })}
                  onUpdate={(idx, patch) => updateItem(activeRoom, idx, patch)}
                  onRemove={(idx) => removeItem(activeRoom, idx)}
                />
              </div>
            )}

            {/* Mobile: overlay preview + list */}
            {isMobile && planUrl && (
              <div className="space-y-3">
                <CanvasPreview
                  planUrl={planUrl}
                  room={suggestions.rooms[activeRoom]}
                  selectedIdx={selectedItem?.room === activeRoom ? selectedItem?.item ?? null : null}
                  onSelect={(idx) => setSelectedItem({ room: activeRoom, item: idx })}
                  onMove={(idx, x, y) => updateItem(activeRoom, idx, { x, y })}
                />
                <MobileList
                  room={suggestions.rooms[activeRoom]}
                  onRemove={(idx) => removeItem(activeRoom, idx)}
                />
                <div className="sticky bottom-3 flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={saveLayout}
                    disabled={confirmed}
                    variant={confirmed ? "outline" : "default"}
                  >
                    <Check className="w-4 h-4" />{confirmed ? "Saved" : "Confirm & Save"}
                  </Button>
                  <Button variant="outline" onClick={discardSuggestions}>
                    <X className="w-4 h-4" />Discard
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Canvas (desktop) ---------- */
function CanvasPreview({
  planUrl, room, selectedIdx, onSelect, onMove,
}: {
  planUrl: string; room: Room; selectedIdx: number | null;
  onSelect: (i: number) => void; onMove: (i: number, x: number, y: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ idx: number; offsetX: number; offsetY: number } | null>(null);

  const beginDrag = (clientX: number, clientY: number, idx: number) => {
    onSelect(idx);
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      idx,
      offsetX: (clientX - rect.left) / rect.width - room.items[idx].x,
      offsetY: (clientY - rect.top) / rect.height - room.items[idx].y,
    });
  };

  const handleMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    beginDrag(e.clientX, e.clientY, idx);
  };

  const handleTouchStart = (e: React.TouchEvent, idx: number) => {
    e.stopPropagation();
    const t = e.touches[0];
    if (!t) return;
    beginDrag(t.clientX, t.clientY, idx);
  };

  useEffect(() => {
    if (!drag) return;
    const updateFromPoint = (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(0.98, Math.max(0.02, (clientX - rect.left) / rect.width - drag.offsetX));
      const y = Math.min(0.98, Math.max(0.02, (clientY - rect.top) / rect.height - drag.offsetY));
      onMove(drag.idx, x, y);
    };
    const onMove2 = (e: MouseEvent) => updateFromPoint(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      updateFromPoint(t.clientX, t.clientY);
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove2);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove2);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
  }, [drag, onMove]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full aspect-[4/3] rounded-lg border border-border bg-muted overflow-hidden select-none touch-none"
      onClick={() => onSelect(-1)}
    >
      {/\.pdf($|\?)/i.test(planUrl) ? (
        <iframe src={planUrl} className="w-full h-full pointer-events-none" title="Plan" />
      ) : (
        <img src={planUrl} alt="" className="w-full h-full object-contain pointer-events-none" />
      )}
      {room.items.map((it, idx) => (
        <div
          key={idx}
          onMouseDown={(e) => handleMouseDown(e, idx)}
          onTouchStart={(e) => handleTouchStart(e, idx)}
          className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move group ${
            selectedIdx === idx ? "ring-2 ring-foreground" : "ring-1 ring-foreground/30 hover:ring-foreground/60"
          } rounded-md overflow-hidden bg-background shadow-lg`}
          style={{
            left: `${it.x * 100}%`,
            top: `${it.y * 100}%`,
            width: `${Math.max(it.w, 0.06) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${it.rotation}deg)`,
          }}
          title={`${it.product.title} — ${it.product.designer}`}
        >
          {it.product.image_url ? (
            <img src={it.product.image_url} alt={it.product.title} className="w-full aspect-square object-cover" />
          ) : (
            <div className="w-full aspect-square flex items-center justify-center bg-muted text-muted-foreground">
              <ImageIcon className="w-4 h-4" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Side panel (desktop) ---------- */
function SidePanel({
  room, selectedIdx, onSelect, onUpdate, onRemove,
}: {
  room: Room; selectedIdx: number | null;
  onSelect: (i: number) => void;
  onUpdate: (i: number, patch: Partial<Placement>) => void;
  onRemove: (i: number) => void;
}) {
  const it = selectedIdx != null && selectedIdx >= 0 ? room.items[selectedIdx] : null;

  return (
    <div className="space-y-3 p-4 rounded-lg border border-border bg-background max-h-[600px] overflow-y-auto">
      <p className="font-body text-xs italic text-muted-foreground">{room.summary}</p>
      <div className="space-y-1.5">
        {room.items.map((x, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`w-full flex items-center gap-2 p-1.5 rounded text-left border ${
              selectedIdx === i ? "border-foreground bg-muted" : "border-transparent hover:bg-muted/50"
            }`}
          >
            <img src={x.product.image_url} alt="" className="w-10 h-10 object-cover rounded" />
            <div className="min-w-0 flex-1">
              <span className="block font-body text-xs font-medium text-foreground truncate">{x.product.title}</span>
              <span className="block font-body text-[10px] text-muted-foreground truncate">{x.product.designer}</span>
            </div>
          </button>
        ))}
      </div>

      {it && (
        <div className="space-y-2 pt-3 border-t border-border">
          <p className="font-body text-[11px] text-muted-foreground">{it.reason}</p>
          <div className="flex items-center gap-2">
            <span className="font-body text-[11px] text-muted-foreground w-12">Size</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdate(selectedIdx!, { w: Math.max(0.05, it.w - 0.02), h: Math.max(0.05, it.h - 0.02) })}>
              <Minus className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdate(selectedIdx!, { w: Math.min(0.4, it.w + 0.02), h: Math.min(0.4, it.h + 0.02) })}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-body text-[11px] text-muted-foreground w-12">Rotate</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdate(selectedIdx!, { rotation: (it.rotation + 15) % 360 })}>
              <RotateCw className="w-3 h-3" />
            </Button>
            <span className="font-body text-[11px] text-muted-foreground">{Math.round(it.rotation)}°</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => onRemove(selectedIdx!)} className="w-full">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------- Mobile list ---------- */
function MobileList({ room, onRemove }: { room: Room; onRemove: (i: number) => void }) {
  return (
    <div className="space-y-3">
      <p className="font-body text-xs italic text-muted-foreground">{room.summary}</p>
      {room.items.map((it, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
          <img src={it.product.image_url} alt="" className="w-16 h-16 rounded object-cover shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-body text-sm font-medium text-foreground truncate">{it.product.title}</p>
            <p className="font-body text-[11px] text-muted-foreground truncate">{it.product.designer}</p>
            <p className="font-body text-[11px] text-muted-foreground mt-1">{it.reason}</p>
          </div>
          <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
