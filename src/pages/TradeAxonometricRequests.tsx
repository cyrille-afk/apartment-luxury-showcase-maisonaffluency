import { useState, useEffect } from "react";
import SectionHero from "@/components/trade/SectionHero";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import SourceUpload from "@/components/trade/SourceUpload";
import CloudUpload from "@/components/trade/CloudUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, X, Clock, CheckCircle2, Loader2, Image as ImageIcon,
  GalleryHorizontalEnd, Pencil, Trash2, Heart, Box, Monitor, Sun,
  Camera, FileType, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import FavoritesPicker from "@/components/trade/FavoritesPicker";

/* ── Constants ─────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-500/10 text-yellow-700" },
  in_progress: { label: "In Progress", color: "bg-blue-500/10 text-blue-700" },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
};

const ROOM_TYPES = [
  "Living Room", "Dining Room", "Bedroom", "Bathroom", "Kitchen",
  "Study / Library", "Hallway / Foyer", "Terrace / Outdoor", "Commercial / Hospitality", "Other",
];

const STYLE_DIRECTIONS = [
  "Minimalist", "Maximalist", "Mid-Century Modern", "Art Deco", "Japandi",
  "Brutalist", "Mediterranean", "Contemporary Luxury", "Wabi-Sabi", "Eclectic",
];

const LIGHTING_MOODS = [
  "Natural Daylight", "Warm Golden Hour", "Cool Nordic", "Dramatic Chiaroscuro",
  "Soft Diffused", "Night / Ambient Glow",
];

const RESOLUTIONS = [
  { value: "2k", label: "2K (2048 × 1080)" },
  { value: "4k", label: "4K (3840 × 2160)" },
  { value: "8k", label: "8K (7680 × 4320)" },
  { value: "print", label: "Print-Ready (300 DPI)" },
];

const CAMERA_ANGLES = [
  "Eye-Level Perspective", "Bird's Eye / Aerial", "Worm's Eye (Low Angle)",
  "Axonometric / Isometric", "Detail / Close-Up", "Panoramic / Wide",
];

/* ── Pipeline Info Component ───────────────────────────────── */

