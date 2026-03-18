import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Loader2, Save, FolderOpen, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SectionHero from "@/components/trade/SectionHero";
import PlanUploader from "@/components/room-planner/PlanUploader";
import WallTracer from "@/components/room-planner/WallTracer";
import ProductPalette from "@/components/room-planner/ProductPalette";
import type { Room, PlacedProduct } from "@/components/room-planner/types";
import type { TradeProduct } from "@/lib/tradeProducts";
import { cn } from "@/lib/utils";

const RoomScene3D = lazy(() => import("@/components/room-planner/RoomScene3D"));

type Step = "upload" | "trace" | "view3d";

interface SavedProject {
  id: string;
  name: string;
  plan_image_url: string | null;
  rooms: Room[];
  placed_products: PlacedProduct[];
  pixels_per_meter: number;
  wall_height: number;
  created_at: string;
  updated_at: string;
}

const TradeRoomPlanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("upload");
  const [planImageUrl, setPlanImageUrl] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [placedProducts, setPlacedProducts] = useState<PlacedProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<TradeProduct | null>(null);
  const [pixelsPerMeter, setPixelsPerMeter] = useState(50);

  // Save/load state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [showProjectList, setShowProjectList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Fetch saved projects
  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoadingProjects(true);
    const { data, error } = await supabase
      .from("room_planner_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setSavedProjects(
        data.map((d: any) => ({
          ...d,
          rooms: (d.rooms as Room[]) || [],
          placed_products: (d.placed_products as PlacedProduct[]) || [],
        })),
      );
    }
    setLoadingProjects(false);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Save project
  const saveProject = useCallback(async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      name: projectName,
      plan_image_url: planImageUrl,
      rooms: rooms as any,
      placed_products: placedProducts as any,
      pixels_per_meter: pixelsPerMeter,
      wall_height: 2.8,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (projectId) {
      ({ error } = await supabase
        .from("room_planner_projects")
        .update(payload)
        .eq("id", projectId));
    } else {
      const { data, error: insertError } = await supabase
        .from("room_planner_projects")
        .insert(payload)
        .select("id")
        .single();
      error = insertError;
      if (data) setProjectId(data.id);
    }

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Project saved" });
      fetchProjects();
    }
    setSaving(false);
  }, [user, projectId, projectName, planImageUrl, rooms, placedProducts, pixelsPerMeter, toast, fetchProjects]);

  // Load project
  const loadProject = useCallback((project: SavedProject) => {
    setProjectId(project.id);
    setProjectName(project.name);
    setPlanImageUrl(project.plan_image_url);
    setRooms(project.rooms);
    setPlacedProducts(project.placed_products);
    setPixelsPerMeter(project.pixels_per_meter);
    setShowProjectList(false);

    if (project.rooms.length > 0) {
      setStep("view3d");
    } else if (project.plan_image_url) {
      setStep("trace");
    } else {
      setStep("upload");
    }

    toast({ title: "Project loaded", description: project.name });
  }, [toast]);

  // Delete project
  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase.from("room_planner_projects").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      if (projectId === id) {
        setProjectId(null);
        setProjectName("Untitled Project");
        setPlanImageUrl(null);
        setRooms([]);
        setPlacedProducts([]);
        setStep("upload");
      }
      toast({ title: "Project deleted" });
      fetchProjects();
    }
  }, [projectId, toast, fetchProjects]);

  // New project
  const newProject = useCallback(() => {
    setProjectId(null);
    setProjectName("Untitled Project");
    setPlanImageUrl(null);
    setRooms([]);
    setPlacedProducts([]);
    setSelectedProduct(null);
    setStep("upload");
    setShowProjectList(false);
  }, []);

  const handlePlanUploaded = useCallback((url: string) => {
    setPlanImageUrl(url);
    setStep("trace");
  }, []);

  const handleTraceDone = useCallback(() => {
    setStep("view3d");
  }, []);

  const handleFloorClick = useCallback(
    (position: { x: number; y: number; z: number }) => {
      if (!selectedProduct) return;
      const newPlaced: PlacedProduct = {
        id: `placed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: selectedProduct.id,
        productName: selectedProduct.product_name,
        brandName: selectedProduct.brand_name,
        imageUrl: selectedProduct.image_url,
        position,
        rotation: 0,
        scale: 1,
      };
      setPlacedProducts((prev) => [...prev, newPlaced]);
    },
    [selectedProduct],
  );

  const handleRemoveProduct = useCallback((productId: string) => {
    setPlacedProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const handleProductUpdate = useCallback((productId: string, updates: Partial<PlacedProduct>) => {
    setPlacedProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );
  }, []);

  return (
    <>
      <Helmet>
        <title>Room Planner — Trade Portal — Maison Affluency</title>
      </Helmet>

      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="shrink-0">
          <SectionHero
            section="room-planner"
            title="3D Room Planner"
            subtitle={
              step === "upload"
                ? "Upload an architectural floor plan to get started"
                : step === "trace"
                  ? "Trace your room walls by clicking corners on the plan"
                  : "Explore your space in 3D and furnish it with products"
            }
          >
            <div className="flex items-center gap-2">
              {step !== "upload" && (
                <button
                  onClick={() => setStep(step === "view3d" ? "trace" : "upload")}
                  className="flex items-center gap-1.5 p-2 border border-background/30 rounded-md text-background/70 hover:text-background hover:border-background/50 transition-colors"
                  title="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setShowProjectList(!showProjectList)}
                className="flex items-center gap-1.5 p-2 border border-background/30 rounded-md text-background/70 hover:text-background hover:border-background/50 transition-colors"
                title="My Projects"
              >
                <FolderOpen className="h-4 w-4" />
              </button>
              <button
                onClick={saveProject}
                disabled={saving || !planImageUrl}
                className="flex items-center gap-1.5 p-2 border border-background/30 rounded-md text-background/70 hover:text-background hover:border-background/50 transition-colors disabled:opacity-30"
                title="Save project"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </button>
            </div>
          </SectionHero>

          {/* Step indicator + project name */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/20">
            {/* Project name */}
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="px-2 py-1 rounded border border-transparent hover:border-border focus:border-border bg-transparent font-body text-xs text-foreground focus:outline-none w-40"
              placeholder="Project name"
            />

            <div className="w-px h-5 bg-border mx-2" />

            {(["upload", "trace", "view3d"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <div className="w-8 h-px bg-border" />}
                <button
                  onClick={() => {
                    if (s === "upload") setStep("upload");
                    else if (s === "trace" && planImageUrl) setStep("trace");
                    else if (s === "view3d" && rooms.length > 0) setStep("view3d");
                  }}
                  disabled={
                    (s === "trace" && !planImageUrl) || (s === "view3d" && rooms.length === 0)
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full font-body text-[10px] uppercase tracking-[0.1em] transition-colors",
                    step === s
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground disabled:opacity-30"
                  )}
                >
                  {s === "upload" && "1. Upload"}
                  {s === "trace" && "2. Trace"}
                  {s === "view3d" && "3. 3D View"}
                </button>
              </div>
            ))}

            {step === "view3d" && (
              <>
                <div className="flex-1" />
                <label className="flex items-center gap-2 font-body text-xs text-muted-foreground">
                  Scale (px/m):
                  <input
                    type="number"
                    value={pixelsPerMeter}
                    onChange={(e) => setPixelsPerMeter(Math.max(10, parseInt(e.target.value) || 50))}
                    className="w-16 px-2 py-1 rounded border border-border bg-background text-foreground text-xs"
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {/* Projects drawer */}
        {showProjectList && (
          <div className="border-b border-border bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm text-foreground">My Projects</h3>
              <button
                onClick={newProject}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-body text-xs bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Project
              </button>
            </div>

            {loadingProjects ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            ) : savedProjects.length === 0 ? (
              <p className="font-body text-xs text-muted-foreground text-center py-6">
                No saved projects yet. Upload a plan and save to get started.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {savedProjects.map((project) => (
                  <div
                    key={project.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                      projectId === project.id
                        ? "border-foreground bg-muted/50"
                        : "border-border hover:border-foreground/30 hover:bg-muted/30"
                    )}
                    onClick={() => loadProject(project)}
                  >
                    {/* Thumbnail */}
                    {project.plan_image_url ? (
                      <img
                        src={project.plan_image_url}
                        alt=""
                        className="w-14 h-14 rounded object-cover bg-muted shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-body text-xs text-foreground font-medium truncate">
                        {project.name}
                      </p>
                      <p className="font-body text-[10px] text-muted-foreground">
                        {project.rooms.length} room{project.rooms.length !== 1 ? "s" : ""} ·{" "}
                        {project.placed_products.length} product{project.placed_products.length !== 1 ? "s" : ""}
                      </p>
                      <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                        {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.id);
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 flex">
          {step === "upload" && (
            <div className="flex-1 overflow-auto">
              <PlanUploader onPlanUploaded={handlePlanUploaded} />
            </div>
          )}

          {step === "trace" && planImageUrl && (
            <div className="flex-1">
              <WallTracer
                planImageUrl={planImageUrl}
                rooms={rooms}
                onRoomsChange={setRooms}
                onDone={handleTraceDone}
              />
            </div>
          )}

          {step === "view3d" && (
            <>
              <div className="flex-1 min-w-0">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                    </div>
                  }
                >
                  <RoomScene3D
                    rooms={rooms}
                    placedProducts={placedProducts}
                    wallHeight={2.8}
                    pixelsPerMeter={pixelsPerMeter}
                    planImageUrl={planImageUrl!}
                    onProductUpdate={handleProductUpdate}
                    onProductDelete={handleRemoveProduct}
                    onFloorClick={handleFloorClick}
                  />
                </Suspense>
              </div>
              <div className="w-72 shrink-0">
                <ProductPalette
                  onProductSelect={setSelectedProduct}
                  selectedProductId={selectedProduct?.id || null}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default TradeRoomPlanner;