const PipelineInfo = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-display text-sm text-foreground">Our Visualization Studio</p>
            <p className="font-body text-[10px] text-muted-foreground">AI-assisted rendering · guided by archviz standards</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border p-5 space-y-5">
          {/* How It Works */}
          <div className="space-y-2">
            <h3 className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground">How It Works</h3>
            <p className="font-body text-[10px] text-muted-foreground leading-relaxed max-w-2xl">
              Our visualization studio combines AI-powered rendering with professional archviz quality standards. 
              Instant AI previews let you explore layouts, lighting and material palettes in real time. 
              For production-grade deliverables, our team refines select renders using industry-standard tools 
              to ensure photorealistic fidelity.
            </p>
          </div>

          {/* Workflow */}
          <div className="space-y-2">
            <h3 className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground">Workflow</h3>
            <ol className="space-y-2">
              {[
                { step: "1", title: "Creative Brief", desc: "You submit drawings, room dimensions, style direction, and lighting preferences using the form below." },
                { step: "2", title: "AI Concept Generation", desc: "Our engine generates initial visualizations — exploring layouts, material palettes, and lighting scenarios in seconds." },
                { step: "3", title: "Refinement & Curation", desc: "You refine using style presets, lighting controls, and layout locking until the direction is right." },
                { step: "4", title: "Production Render (optional)", desc: "For client-facing deliverables, selected views are handed to our visualization team and rendered in 3ds Max with V-Ray or Corona for photorealistic quality." },
                { step: "5", title: "Review & Delivery", desc: "Finished renders appear in the 3D Studio Gallery. Attach them to quotes or presentations instantly." },
              ].map((s) => (
                <li key={s.step} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="font-body text-[10px] font-semibold text-foreground">{s.step}</span>
                  </span>
                  <div>
                    <p className="font-body text-xs font-medium text-foreground">{s.title}</p>
                    <p className="font-body text-[10px] text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Accepted Formats */}
          <div className="space-y-2">
            <h3 className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground">Accepted File Formats</h3>
            <div className="flex flex-wrap gap-1.5">
              {[".dwg", ".dxf", ".pdf", ".max", ".fbx", ".obj", ".skp", ".3dm", ".jpg", ".png", ".tiff"].map((fmt) => (
                <span key={fmt} className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">{fmt}</span>
              ))}
            </div>
          </div>

          {/* Turnaround */}
          <div className="space-y-2">
            <h3 className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground">Turnaround</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "AI Preview", time: "Instant" },
                { label: "Refined Concept", time: "Same day" },
                { label: "Production Render", time: "3–5 days" },
                { label: "Rush Delivery", time: "48 hours" },
              ].map((t) => (
                <div key={t.label} className="p-2.5 rounded-lg bg-muted/40 text-center">
                  <p className="font-body text-[10px] text-muted-foreground">{t.label}</p>
                  <p className="font-display text-xs text-foreground mt-0.5">{t.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Production Render Pricing */}
          <div className="space-y-2">
            <h3 className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground">Production Render Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  engine: "Corona Renderer",
                  perView: "€280",
                  desc: "Warm, natural GI with fine material detail. Ideal for residential interiors.",
                  includes: "Up to 2 revision rounds",
                },
                {
                  engine: "V-Ray",
                  perView: "€320",
                  desc: "Precision lighting with advanced caustics and reflections. Best for galleries, hospitality, and high-contrast schemes.",
                  includes: "Up to 2 revision rounds",
                },
                {
                  engine: "Rush Surcharge",
                  perView: "+50%",
                  desc: "48-hour delivery on any engine. Subject to team availability.",
                  includes: "Confirmed within 4 hours",
                },
              ].map((tier) => (
                <div key={tier.engine} className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
                  <p className="font-display text-xs text-foreground">{tier.engine}</p>
                  <p className="font-display text-lg text-foreground leading-none">{tier.perView}<span className="text-[10px] text-muted-foreground font-body ml-1">/ view</span></p>
                  <p className="font-body text-[10px] text-muted-foreground leading-relaxed">{tier.desc}</p>
                  <p className="font-body text-[10px] text-foreground/60 italic">{tier.includes}</p>
                </div>
              ))}
            </div>
            <p className="font-body text-[9px] text-muted-foreground/60">
              Volume discounts available for 5+ views. Contact us for project-based packages.
            </p>
          </div>

          {/* Disclaimer */}
          <p className="font-body text-[9px] text-muted-foreground/70 italic leading-relaxed border-t border-border pt-3">
            AI-generated visualizations are conceptual previews intended to communicate spatial layouts, material direction, and lighting mood. 
            They are not photographic representations of final products. Colours, textures, and proportions may vary from actual specifications. 
            Production renders, where commissioned, are prepared in 3ds Max using V-Ray or Corona Renderer for photorealistic fidelity.
          </p>
        </div>
      )}
    </div>
  );
};

/* ── Chip Picker ───────────────────────────────────────────── */

const ChipPicker = ({
  options, selected, onToggle, multi = false,
}: {
  options: string[];
  selected: string | string[];
  onToggle: (val: string) => void;
  multi?: boolean;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => {
      const isActive = multi
        ? (selected as string[]).includes(opt)
        : selected === opt;
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={`font-body text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
            isActive
              ? "bg-foreground text-background border-foreground"
              : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
          }`}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

/* ── Main Component ────────────────────────────────────────── */

const TradeAxonometricRequests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<"elevation" | "section" | "section_plan">("elevation");
  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");
  const [ceilingHeight, setCeilingHeight] = useState("");
  const [roomWidth, setRoomWidth] = useState("");
  const [roomDepth, setRoomDepth] = useState("");
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Creative brief fields
  const [roomType, setRoomType] = useState("");
  const [styleDirection, setStyleDirection] = useState("");
  const [lightingMood, setLightingMood] = useState("");
  const [renderEngine, setRenderEngine] = useState("no_preference");
  const [resolution, setResolution] = useState("4k");
  const [cameraAngles, setCameraAngles] = useState<string[]>([]);

  const [selectedFavoriteIds, setSelectedFavoriteIds] = useState<string[]>(() => {
    const prefilled = searchParams.get("favorites");
    if (prefilled) return prefilled.split(",").filter(Boolean);
    return [];
  });

  useEffect(() => {
    if (searchParams.get("favorites")) setShowForm(true);
  }, []);

  const { data: requests, refetch } = useQuery({
    queryKey: ["axonometric-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("axonometric_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const resetForm = () => {
    setImageUrl(null);
    setProjectName("");
    setNotes("");
    setCeilingHeight("");
    setRoomWidth("");
    setRoomDepth("");
    setRoomType("");
    setStyleDirection("");
    setLightingMood("");
    setRenderEngine("no_preference");
    setResolution("4k");
    setCameraAngles([]);
    setSelectedFavoriteIds([]);
  };

  const handleSubmit = async () => {
    if (!imageUrl || !user) {
      toast({ title: "Please upload a drawing or reference file", variant: "destructive" });
      return;
    }
    if (!projectName.trim()) {
      toast({ title: "Please enter a project name", variant: "destructive" });
      return;
    }
    if (!ceilingHeight.trim() || !roomWidth.trim() || !roomDepth.trim()) {
      toast({ title: "Room dimensions are required", description: "Provide width, depth and ceiling height for accurate modelling.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("axonometric_requests").insert({
        user_id: user.id,
        image_url: imageUrl,
        request_type: requestType,
        project_name: projectName.trim().slice(0, 200),
        notes: `[Dimensions: W${roomWidth.trim()} × D${roomDepth.trim()} × H${ceilingHeight.trim()}]${notes.trim() ? "\n" + notes.trim().slice(0, 900) : ""}`.slice(0, 1000) || null,
        linked_favorite_product_ids: selectedFavoriteIds.length > 0 ? selectedFavoriteIds : [],
        room_type: roomType,
        style_direction: styleDirection,
        lighting_mood: lightingMood,
        render_engine: renderEngine,
        resolution,
        camera_angles: cameraAngles.join(", "),
      });
      if (error) throw error;

      toast({ title: "Creative brief submitted — we'll be in touch" });
      setShowForm(false);
      resetForm();
      refetch();
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (req: any) => {
    setEditingRequest(req);
    setProjectName(req.project_name || "");
    setNotes(req.notes || "");
    setRequestType(req.request_type as "elevation" | "section");
    setImageUrl(req.image_url);
  };

  const handleEditSave = async () => {
    if (!editingRequest || !user || !imageUrl) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("axonometric_requests")
        .update({
          project_name: projectName.trim().slice(0, 200),
          notes: notes.trim().slice(0, 1000) || null,
          request_type: requestType,
          image_url: imageUrl,
        })
        .eq("id", editingRequest.id)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Request updated" });
      setEditingRequest(null);
      setProjectName("");
      setNotes("");
      setImageUrl(null);
      refetch();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reqId: string) => {
    if (!user) return;
    setDeleting(reqId);
    try {
      const { error } = await (supabase as any)
        .from("axonometric_requests")
        .delete()
        .eq("id", reqId)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Request deleted" });
      refetch();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const canEdit = (status: string) => status === "pending";
  const canDelete = (status: string) => status === "pending" || status === "in_progress";

  const toggleCameraAngle = (angle: string) => {
    setCameraAngles((prev) =>
      prev.includes(angle) ? prev.filter((a) => a !== angle) : [...prev, angle]
    );
  };

  return (
    <>
      <Helmet>
        <title>3D Studio | Trade Portal</title>
        <meta name="description" content="Submit creative briefs for professional 3D renders using 3ds Max, Corona and V-Ray. Browse the gallery of architectural visualizations." />
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-6">
        <SectionHero
          section="3d-studio"
          title="3D Studio"
          subtitle="AI-assisted architectural visualization with professional-grade refinement"
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/trade/axonometric-gallery">
                <GalleryHorizontalEnd className="w-4 h-4 mr-1.5" />View Gallery
              </Link>
            </Button>
            <Button
              onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
              variant={showForm ? "outline" : "default"}
              size="sm"
            >
              {showForm ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              {showForm ? "Cancel" : "New Brief"}
            </Button>
          </div>
        </SectionHero>

        {/* Pipeline Reference */}
        <PipelineInfo />

        {/* ── Creative Brief Form ───────────────────────────── */}
        {showForm && (
          <div className="border border-border rounded-lg p-6 space-y-6">
            <div>
              <h2 className="font-display text-sm text-foreground">Creative Brief</h2>
              <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                Fill in the details below so we can model, texture and render your space accurately.
              </p>
            </div>

            {/* Section 1: Project Identity */}
            <div className="space-y-4">
              <h3 className="font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Project</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-body text-xs text-muted-foreground">Project Name *</label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Marina Bay Residence"
                    maxLength={200}
                    className="font-body text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-body text-xs text-muted-foreground">Drawing Type *</label>
                  <Select value={requestType} onValueChange={(v: any) => setRequestType(v)}>
                    <SelectTrigger className="font-body text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elevation" className="font-body text-sm">Room Elevation</SelectItem>
                      <SelectItem value="section" className="font-body text-sm">Building Section</SelectItem>
                      <SelectItem value="section_plan" className="font-body text-sm">Section Plan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 2: Room & Dimensions */}
            <div className="space-y-4">
              <h3 className="font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Room & Dimensions</h3>

              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground">Room Type</label>
                <ChipPicker options={ROOM_TYPES} selected={roomType} onToggle={(v) => setRoomType(v === roomType ? "" : v)} />
              </div>

              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground">Room Dimensions (meters) *</label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-body text-[10px] text-muted-foreground">Width (X)</label>
                    <Input value={roomWidth} onChange={(e) => setRoomWidth(e.target.value)} placeholder="e.g. 5.2" maxLength={10} className="font-body text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-body text-[10px] text-muted-foreground">Depth (Y)</label>
                    <Input value={roomDepth} onChange={(e) => setRoomDepth(e.target.value)} placeholder="e.g. 4.0" maxLength={10} className="font-body text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-body text-[10px] text-muted-foreground">Ceiling Height (Z)</label>
                    <Input value={ceilingHeight} onChange={(e) => setCeilingHeight(e.target.value)} placeholder="e.g. 3.0" maxLength={10} className="font-body text-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Style & Mood */}
            <div className="space-y-4">
              <h3 className="font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Style & Mood</h3>

              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground">Style Direction</label>
                <ChipPicker options={STYLE_DIRECTIONS} selected={styleDirection} onToggle={(v) => setStyleDirection(v === styleDirection ? "" : v)} />
              </div>

              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground">Lighting Mood</label>
                <ChipPicker options={LIGHTING_MOODS} selected={lightingMood} onToggle={(v) => setLightingMood(v === lightingMood ? "" : v)} />
              </div>
            </div>

            {/* Section 4: Technical Preferences */}
            <div className="space-y-4">
              <h3 className="font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Technical Preferences</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-body text-xs text-muted-foreground flex items-center gap-1.5">
                    <Monitor className="w-3 h-3" />Render Engine
                  </label>
                  <Select value={renderEngine} onValueChange={setRenderEngine}>
                    <SelectTrigger className="font-body text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_preference" className="font-body text-sm">No Preference</SelectItem>
                      <SelectItem value="corona" className="font-body text-sm">Corona</SelectItem>
                      <SelectItem value="vray" className="font-body text-sm">V-Ray</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-body text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileType className="w-3 h-3" />Output Resolution
                  </label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger className="font-body text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOLUTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="font-body text-sm">{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground flex items-center gap-1.5">
                  <Camera className="w-3 h-3" />Camera Angles (select all that apply)
                </label>
                <ChipPicker options={CAMERA_ANGLES} selected={cameraAngles} onToggle={toggleCameraAngle} multi />
              </div>
            </div>

            {/* Section 5: Files & References */}
            <div className="space-y-4">
              <h3 className="font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Files & References</h3>

              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground">Upload Drawing / Reference *</label>
                <p className="font-body text-[10px] text-muted-foreground/70">
                  Accepted: .dwg, .dxf, .pdf, .max, .fbx, .obj, .skp, .jpg, .png
                </p>
                {imageUrl ? (
                  <div className="relative group">
                    <img src={imageUrl} alt="Uploaded drawing" className="w-full max-h-64 object-contain rounded-md border border-border" />
                    <button
                      onClick={() => setImageUrl(null)}
                      className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5 text-foreground" />
                    </button>
                  </div>
                ) : (
                  <SourceUpload
                    folder="axonometric-submissions"
                    label="Upload elevation, section, CAD file, or reference image"
                    onSourceReady={(url) => setImageUrl(url)}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground flex items-center gap-1.5">
                  <Heart className="w-3 h-3" />Attach Favourites (optional)
                </label>
                <p className="font-body text-[10px] text-muted-foreground/70">
                  Select products from your favourites to include in the 3D scene
                </p>
                <FavoritesPicker
                  selectedIds={selectedFavoriteIds}
                  onSelectionChange={setSelectedFavoriteIds}
                />
                {selectedFavoriteIds.length > 0 && (
                  <p className="font-body text-[10px] text-[hsl(var(--gold))]">
                    {selectedFavoriteIds.length} product{selectedFavoriteIds.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground">Additional Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key pieces to feature, specific finishes, material references, or anything else we should know…"
                  maxLength={1000}
                  rows={3}
                  className="font-body text-sm"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !imageUrl || !ceilingHeight.trim() || !roomWidth.trim() || !roomDepth.trim()}
              className="w-full"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
              ) : (
                "Submit Creative Brief"
              )}
            </Button>
          </div>
        )}

        {/* ── Requests List ─────────────────────────────────── */}
        <div className="space-y-3">
          {requests && requests.length === 0 && !showForm && (
            <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center justify-center gap-3">
              <Box className="w-8 h-8 text-muted-foreground/40" />
              <p className="font-body text-sm text-muted-foreground">No briefs submitted yet</p>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-1.5" />Submit your first brief
              </Button>
            </div>
          )}

          {requests?.map((req: any) => {
            const status = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
            return (
              <div key={req.id} className="border border-border rounded-lg p-4 flex gap-4">
                <img
                  src={req.image_url}
                  alt=""
                  className="w-24 h-24 object-cover rounded-md border border-border shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-sm text-foreground">{req.project_name || "Untitled"}</p>
                      <p className="font-body text-xs text-muted-foreground capitalize">{req.request_type?.replace("_", " ")} drawing</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      {canEdit(req.status) && (
                        <button onClick={() => startEdit(req)} className="p-1 rounded hover:bg-muted transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                      {canDelete(req.status) && (
                        <button onClick={() => handleDelete(req.id)} disabled={deleting === req.id} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete">
                          <Trash2 className={`w-3.5 h-3.5 ${deleting === req.id ? "text-muted-foreground animate-pulse" : "text-destructive/70"}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Brief metadata chips */}
                  {(req.room_type || req.style_direction || req.lighting_mood || req.render_engine !== "no_preference") && (
                    <div className="flex flex-wrap gap-1">
                      {req.room_type && <span className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{req.room_type}</span>}
                      {req.style_direction && <span className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{req.style_direction}</span>}
                      {req.lighting_mood && <span className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{req.lighting_mood}</span>}
                      {req.render_engine && req.render_engine !== "no_preference" && (
                        <span className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{req.render_engine}</span>
                      )}
                    </div>
                  )}

                  {req.notes && (
                    <p className="font-body text-xs text-muted-foreground line-clamp-2">{req.notes}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <p className="font-body text-[10px] text-muted-foreground">
                      Submitted {format(new Date(req.created_at), "d MMM yyyy")}
                    </p>
                    {Array.isArray(req.linked_favorite_product_ids) && req.linked_favorite_product_ids.length > 0 && (
                      <span className="font-body text-[10px] text-[hsl(var(--gold))]">
                        ♥ {req.linked_favorite_product_ids.length} favourite{req.linked_favorite_product_ids.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {req.admin_notes && (
                    <p className="font-body text-xs text-muted-foreground/80 italic border-t border-border pt-1.5 mt-1.5">
                      Studio: {req.admin_notes}
                    </p>
                  )}
                </div>
                {req.result_image_url && (
                  <a href={req.result_image_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img
                      src={req.result_image_url}
                      alt="Result"
                      className="w-24 h-24 object-cover rounded-md border border-foreground/20"
                    />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRequest} onOpenChange={(open) => { if (!open) { setEditingRequest(null); setImageUrl(null); setProjectName(""); setNotes(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Edit Brief</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Project Name *</label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} maxLength={200} className="font-body text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Drawing Type *</label>
              <Select value={requestType} onValueChange={(v: any) => setRequestType(v)}>
                <SelectTrigger className="font-body text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="elevation" className="font-body text-sm">Room Elevation</SelectItem>
                  <SelectItem value="section" className="font-body text-sm">Building Section</SelectItem>
                  <SelectItem value="section_plan" className="font-body text-sm">Section Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Drawing</label>
              {imageUrl ? (
                <div className="relative group">
                  <img src={imageUrl} alt="Drawing" className="w-full max-h-48 object-contain rounded-md border border-border" />
                  <button onClick={() => setImageUrl(null)} className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3.5 h-3.5 text-foreground" />
                  </button>
                </div>
              ) : (
                <CloudUpload folder="axonometric-submissions" accept="image/*" label="Upload new drawing" onUpload={(urls) => setImageUrl(urls[0])} />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} className="font-body text-sm" />
            </div>
            <Button onClick={handleEditSave} disabled={submitting || !imageUrl || !projectName.trim()} className="w-full">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TradeAxonometricRequests;
