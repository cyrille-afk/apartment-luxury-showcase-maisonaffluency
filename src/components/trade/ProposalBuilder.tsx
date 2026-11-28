import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "@/lib/productTaxonomy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { uploadPrivateTradeAsset, resignPrivateTradeUrl } from "@/lib/privateTradeUpload";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Wand2, Search, X, Download, ArrowLeft, RefreshCw, Send, Maximize2, Minimize2, Upload, RotateCw, RotateCcw, ZoomIn, ZoomOut, Move, MousePointer2, Crosshair, Trash2, Link, Save, Image, Layout, FolderOpen, FileText, Lock, Unlock, CheckCircle2, SplitSquareHorizontal, Undo2, Ruler, Eye, EyeOff,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BeforeAfterSplit from "./BeforeAfterSplit";
import FurnitureCorrectionDialog from "./FurnitureCorrectionDialog";
import { createActiveDraftQuote } from "@/lib/activeProjectId";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useExportCurrency } from "@/lib/displayMoney";
import PrivateTradeImage from "@/components/trade/PrivateTradeImage";
import { prepareAiRenderImages } from "@/lib/aiRenderImages";
import { EyeLevelCameraPlan } from "./EyeLevelCameraPlan";
import SaveResidenceShell from "./SaveResidenceShell";
import EyeLevelPlacementShell from "./EyeLevelPlacementShell";
import SandboxShellCapture from "./SandboxShellCapture";
import SaveResidenceRoom from "./SaveResidenceRoom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROOM_TYPES, validRoomZone, cropRoomPlan, roomCropCamera, type RoomType, type RoomZone } from "@/lib/roomZone";
import { eyeLevelCameraKey, validEyeLevelCamera, requireEyeLevelTargets, type EyeLevelTarget, type ProposalProduct, type ProposalRenderDraft } from "@/lib/proposalRenderDraft";

const toAbsoluteUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
};

const ROOM_SECTIONS = [
  "Living Room",
  "Dining Room",
  "Bedroom",
  "Primary Bedroom",
  "Study",
  "Lounge Area",
  "Entrance Hall",
  "Kitchen",
  "Bathroom",
  "Terrace",
  "Other",
] as const;

type SelectedProduct = ProposalProduct;

interface ProposalBuilderProps {
  furnishedImageUrl: string;
  emptyRoomUrl: string | null;
  emptyRoomGenerating: boolean;
  emptyRoomError?: string | null;
  onPrepareEmptyRoom?: () => void;
  style: string;
  preloadedProductIds?: string[];
  lockedProducts?: SelectedProduct[];
  sourcePlanUrl?: string | null;
  sourceKey: string;
  initialDraft?: ProposalRenderDraft | null;
  onDraftChange: (draft: ProposalRenderDraft) => void;
  onExportPageTwo: (imageUrl: string) => Promise<void>;
  onClose: () => void;
  onResult?: (result: { imageUrl: string; storedUrl: string | null; text: string; pinnedProducts: SelectedProduct[]; renderView: "axonometric" | "eye-level"; draft: ProposalRenderDraft }) => void;
}

let _pinId = 0;
const nextPinId = () => `pin-${++_pinId}-${Date.now()}`;

export default function ProposalBuilder({
  furnishedImageUrl,
  emptyRoomUrl,
  emptyRoomGenerating,
  emptyRoomError,
  onPrepareEmptyRoom,
  style,
  preloadedProductIds,
  lockedProducts,
  sourcePlanUrl,
  sourceKey,
  initialDraft,
  onDraftChange,
  onExportPageTwo,
  onClose,
  onResult,
}: ProposalBuilderProps) {
  const { toast } = useToast();
  const { user, isAdmin, rolesLoaded } = useAuth();
  // Proposal figures follow the member's declared base preference currency.
  const exportCurrency = useExportCurrency();
  const externalFileRef = useRef<HTMLInputElement>(null);
  const shellFileRef = useRef<HTMLInputElement>(null);
  const [shellUploading, setShellUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingPresentation, setCreatingPresentation] = useState(false);
  const [showPrices, setShowPrices] = useState(true);

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(initialDraft?.products ?? lockedProducts ?? []);
  const [renderView, setRenderView] = useState<"axonometric" | "eye-level">(initialDraft?.view ?? "axonometric");
  const [camera, setCamera] = useState(initialDraft?.camera ?? null);
  const [roomZone,setRoomZone] = useState<RoomZone | null>(initialDraft?.roomZone ?? null);
  const [roomType,setRoomType] = useState<RoomType>(initialDraft?.roomZone?.room_type ?? "living_room");
  const [roomName,setRoomName] = useState(initialDraft?.roomZone?.room_name ?? "Living Room");
  const [eyeLevelShell, setEyeLevelShell] = useState(initialDraft?.shellUrl ?? null);
  const [shellKey, setShellKey] = useState(initialDraft?.shellKey ?? null);
  const [shellSource, setShellSource] = useState<"generated" | "upload" | "sandbox">(initialDraft?.shellSource ?? "generated");
  const [shellGenerating, setShellGenerating] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [exportingPageTwo, setExportingPageTwo] = useState(false);
  const [viewResults, setViewResults] = useState({ axonometric: initialDraft?.axonometricResult ?? null, "eye-level": initialDraft?.eyeLevelResult ?? null });
  const [generating, setGenerating] = useState(false);
  const [proposalResult, setProposalResult] = useState<string | null>(initialDraft?.view === "eye-level" ? initialDraft.eyeLevelResult : initialDraft?.axonometricResult ?? null);
  const [proposalHistory, setProposalHistory] = useState<string[]>([]);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [refining, setRefining] = useState(false);
  const [lockedIteration, setLockedIteration] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [qualityTier, setQualityTier] = useState<"draft" | "standard" | "premium">("standard");
  const [correctingPiece, setCorrectingPiece] = useState(false);
  const [correctionUndo, setCorrectionUndo] = useState<{ before: string; after: string; view: "axonometric" | "eye-level" } | null>(null);
  const cameraPlanUrl = emptyRoomUrl || sourcePlanUrl || furnishedImageUrl;
  const currentShellKey = camera && validEyeLevelCamera(camera) ? eyeLevelCameraKey(cameraPlanUrl, camera) + (roomZone ? JSON.stringify(roomZone) : "") : null;
  const roomProducts = useMemo(() => roomZone ? selectedProducts.filter(p => {
    const name = (p.room_section ?? "").trim().toLowerCase();
    return name === roomZone.room_name.trim().toLowerCase() || name === ROOM_TYPES[roomZone.room_type].toLowerCase() || (roomZone.room_type === "primary_bedroom" && name === "bedroom");
  }) : selectedProducts,[selectedProducts,roomZone]);
  const stagingProducts = renderView === "eye-level" ? roomProducts : selectedProducts;
  const shellReady = Boolean(eyeLevelShell && (shellSource !== "generated" || shellKey === currentShellKey));
  const proposalBaseUrl = renderView === "eye-level" ? (shellReady ? eyeLevelShell : null) : emptyRoomUrl;
  const busy = generating || refining || shellGenerating || shellUploading || exportingPageTwo;
  const draft: ProposalRenderDraft = useMemo(() => ({ sourceKey, view: renderView, camera, roomZone, shellUrl: eyeLevelShell, shellKey, shellSource, products: selectedProducts, axonometricResult: viewResults.axonometric, eyeLevelResult: viewResults["eye-level"] }), [sourceKey, renderView, camera, roomZone, eyeLevelShell, shellKey, shellSource, selectedProducts, viewResults]);
  useEffect(() => { onDraftChange(draft); }, [draft, onDraftChange]);
  useEffect(() => { if (lockedProducts?.length) setSelectedProducts(previous => lockedProducts.map(piece => { const target = previous.find(p => p.id === piece.id)?.target; return target ? { ...piece, target } : piece; })); }, [lockedProducts]);
  useEffect(() => { if (!initialDraft?.shellUrl || initialDraft.shellSource === "generated") return; let cancelled = false; void resignPrivateTradeUrl(initialDraft.shellUrl).then(url => { if (!cancelled) setEyeLevelShell(url); }); return () => { cancelled = true; }; }, []);
  const replaceShell = useCallback((url: string, source: "generated" | "upload" | "sandbox", key: string | null = null) => {
    setEyeLevelShell(url); setShellSource(source); setShellKey(key); setRenderError(null);
    setSelectedProducts(previous => previous.map(piece => { const { target, ...rest } = piece; return rest; }));
    setViewResults(previous => ({ ...previous, "eye-level": null }));
    setProposalResult(null); setProposalHistory([]); setLockedIteration(null);
  }, []);
  const captureShell = useCallback((url: string) => replaceShell(url, "sandbox"), [replaceShell]);
  const changeRoomZone = (zone: RoomZone | null) => {
    setRoomZone(zone);
    setSelectedProducts(previous => previous.map(p => { const { target,...rest } = p;return rest; }));
    setViewResults(previous => ({ ...previous,"eye-level": null }));setProposalResult(null);setProposalHistory([]);setLockedIteration(null);
  };
  const uploadShell = async (file: File | undefined) => {
    if (!file || !user || busy) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) { setRenderError("Choose a JPEG, PNG or WebP room image under 20 MB."); return; }
    setShellUploading(true); setRenderError(null);
    try {
      const bitmap = await createImageBitmap(file); bitmap.close();
      const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
      const url = await uploadPrivateTradeAsset(`axonometric-sources/${user.id}/shell-${crypto.randomUUID()}.${ext}`, file, file.type);
      replaceShell(url, "upload");
    } catch { setRenderError("The room image couldn’t be uploaded. Your current shell is unchanged."); }
    finally { setShellUploading(false); if (shellFileRef.current) shellFileRef.current.value = ""; }
  };
  const updateTarget = (id: string, target: EyeLevelTarget | null) => {
    setSelectedProducts(previous => previous.map(piece => { if (piece.id !== id) return piece; const { target: oldTarget, ...rest } = piece; return target ? { ...rest, target } : rest; }));
    setViewResults(previous => ({ ...previous, "eye-level": null })); setProposalResult(null); setProposalHistory([]); setLockedIteration(null);
  };
  const changeView = (view: "axonometric" | "eye-level") => {
    if (busy || view === renderView) return;
    setRenderView(view); setProposalResult(viewResults[view]); setProposalHistory(viewResults[view] ? [viewResults[view]] : []); setLockedIteration(null); setRenderError(null); setCadOverlayUrl(null);
  };
  const generateEyeLevelShell = async () => {
    if (!camera || !validEyeLevelCamera(camera) || !currentShellKey || busy) return;
    setShellGenerating(true); setRenderError(null);
    try {
      if (!roomZone || !validRoomZone(roomZone) || !user) throw new Error("Draw a crop around one room before generating its shell.");
      const localCamera = roomCropCamera(camera,roomZone);
      const crop = await cropRoomPlan(cameraPlanUrl,roomZone);
      const croppedUrl = await uploadPrivateTradeAsset(`axonometric-sources/${user.id}/room-crop-${crypto.randomUUID()}.png`,crop,"image/png");
      const { data, error } = await supabase.functions.invoke("axonometric-generate", { body: await prepareAiRenderImages({ mode: "eye_level_shell", imageUrl: croppedUrl, referenceImageUrl: null, camera: localCamera, roomType: roomZone.room_type, qualityTier }) });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Eye-level shell generation failed.");
      const url = data.storedUrl || data.imageUrl;
      if (!url) throw new Error("No eye-level image returned.");
      replaceShell(url, "generated", currentShellKey);
    } catch (e) { setRenderError(e instanceof Error ? e.message : "Could not generate the eye-level shell. Your plan and camera are unchanged."); }
    finally { setShellGenerating(false); }
  };
  const exportPageTwo = async () => {
    if (!proposalResult || busy) return;
    setExportingPageTwo(true); setRenderError(null);
    try { await onExportPageTwo(proposalResult); }
    catch (e) { setRenderError(e instanceof Error ? e.message : "Could not export the client proposal."); }
    finally { setExportingPageTwo(false); }
  };

  // CAD dimension audit overlay state
  const [cadAuditing, setCadAuditing] = useState(false);
  const [cadOverlayUrl, setCadOverlayUrl] = useState<string | null>(null);
  const [cadQaRows, setCadQaRows] = useState<any[]>([]);
  const [showCadOverlay, setShowCadOverlay] = useState(false);
  const [cadOverlayVisible, setCadOverlayVisible] = useState(true);

  // External upload dialog state
  const [showExternalDialog, setShowExternalDialog] = useState(false);
  const [externalName, setExternalName] = useState("");
  const [externalBrand, setExternalBrand] = useState("");
  const [externalUploading, setExternalUploading] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [externalDimensions, setExternalDimensions] = useState("");
  const [externalMaterials, setExternalMaterials] = useState("");

  // Product picker state
  const [pickerOpen, setPickerOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [brand, setBrand] = useState("");

  const { allProducts: allTradeProds, brands } = useTradeProducts();
  const products = useMemo(() => {
    let all = allTradeProds.filter((p) => p.image_url);
    if (category) all = all.filter((p) => p.category === category);
    if (subcategory) all = all.filter((p) => p.subcategory === subcategory);
    if (brand) all = all.filter((p) => p.brand_name === brand);
    if (search.trim()) {
      const q = search.toLowerCase();
      all = all.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          p.brand_name.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return all.slice(0, 24);
  }, [allTradeProds, search, category, subcategory, brand]);

  const subcategories = category ? (SUBCATEGORY_MAP[category] || []) : [];

  // Auto-load products from preloaded favorite IDs
  useEffect(() => {
    if (lockedProducts?.length || !preloadedProductIds || preloadedProductIds.length === 0) return;
    const loadPreloaded = async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, dimensions, materials, spec_sheet_url")
        .in("id", preloadedProductIds);
      if (data && data.length > 0) {
        const loaded: SelectedProduct[] = data
          .filter((p: any) => p.image_url)
          .map((p: any) => ({
            id: nextPinId(),
            product_id: p.id,
            product_name: p.product_name,
            brand_name: p.brand_name,
            image_url: p.image_url,
            dimensions: p.dimensions,
            materials: p.materials,
            pdf_url: p.spec_sheet_url,
          }));
        setSelectedProducts((prev) => {
          // Avoid duplicates
          const existingNames = new Set(prev.map((x) => x.product_name));
          const newOnes = loaded.filter((l) => !existingNames.has(l.product_name));
          return [...prev, ...newOnes].slice(0, 10);
        });
      }
    };
    loadPreloaded();
  }, [preloadedProductIds, lockedProducts]);

  const addProduct = useCallback((product: { product_id?: string; product_name: string; brand_name: string; image_url: string; dimensions?: string; materials?: string; isExternal?: boolean; pdf_url?: string; pdf_urls?: { label: string; url: string; filename?: string }[] }) => {
    if (busy || lockedProducts?.length) return;
    if (selectedProducts.length >= 10) {
      toast({ title: "Maximum 10 products per proposal", variant: "destructive" });
      return;
    }
    setSelectedProducts((prev) => [
      ...prev,
      { id: nextPinId(), ...product, ...(roomZone ? { room_section: roomZone.room_name } : {}) },
    ]);
  }, [selectedProducts.length, toast, busy, lockedProducts,roomZone]);

  const removeProduct = useCallback((id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const rotateProduct = useCallback((id: string, direction: 1 | -1) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotation: ((p.rotation || 0) + direction * 90 + 360) % 360 } : p
      )
    );
  }, []);

  const updateRoomSection = useCallback((id: string, section: string) => {
    setSelectedProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, room_section: section || undefined } : p))
    );
  }, []);
  const furnitureSignature = JSON.stringify(selectedProducts.map(({ id,product_id,room_section,material_override,selected_finishes,rotation }) => ({ id,product_id,room_section,material_override,selected_finishes,rotation })));
  const previousFurnitureSignature = useRef(furnitureSignature);
  useEffect(() => {
    if (previousFurnitureSignature.current === furnitureSignature) return;
    previousFurnitureSignature.current = furnitureSignature;
    setViewResults({ axonometric: null,"eye-level": null });setProposalResult(null);setProposalHistory([]);setLockedIteration(null);
  },[furnitureSignature]);

  // Handle external image upload
  const handleExternalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!externalName.trim()) {
      toast({ title: "Please enter a product name first", variant: "destructive" });
      return;
    }

    setExternalUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `proposal-externals/${user?.id ?? "shared"}/${Date.now()}.${ext}`;
      const signedUrl = await uploadPrivateTradeAsset(path, file, file.type);
      addProduct({
        product_name: externalName.trim(),
        brand_name: externalBrand.trim() || "External",
        image_url: signedUrl,
        dimensions: externalDimensions.trim() || undefined,
        materials: externalMaterials.trim() || undefined,
        isExternal: true,
      });
      setExternalName("");
      setExternalBrand("");
      setExternalDimensions("");
      setExternalMaterials("");
      setShowExternalDialog(false);
      toast({ title: "External product added" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setExternalUploading(false);
      if (externalFileRef.current) externalFileRef.current.value = "";
    }
  };

  // Handle importing image from a web URL
  const handleExternalUrl = async () => {
    const url = externalUrl.trim();
    if (!url || !externalName.trim()) return;

    setExternalUploading(true);
    try {
      // Use proxy-image edge function to avoid CORS issues
      const { data, error } = await supabase.functions.invoke("proxy-image", {
        body: { url },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.publicUrl) throw new Error("No image URL returned from proxy");

      addProduct({
        product_name: externalName.trim(),
        brand_name: externalBrand.trim() || "External",
        image_url: data.publicUrl,
        dimensions: externalDimensions.trim() || undefined,
        materials: externalMaterials.trim() || undefined,
        isExternal: true,
      });
      setExternalName("");
      setExternalBrand("");
      setExternalDimensions("");
      setExternalMaterials("");
      setExternalUrl("");
      setShowExternalDialog(false);
      toast({ title: "Product imported from URL" });
    } catch (err: any) {
      toast({ title: "URL import failed", description: err?.message || "Could not fetch image from URL", variant: "destructive" });
    } finally {
      setExternalUploading(false);
    }
  };

  const generateProposal = async () => {
    if (!proposalBaseUrl || selectedProducts.length === 0 || busy) return;
    if (!stagingProducts.length) { setRenderError("Assign the selected pieces to this room using their Room section fields.");return; }
    if (selectedProducts.length > 10 || selectedProducts.some(p => !p.image_url)) {
      setRenderError("Every selected piece needs a reference photo; a proposal supports up to 10 pieces."); return;
    }
    if (renderView === "eye-level") { try { requireEyeLevelTargets(stagingProducts); } catch (error) { setRenderError(error instanceof Error ? error.message : "Assign every furniture pin."); return; } }
    setGenerating(true);
    setRenderError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");

      const placements = stagingProducts.map((p) => ({
        product_id: p.product_id || null,
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: toAbsoluteUrl(p.image_url),
        rotation: p.rotation || 0,
        dimensions: p.dimensions || null,
        material_override: p.material_override || null,
        materials: p.materials || null,
        room_section: p.room_section || null,
        selected_finishes: p.selected_finishes || [],
        ...(renderView === "eye-level" ? { target: p.target } : {}),
      }));

      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: await prepareAiRenderImages({
          imageUrl: toAbsoluteUrl(proposalBaseUrl),
          referenceImageUrl: renderView === "eye-level" ? null : toAbsoluteUrl(furnishedImageUrl),
          requirePlacementPins: renderView === "eye-level",
          ...(renderView === "eye-level" && roomZone ? { roomType: roomZone.room_type } : {}),
          mode: renderView === "eye-level" ? "eye_level_proposal" : "proposal_render",
          style,
          qualityTier,
          placements,
        }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const resultUrl = data.storedUrl || data.imageUrl;
      if (!resultUrl) throw new Error("No proposal image returned.");
      const nextResults = { ...viewResults, [renderView]: resultUrl };
      setViewResults(nextResults);
      setLockedIteration(null);
      setProposalHistory((prev) => [...prev, resultUrl]);
      setProposalResult(resultUrl);
      onResult?.({ imageUrl: data.imageUrl, storedUrl: data.storedUrl, text: data.text, pinnedProducts: selectedProducts, renderView, draft: { ...draft, axonometricResult: nextResults.axonometric, eyeLevelResult: nextResults["eye-level"] } });
      toast({ title: "Proposal generated successfully" });
    } catch (e: any) {
      setRenderError(e?.message || "Proposal generation failed. Your shell and furniture selections are unchanged.");
      toast({ title: "Proposal generation failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const refineProposal = async () => {
    if (!proposalResult || !refinementPrompt.trim()) return;
    if (renderView === "eye-level") { try { requireEyeLevelTargets(stagingProducts); } catch (error) { setRenderError(error instanceof Error ? error.message : "Assign every furniture pin."); return; } }
    setRefining(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");

      const placements = stagingProducts.map((p) => ({
        product_id: p.product_id || null,
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: toAbsoluteUrl(p.image_url),
        rotation: p.rotation || 0,
        dimensions: p.dimensions || null,
        materials: p.materials || null,
        material_override: p.material_override || null,
        selected_finishes: p.selected_finishes || [],
        ...(renderView === "eye-level" ? { target: p.target } : {}),
      }));

      const markerHints = {
        move_from: sourceMarker ? { x_percent: sourceMarker.x, y_percent: sourceMarker.y } : null,
        move_to: targetMarker ? { x_percent: targetMarker.x, y_percent: targetMarker.y } : null,
        remove_points: removeMarkers.map((m) => ({
          x_percent: m.pos.x,
          y_percent: m.pos.y,
          label: m.label,
        })),
      };

      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: await prepareAiRenderImages({
          imageUrl: toAbsoluteUrl(renderView === "eye-level" ? proposalBaseUrl : proposalResult),
          referenceImageUrl: renderView === "eye-level" ? null : toAbsoluteUrl(furnishedImageUrl),
          mode: renderView === "eye-level" ? "eye_level_proposal" : "proposal_refine",
          requirePlacementPins: renderView === "eye-level",
          ...(renderView === "eye-level" && roomZone ? { roomType: roomZone.room_type } : {}),
          style,
          qualityTier,
          placements,
          refinementPrompt: refinementPrompt.trim(),
          markerHints,
        }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const resultUrl = data.storedUrl || data.imageUrl;
      if (!resultUrl) throw new Error("No proposal image returned.");
      const nextResults = { ...viewResults, [renderView]: resultUrl };
      setViewResults(nextResults);
      setLockedIteration(null);
      setProposalHistory((prev) => [...prev, resultUrl]);
      setProposalResult(resultUrl);
      setRefinementPrompt("");
      onResult?.({ imageUrl: data.imageUrl, storedUrl: data.storedUrl, text: data.text, pinnedProducts: selectedProducts, renderView, draft: { ...draft, axonometricResult: nextResults.axonometric, eyeLevelResult: nextResults["eye-level"] } });
      toast({ title: "Proposal refined successfully" });
    } catch (e: any) {
      toast({ title: "Refinement failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setRefining(false);
    }
  };

  const applyPieceCorrection = (url: string) => {
    if (!proposalResult) return;
    setCorrectionUndo({ before: proposalResult, after: url, view: renderView });
    const nextResults = { ...viewResults, [renderView]: url };
    setViewResults(nextResults); setProposalResult(url); setLockedIteration(null);
    setProposalHistory(previous => [...previous, url]); setCorrectingPiece(false);
    onResult?.({ imageUrl: url, storedUrl: url, text: "Single-piece correction", pinnedProducts: selectedProducts, renderView, draft: { ...draft, axonometricResult: nextResults.axonometric, eyeLevelResult: nextResults["eye-level"] } });
  };
  const undoPieceCorrection = () => {
    if (!correctionUndo || correctionUndo.view !== renderView || correctionUndo.after !== proposalResult) return;
    const url = correctionUndo.before, nextResults = { ...viewResults, [renderView]: url };
    setViewResults(nextResults); setProposalResult(url); setCorrectionUndo(null); setLockedIteration(null);
    onResult?.({ imageUrl: url, storedUrl: url, text: "Single-piece correction undone", pinnedProducts: selectedProducts, renderView, draft: { ...draft, axonometricResult: nextResults.axonometric, eyeLevelResult: nextResults["eye-level"] } });
  };

  const downloadProposal = async () => {
    if (!proposalResult) return;
    try {
      const response = await fetch(proposalResult);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `proposal-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(proposalResult, "_blank");
    }
  };

  // Generate a transparent CAD-dimension overlay for the current proposal and
  // surface a per-product QA breakdown so the admin can see exactly where the
  // rendered scale drifts from the parsed CAD bbox.
  const runCadAudit = async () => {
    if (!proposalResult) return;
    setCadAuditing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");

      const placements = selectedProducts.map((p) => ({
        product_id: p.product_id || null,
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: toAbsoluteUrl(p.image_url),
        dimensions: p.dimensions || null,
      }));

      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: await prepareAiRenderImages({
          imageUrl: toAbsoluteUrl(proposalResult),
          mode: "cad_dimension_overlay",
          qualityTier,
          placements,
        }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setCadOverlayUrl(data.storedUrl || data.imageUrl);
      setCadQaRows(Array.isArray(data.cadQa) ? data.cadQa : []);
      setCadOverlayVisible(true);
      setShowCadOverlay(true);
      const mismatches = (data.cadQa || []).filter((r: any) => r.status === "mismatch").length;
      toast({
        title: "CAD scale audit ready",
        description: mismatches > 0 ? `${mismatches} placement(s) diverge from CAD dimensions.` : "All placements match parsed CAD dimensions.",
      });
    } catch (e: any) {
      toast({ title: "CAD audit failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setCadAuditing(false);
    }
  };

  // Save proposal image to various destinations
  const saveToGallery = async () => {
    if (!proposalResult || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("axonometric_gallery").insert({
        created_by: user.id,
        image_url: proposalResult,
        title: `Proposal — ${new Date().toLocaleDateString()}`,
        description: `Furniture proposal with ${selectedProducts.map(p => p.product_name).join(", ")}`,
        is_published: false,
        project_name: "",
        style_preset: style,
      });
      if (error) throw error;
      toast({ title: "Saved to Gallery", description: "Added as a draft in your gallery" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveToMediaLibrary = async () => {
    if (!proposalResult) return;
    setSaving(true);
    try {
      // Fetch the image and upload to storage
      const res = await fetch(proposalResult);
      const blob = await res.blob();
      const path = `products/proposal-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      toast({ title: "Saved to Media Library", description: "Image uploaded to storage" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveToPresentation = async () => {
    if (!proposalResult || !user) return;
    setSaving(true);
    try {
      // Find most recent presentation or create one
      const { data: presentations } = await supabase
        .from("presentations")
        .select("id")
        .eq("created_by", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      let presentationId: string;
      if (presentations && presentations.length > 0) {
        presentationId = presentations[0].id;
      } else {
        const { data: newPres, error: presError } = await supabase
          .from("presentations")
          .insert({ created_by: user.id, title: "Proposals" })
          .select("id")
          .single();
        if (presError || !newPres) throw presError || new Error("Failed to create presentation");
        presentationId = newPres.id;
      }

      // Get current max sort order
      const { data: slides } = await supabase
        .from("presentation_slides")
        .select("sort_order")
        .eq("presentation_id", presentationId)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextOrder = (slides?.[0]?.sort_order ?? -1) + 1;

      const { error } = await supabase.from("presentation_slides").insert({
        presentation_id: presentationId,
        image_url: proposalResult,
        title: `Proposal — ${selectedProducts.map(p => p.product_name).join(", ")}`,
        sort_order: nextOrder,
      });
      if (error) throw error;
      toast({ title: "Saved to Presentations", description: "Added as a new slide" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Auto-create full presentation deck from proposal
  const createProposalPresentation = async () => {
    if (!proposalResult || !user) return;
    setCreatingPresentation(true);
    try {
      const dateLabel = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      const productNames = selectedProducts.map(p => p.product_name).join(", ");

      // 1. Create the presentation
      const { data: pres, error: presError } = await supabase
        .from("presentations")
        .insert({
          created_by: user.id,
          title: `Proposal — ${dateLabel}`,
          description: `Furniture proposal featuring ${productNames}`,
          client_name: "",
          project_name: "",
          cover_style: "default",
          is_published: false,
        })
        .select("id")
        .single();
      if (presError || !pres) throw presError || new Error("Failed to create presentation");
      const presId = pres.id;

      // Look up pricing from trade_products
      const productPrices: Record<string, { trade_price_cents: number | null; rrp_price_cents: number | null; currency: string; spec_sheet_url: string | null }> = {};
      {
        const { data: dbProducts } = await supabase
          .from("trade_products")
          .select("product_name, brand_name, trade_price_cents, rrp_price_cents, currency, spec_sheet_url")
          .in("brand_name", [...new Set(selectedProducts.map(p => p.brand_name))]);
        if (dbProducts) {
          for (const dbp of dbProducts) {
            const key = `${dbp.product_name}|||${dbp.brand_name}`.toLowerCase();
            productPrices[key] = {
              trade_price_cents: dbp.trade_price_cents,
              rrp_price_cents: dbp.rrp_price_cents,
              currency: dbp.currency,
              spec_sheet_url: dbp.spec_sheet_url,
            };
          }
        }
      }

      // Helper: build product description line
      const buildProductDesc = (product: SelectedProduct) => {
        const priceKey = `${product.product_name}|||${product.brand_name}`.toLowerCase();
        const pricing = productPrices[priceKey];
        const pdfLinks = product.pdf_urls?.map(p => p.label).join(", ") || product.pdf_url ? "PDF available" : "";

        let desc = `Brand: ${product.brand_name}`;
        if (product.dimensions) desc += `\nDimensions: ${product.dimensions}`;
        if (product.materials) desc += `\nMaterials: ${product.materials}`;
        if (pdfLinks) desc += `\nSpecifications: ${pdfLinks}`;

        if (showPrices && pricing) {
          const price = pricing.trade_price_cents ?? pricing.rrp_price_cents;
          if (price) {
            const formatted = exportCurrency.format(
              exportCurrency.convert(price, pricing.currency),
            );
            desc += `\nPrice: ${formatted}${pricing.trade_price_cents ? " (Trade)" : " (RRP)"}`;
          } else {
            desc += `\nPrice upon Request`;
          }
        }
        return desc;
      };

      // Helper: group products 4-per-page into slides
      const buildProductPageSlides = (products: SelectedProduct[], presId: string, startOrder: number, optionLabel: string) => {
        const pageSlides: Array<{ presentation_id: string; image_url: string; title: string; description: string; sort_order: number }> = [];
        for (let i = 0; i < products.length; i += 4) {
          const chunk = products.slice(i, i + 4);
          const pageNum = Math.floor(i / 4) + 1;
          const totalPages = Math.ceil(products.length / 4);
          const desc = chunk.map((p, idx) => `${i + idx + 1}. ${p.product_name}\n${buildProductDesc(p)}`).join("\n\n");
          pageSlides.push({
            presentation_id: presId,
            image_url: chunk[0].image_url, // lead with first product image
            title: `${optionLabel} — Product Specifications${totalPages > 1 ? ` (${pageNum}/${totalPages})` : ""}`,
            description: desc,
            sort_order: startOrder + Math.floor(i / 4),
          });
        }
        return pageSlides;
      };

      let sortOrder = 0;
      const slides: Array<{
        presentation_id: string;
        image_url: string;
        title: string;
        description?: string;
        sort_order: number;
        slide_type: string;
        room_section?: string;
        linked_product_ids?: any;
        linked_quote_id?: string;
      }> = [];

      // Slide 1: Cover — Maison Affluency branded with date
      slides.push({
        presentation_id: presId,
        image_url: furnishedImageUrl,
        title: "Maison Affluency",
        description: `Furniture Proposal\n${dateLabel}`,
        sort_order: sortOrder++,
        slide_type: "cover",
      });

      // Slide 2: Client's original 2D layout — source drawing
      slides.push({
        presentation_id: presId,
        image_url: furnishedImageUrl,
        title: "Client's Original 2D Layout",
        description: "Source drawing provided by client — spatial reference for furniture positioning.",
        sort_order: sortOrder++,
        slide_type: "source_drawing",
      });

      // Slide 3: Generated axonometric / 3D architectural shell
      if (emptyRoomUrl) {
        slides.push({
          presentation_id: presId,
          image_url: emptyRoomUrl,
          title: "3D Architectural Rendering",
          description: "Architectural shell with movable furniture removed — blank canvas for proposals.",
          sort_order: sortOrder++,
          slide_type: "axonometric",
        });
      }

      // Create a single grouped quote for all options
      let quoteId: string | null = null;
      try {
        const { data: quote, error: quoteError } = await createActiveDraftQuote(user.id, {
          notes: `Auto-generated from Proposal Builder — ${dateLabel}`,
          client_name: "",
        });
        if (!quoteError && quote) {
          quoteId = quote.id;
          for (const product of selectedProducts) {
            try {
              await supabase.rpc("add_gallery_product_to_quote", {
                _user_id: user.id,
                _quote_id: quote.id,
                _product_name: product.product_name,
                _brand_name: product.brand_name,
                _image_url: product.image_url,
                _dimensions: product.dimensions || undefined,
                _materials: product.materials || undefined,
                _quantity: 1,
              });
            } catch (e) {
              console.warn("Failed to add product to quote:", product.product_name, e);
            }
          }
        }
      } catch (e) {
        console.warn("Could not create quote:", e);
      }

      // Build presentation from the latest approved proposal only (no mixed iterations)
      const finalProposalImage = proposalResult;
      const optionLabel = "Final Approved Option";
      const productDataForSlides = selectedProducts.map(p => ({
        id: p.id,
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: p.image_url,
        dimensions: p.dimensions || null,
        materials: p.materials || null,
      }));

      // Furnishing option slide
      slides.push({
        presentation_id: presId,
        image_url: finalProposalImage,
        title: optionLabel,
        description: `AI-generated furniture proposal featuring ${productNames}.`,
        sort_order: sortOrder++,
        slide_type: "furnishing_option",
        linked_product_ids: productDataForSlides,
      });

      // Product grid cards — max 2 per page, grouped by room section
      const roomGroups = new Map<string, typeof selectedProducts>();
      for (const p of selectedProducts) {
        const section = p.room_section || "Featured Products";
        if (!roomGroups.has(section)) roomGroups.set(section, []);
        roomGroups.get(section)!.push(p);
      }

      for (const [section, sectionProducts] of roomGroups) {
        for (let i = 0; i < sectionProducts.length; i += 2) {
          const chunk = sectionProducts.slice(i, i + 2);
          const chunkData = chunk.map(p => ({
            id: p.id,
            product_name: p.product_name,
            brand_name: p.brand_name,
            image_url: p.image_url,
            dimensions: p.dimensions || null,
            materials: p.materials || null,
            pdf_url: p.pdf_url || null,
          }));

          slides.push({
            presentation_id: presId,
            image_url: chunk[0].image_url,
            title: `${optionLabel} — Product Specifications`,
            description: chunk.map(p => `${p.product_name} — ${p.brand_name}`).join("\n"),
            sort_order: sortOrder++,
            slide_type: "product_grid",
            room_section: section,
            linked_product_ids: chunkData,
          });
        }
      }

      // Quote summary slide
      const quoteRef = quoteId ? `QU-${quoteId.slice(0, 6).toUpperCase()}` : "Pending";
      const quoteDesc = selectedProducts.map(p => `• ${p.product_name} — ${p.brand_name}`).join("\n");
      slides.push({
        presentation_id: presId,
        image_url: finalProposalImage,
        title: `${optionLabel} — Quote Summary`,
        description: `Products:\n${quoteDesc}\n\nQuote Ref: ${quoteRef}\nAvailable for review in your Quote Builder.\nPayment terms: 60% deposit · 40% balance before delivery.`,
        sort_order: sortOrder++,
        slide_type: "quote_summary",
        linked_quote_id: quoteId || undefined,
        linked_product_ids: productDataForSlides,
      });

      // Insert all slides
      const { error: slidesError } = await supabase.from("presentation_slides").insert(slides);
      if (slidesError) throw slidesError;

      const quoteLabel = quoteId
        ? `Quote QU-${quoteId.slice(0, 6).toUpperCase()} created`
        : "No quote created";

      toast({
        title: "Presentation created",
        description: `${slides.length} slides. ${quoteLabel}. View in Presentations.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to create presentation", description: e?.message, variant: "destructive" });
    } finally {
      setCreatingPresentation(false);
    }
  };

  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  // Click-to-move marker state
  type MoveMarker = { x: number; y: number }; // percentage coords on image
  const [moveMode, setMoveMode] = useState(false);
  const [removeMode, setRemoveMode] = useState(false);
  const [sourceMarker, setSourceMarker] = useState<MoveMarker | null>(null);
  const [targetMarker, setTargetMarker] = useState<MoveMarker | null>(null);
  const [moveLabel, setMoveLabel] = useState(""); // optional label for what's being moved
  const [removeMarkers, setRemoveMarkers] = useState<{ pos: MoveMarker; label: string }[]>([]);
  const [removeLabel, setRemoveLabel] = useState("");
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageElRef = useRef<HTMLImageElement>(null);

  const resetTransform = useCallback(() => {
    setRotation(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const clearMarkers = useCallback(() => {
    setSourceMarker(null);
    setTargetMarker(null);
    setMoveLabel("");
    setRemoveMarkers([]);
    setRemoveLabel("");
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(5, Math.max(0.2, z - e.deltaY * 0.001)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (moveMode || removeMode) return; // don't pan in interactive modes
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOffset.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan, moveMode, removeMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Compute percentage coordinates from a click on the image
  const getImageCoords = useCallback((e: React.MouseEvent): MoveMarker | null => {
    if (!imageElRef.current) return null;
    const rect = imageElRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;
    const rad = -(rotation * Math.PI) / 180;
    const cx = 0.5, cy = 0.5;
    const dx = rawX - cx;
    const dy = rawY - cy;
    const unrotatedX = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
    const unrotatedY = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
    const xPct = Math.round(Math.max(0, Math.min(100, unrotatedX * 100)));
    const yPct = Math.round(Math.max(0, Math.min(100, unrotatedY * 100)));
    return { x: xPct, y: yPct };
  }, [rotation]);

  // Handle click-to-place markers on the image
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if ((!moveMode && !removeMode) || !imageElRef.current) return;
    e.stopPropagation();

    const clamped = getImageCoords(e);
    if (!clamped) return;

    if (removeMode) {
      const label = removeLabel.trim() || `item at (${clamped.x}%, ${clamped.y}%)`;
      const updated = [...removeMarkers, { pos: clamped, label }];
      setRemoveMarkers(updated);
      // Auto-fill the refinement prompt
      const descriptions = updated.map((m) => m.label).join(", ");
      setRefinementPrompt(`Remove the following from the image: ${descriptions}. Fill the empty space with the surrounding room background. Keep everything else exactly the same.`);
      setRemoveLabel("");
      return;
    }

    // Move mode
    if (!sourceMarker) {
      setSourceMarker(clamped);
    } else if (!targetMarker) {
      setTargetMarker(clamped);
      const label = moveLabel.trim() || "the furniture piece";
      const direction = describeDirection(sourceMarker, clamped);
      setRefinementPrompt(`Move ${label} at position (${sourceMarker.x}%, ${sourceMarker.y}%) to (${clamped.x}%, ${clamped.y}%) — move it ${direction}. Keep everything else exactly the same.`);
    }
  }, [moveMode, removeMode, sourceMarker, targetMarker, moveLabel, removeLabel, removeMarkers, rotation, getImageCoords]);

  // Describe direction in natural language
  const describeDirection = (from: MoveMarker, to: MoveMarker): string => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const parts: string[] = [];
    if (Math.abs(dx) > 5) parts.push(dx > 0 ? "to the right" : "to the left");
    if (Math.abs(dy) > 5) parts.push(dy > 0 ? "downward" : "upward");
    return parts.length > 0 ? parts.join(" and ") : "to the new position";
  };

  // Render a marker dot on the image
  const renderMarker = (marker: MoveMarker, color: "source" | "target") => {
    const isSource = color === "source";
    return (
      <div
        className="absolute pointer-events-none z-10"
        style={{ left: `${marker.x}%`, top: `${marker.y}%`, transform: "translate(-50%, -50%)" }}
      >
        <div className={`w-5 h-5 rounded-full border-2 ${isSource ? "border-red-500 bg-red-500/30" : "border-emerald-500 bg-emerald-500/30"} flex items-center justify-center`}>
          <div className={`w-2 h-2 rounded-full ${isSource ? "bg-red-500" : "bg-emerald-500"}`} />
        </div>
        <span className={`absolute top-6 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium whitespace-nowrap ${isSource ? "text-red-400" : "text-emerald-400"}`}>
          {isSource ? "FROM" : "TO"}
        </span>
      </div>
    );
  };

  if (expanded && proposalResult) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-sm text-foreground">Proposal — Expanded View</h2>
            {proposalHistory.length > 1 && (
              <span className="font-body text-[10px] text-muted-foreground">Iteration {proposalHistory.length}</span>
            )}
            {lockedIteration !== null && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2 py-0.5 font-body text-[10px] font-medium">
                <CheckCircle2 className="w-3 h-3" />Final Approved
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Move mode toggle */}
            <Button
              variant={moveMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMoveMode((m) => !m);
                setRemoveMode(false);
                if (moveMode) clearMarkers();
              }}
              title={moveMode ? "Exit move mode" : "Click to reposition furniture"}
              className="gap-1.5"
            >
              <Crosshair className="w-3.5 h-3.5" />
              {moveMode ? "Exit Move" : "Move Furniture"}
            </Button>

            {/* Remove mode toggle */}
            <Button
              variant={removeMode ? "destructive" : "outline"}
              size="sm"
              onClick={() => {
                setRemoveMode((m) => !m);
                setMoveMode(false);
                if (removeMode) clearMarkers();
              }}
              title={removeMode ? "Exit remove mode" : "Click to mark furniture for removal"}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {removeMode ? "Exit Remove" : "Remove Furniture"}
            </Button>

            {/* Before/After compare */}
            {proposalHistory.length > 1 && (
              <Button
                variant={compareMode ? "default" : "outline"}
                size="sm"
                onClick={() => setCompareMode((c) => !c)}
                className="gap-1.5"
                title="Toggle before/after split view"
              >
                <SplitSquareHorizontal className="w-3.5 h-3.5" />
                {compareMode ? "Exit Compare" : "Compare"}
              </Button>
            )}

            <div className="w-px h-5 bg-border mx-1" />

            {/* Transform controls */}
            <Button variant="ghost" size="sm" onClick={() => setRotation((r) => r - 15)} title="Rotate left 15°">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRotation((r) => r + 15)} title="Rotate right 15°">
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(5, z + 0.25))} title="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.2, z - 0.25))} title="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={resetTransform} title="Reset view">
              <Move className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[10px] text-muted-foreground font-body w-16 text-center tabular-nums">
              {Math.round(zoom * 100)}% · {rotation}°
            </span>
            <div className="w-px h-5 bg-border mx-1" />

            {/* Set as Final */}
            <Button
              variant={lockedIteration !== null ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (lockedIteration !== null) {
                  setLockedIteration(null);
                  toast({ title: "Final lock removed", description: "You can continue refining." });
                } else {
                  setLockedIteration(proposalHistory.length);
                  toast({ title: "Iteration locked as final", description: "Save or create a presentation with this version." });
                }
              }}
              className="gap-1.5"
              title={lockedIteration !== null ? "Unlock to continue refining" : "Lock this iteration as the final approved version"}
            >
              {lockedIteration !== null ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {lockedIteration !== null ? "Final ✓" : "Set as Final"}
            </Button>

            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="outline" size="sm" onClick={downloadProposal}>
              <Download className="w-3.5 h-3.5 mr-1.5" />Download
            </Button>
            <Button variant="outline" size="sm" onClick={runCadAudit} disabled={cadAuditing || !proposalResult}>
              {cadAuditing ? <DotCircleLoader size="sm" className="w-3.5 h-3.5 mr-1.5" /> : <Ruler className="w-3.5 h-3.5 mr-1.5" />}
              CAD Scale Audit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={saving || lockedIteration === null}>
                  {saving ? <DotCircleLoader size="sm" className="w-3.5 h-3.5 mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Save to…
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={saveToGallery} className="gap-2">
                  <Image className="w-3.5 h-3.5" />Gallery (My Drafts)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={saveToPresentation} className="gap-2">
                  <Layout className="w-3.5 h-3.5" />Presentations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={saveToMediaLibrary} className="gap-2">
                  <FolderOpen className="w-3.5 h-3.5" />Media Library
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              onClick={createProposalPresentation}
              disabled={creatingPresentation || saving || lockedIteration === null}
              className="gap-1.5"
            >
              {creatingPresentation ? <DotCircleLoader size="sm" className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              Create Presentation
            </Button>
            <label className="flex items-center gap-1.5 font-body text-[10px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} className="rounded border-border" />
              Prices
            </label>
            <Button variant="ghost" size="sm" onClick={() => { setExpanded(false); resetTransform(); clearMarkers(); setMoveMode(false); setRemoveMode(false); }}>
              <Minimize2 className="w-3.5 h-3.5 mr-1.5" />Collapse
            </Button>
          </div>
        </div>

        {/* Move mode instructions */}
        {moveMode && (
          <div className="px-4 py-2 bg-accent/10 border-b border-border flex items-center gap-4">
            <span className="font-body text-xs text-foreground">
              {!sourceMarker
                ? "① Click on the furniture piece you want to move"
                : !targetMarker
                  ? "② Now click where you want it placed"
                  : "✓ Markers set — review the prompt below and send"}
            </span>
            {!sourceMarker && (
              <Input
                value={moveLabel}
                onChange={(e) => setMoveLabel(e.target.value)}
                placeholder="What piece? e.g. 'the armchair', 'the coffee table'…"
                className="font-body text-xs max-w-xs h-7"
              />
            )}
            {(sourceMarker || targetMarker) && (
              <Button variant="ghost" size="sm" onClick={clearMarkers} className="gap-1 text-xs h-7">
                <Trash2 className="w-3 h-3" />Clear markers
              </Button>
            )}
          </div>
        )}

        {/* Remove mode instructions */}
        {removeMode && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-border flex items-center gap-4">
            <span className="font-body text-xs text-foreground">
              Click on each item you want removed ({removeMarkers.length} marked) — then send the prompt below
            </span>
            <Input
              value={removeLabel}
              onChange={(e) => setRemoveLabel(e.target.value)}
              placeholder="What piece? e.g. 'the piano', 'the vase'… (optional)"
              className="font-body text-xs max-w-xs h-7"
            />
            {removeMarkers.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => {
                  const updated = removeMarkers.slice(0, -1);
                  setRemoveMarkers(updated);
                  if (updated.length > 0) {
                    const descriptions = updated.map((m) => m.label).join(", ");
                    setRefinementPrompt(`Remove the following items: ${descriptions}. Keep everything else exactly the same.`);
                  } else {
                    setRefinementPrompt("");
                  }
                }} className="gap-1 text-xs h-7">
                  <Undo2 className="w-3 h-3" />Undo last
                </Button>
                <Button variant="ghost" size="sm" onClick={clearMarkers} className="gap-1 text-xs h-7">
                  <Trash2 className="w-3 h-3" />Clear all
                </Button>
              </>
            )}
          </div>
        )}

        {compareMode && proposalHistory.length > 1 ? (
          <div className="flex-1 overflow-hidden p-4 flex items-center justify-center">
            <div className="max-w-[90vw] max-h-[80vh] w-full h-full">
              <BeforeAfterSplit
                beforeUrl={proposalHistory[proposalHistory.length - 2]}
                afterUrl={proposalResult}
                beforeLabel={`Iteration ${proposalHistory.length - 1}`}
                afterLabel={`Iteration ${proposalHistory.length}`}
              />
            </div>
          </div>
        ) : (
        <div
          ref={imageContainerRef}
          className={`flex-1 overflow-hidden flex items-center justify-center select-none ${(moveMode || removeMode) ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
          onWheel={handleWheel}
          onPointerDown={(moveMode || removeMode) ? undefined : handlePointerDown}
          onPointerMove={(moveMode || removeMode) ? undefined : handlePointerMove}
          onPointerUp={(moveMode || removeMode) ? undefined : handlePointerUp}
        >
          <div
            className="relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
              transition: isPanning.current ? "none" : "transform 0.2s ease",
            }}
            onClick={(moveMode || removeMode) ? handleImageClick : undefined}
          >
            <img
              ref={imageElRef}
              src={proposalResult}
              alt="Generated proposal"
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
              draggable={false}
            />
            {!moveMode && !removeMode && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(false); resetTransform(); clearMarkers(); setMoveMode(false); setRemoveMode(false); }}
                className="absolute top-3 right-3 z-20 bg-background/80 backdrop-blur-sm border border-border rounded-full p-2 hover:bg-background transition-colors shadow-lg"
                title="Collapse"
              >
                <Minimize2 className="w-4 h-4 text-foreground" />
              </button>
            )}
            {sourceMarker && renderMarker(sourceMarker, "source")}
            {targetMarker && renderMarker(targetMarker, "target")}
            {sourceMarker && targetMarker && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="rgb(16 185 129)" />
                  </marker>
                </defs>
                <line
                  x1={`${sourceMarker.x}%`} y1={`${sourceMarker.y}%`}
                  x2={`${targetMarker.x}%`} y2={`${targetMarker.y}%`}
                  stroke="rgb(16 185 129)" strokeWidth="2" strokeDasharray="6 3"
                  markerEnd="url(#arrowhead)"
                />
              </svg>
            )}
            {removeMarkers.map((rm, idx) => (
              <div
                key={idx}
                className="absolute pointer-events-none z-10"
                style={{ left: `${rm.pos.x}%`, top: `${rm.pos.y}%`, transform: "translate(-50%, -50%)" }}
              >
                <div className="w-6 h-6 rounded-full border-2 border-red-500 bg-red-500/30 flex items-center justify-center">
                  <X className="w-3 h-3 text-red-500" />
                </div>
                <span className="absolute top-7 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium whitespace-nowrap text-red-400">
                  {rm.label.length > 20 ? rm.label.slice(0, 18) + "…" : rm.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        )}
        <div className="p-4 border-t border-border">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input
              value={refinementPrompt}
              onChange={(e) => setRefinementPrompt(e.target.value)}
              placeholder={(moveMode || removeMode) ? "Markers will auto-fill this prompt — or type manually" : "Refine: e.g. 'Move the sofa further left', 'Remove the piano'…"}
              className="font-body text-xs flex-1"
              onKeyDown={(e) => e.key === "Enter" && !refining && refineProposal()}
              disabled={refining}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => { refineProposal(); clearMarkers(); }}
              disabled={refining || !refinementPrompt.trim()}
            >
              {refining ? <DotCircleLoader size="sm" className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={generateProposal}
              disabled={generating || refining}
              title="Regenerate from scratch"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* Hidden file input for external uploads */}
      <input
        ref={externalFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleExternalFile}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Back to AI Render Studio" className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="font-display text-sm text-foreground">Proposal Builder</h2>
            <p className="font-body text-[11px] text-muted-foreground">
              Select replacement products — AI will place them matching the client's original layout
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Quality Tier */}
          <div className="flex items-center border border-border rounded-md overflow-hidden text-[10px] font-display">
            {(["draft", "standard", "premium"] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setQualityTier(tier)}
                className={`px-2 py-1.5 capitalize transition-colors ${
                  qualityTier === tier
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={generateProposal}
            disabled={busy || !proposalBaseUrl || selectedProducts.length === 0}
          >
            {generating ? (
              <><DotCircleLoader size="sm" className="w-3.5 h-3.5 mr-1.5" />Generating…</>
            ) : (
              <><Wand2 className="w-3.5 h-3.5 mr-1.5" />Generate Proposal ({selectedProducts.length})</>
            )}
          </Button>
          {proposalResult && (
            <>
              <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
                <Maximize2 className="w-3.5 h-3.5 mr-1.5" />Expand
              </Button>
              <Button
                variant={lockedIteration !== null ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (lockedIteration !== null) {
                    setLockedIteration(null);
                    toast({ title: "Final lock removed" });
                  } else {
                    setLockedIteration(proposalHistory.length);
                    toast({ title: "Iteration locked as final" });
                  }
                }}
                className="gap-1.5"
                title={lockedIteration !== null ? "Unlock to continue refining" : "Lock this iteration as final"}
              >
                {lockedIteration !== null ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {lockedIteration !== null ? "Final ✓" : "Set as Final"}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadProposal}>
                <Download className="w-3.5 h-3.5 mr-1.5" />Download
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={saving || lockedIteration === null}>
                    {saving ? <DotCircleLoader size="sm" className="w-3.5 h-3.5 mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    Save to…
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={saveToGallery} className="gap-2">
                    <Image className="w-3.5 h-3.5" />Gallery (My Drafts)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={saveToPresentation} className="gap-2">
                    <Layout className="w-3.5 h-3.5" />Presentations
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={saveToMediaLibrary} className="gap-2">
                    <FolderOpen className="w-3.5 h-3.5" />Media Library
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                onClick={createProposalPresentation}
                disabled={creatingPresentation || saving || lockedIteration === null}
                className="gap-1.5"
              >
                {creatingPresentation ? <DotCircleLoader size="sm" className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                Create Presentation
              </Button>
              <label className="flex items-center gap-1.5 font-body text-[10px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} className="rounded border-border" />
                Prices
              </label>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex gap-1" role="group" aria-label="Proposal viewpoint">
          <Button size="sm" variant={renderView === "axonometric" ? "default" : "outline"} disabled={busy} onClick={() => changeView("axonometric")}>Top-down Axonometric</Button>
          <Button size="sm" variant={renderView === "eye-level" ? "default" : "outline"} disabled={busy} onClick={() => changeView("eye-level")}><Eye className="size-3.5 mr-1.5" />Eye-Level Interior</Button>
        </div>
        {proposalResult && <Button size="sm" variant="outline" disabled={busy} onClick={exportPageTwo}><FileText className="size-3.5 mr-1.5" />{exportingPageTwo ? "Exporting…" : "Export to Client Proposal · Page 2"}</Button>}
      </div>
      {renderError && <p role="alert" className="text-sm text-destructive">{renderError}</p>}
      {renderView === "eye-level" && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="font-display text-xs text-muted-foreground uppercase">Empty Room Template · Camera</h3>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><label htmlFor="builder-room-type" className="text-xs text-muted-foreground">Room type</label><Select value={roomType} disabled={busy} onValueChange={value => { const type = value as RoomType;setRoomType(type);setRoomName(ROOM_TYPES[type]);if (roomZone) changeRoomZone({ ...roomZone,room_type: type,room_name: ROOM_TYPES[type] }); }}><SelectTrigger id="builder-room-type"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ROOM_TYPES).map(([key,label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><label htmlFor="builder-room-name" className="text-xs text-muted-foreground">Room name</label><Input id="builder-room-name" value={roomName} maxLength={120} disabled={busy} onChange={e => { setRoomName(e.target.value);if (roomZone) changeRoomZone({ ...roomZone,room_name: e.target.value }); }} /></div></div>
          <EyeLevelCameraPlan imageUrl={cameraPlanUrl} camera={camera} onChange={setCamera} disabled={busy} zone={roomZone} onZoneChange={box => changeRoomZone({ ...box,room_type: roomType,room_name: roomName })} />
          {roomZone && <p className="text-xs text-muted-foreground">{roomZone.room_name} · {Math.round(roomZone.width)}% × {Math.round(roomZone.height)}% crop · {roomProducts.length} assigned pieces</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy || !currentShellKey || !validRoomZone(roomZone)} onClick={generateEyeLevelShell}><Wand2 className="size-3.5 mr-1.5" />{shellGenerating ? "Generating Eye-Level Shell…" : eyeLevelShell && !shellReady ? "Regenerate Eye-Level Shell" : "Generate Eye-Level Shell"}</Button>
            {isAdmin && rolesLoaded && <SaveResidenceShell url={shellReady ? eyeLevelShell : null} proposalUrl={proposalResult} disabled={busy} />}
            {isAdmin && rolesLoaded && roomZone && validRoomZone(roomZone) && <SaveResidenceRoom shellUrl={shellReady ? eyeLevelShell : null} renderUrl={proposalResult} zone={roomZone} pieces={roomProducts} disabled={busy} />}
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="font-display text-xs text-muted-foreground uppercase">Empty Eye-Level Shell</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-auto min-h-9 whitespace-normal text-left" disabled={busy} onClick={() => shellFileRef.current?.click()}><Upload />{shellUploading ? "Uploading Room Image…" : "Upload Developer Render / Empty Room Photo"}</Button>
            <input ref={shellFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => void uploadShell(e.target.files?.[0])} />
            <SandboxShellCapture disabled={busy} onCapture={captureShell} />
          </div>
          {eyeLevelShell ? <EyeLevelPlacementShell url={eyeLevelShell} products={roomProducts} disabled={busy || !shellReady} onTarget={updateTarget} /> : <div className="min-h-48 flex items-center justify-center border border-dashed border-border text-sm text-muted-foreground">{shellGenerating ? "Generating interior…" : "Eye-level shell pending"}</div>}
          {eyeLevelShell && <p className="text-xs text-muted-foreground">{shellSource === "upload" ? "Developer render / room photo" : shellSource === "sandbox" ? "3D Sandbox capture" : "AI-generated shell"}</p>}
          {eyeLevelShell && !shellReady && <p className="text-xs text-muted-foreground">Camera or plan changed · shell needs regeneration.</p>}
        </div>
      </div>}

      {/* Side-by-side view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Original furnished */}
        <div className="space-y-2">
          <h3 className="font-display text-xs text-muted-foreground uppercase tracking-wider">
            Client's Original Layout
          </h3>
          <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
            <img
              src={furnishedImageUrl}
              alt="Original furnished layout"
              className="w-full object-contain"
            />
          </div>
          <p className="font-body text-[10px] text-muted-foreground">
            AI will analyse this layout to match furniture positions &amp; orientations
          </p>
        </div>

        {/* Right: Empty room or generated proposal */}
        <div className="space-y-2">
          <h3 className="font-display text-xs text-muted-foreground uppercase tracking-wider">
            {proposalResult ? (renderView === "eye-level" ? "Eye-Level Furniture Proposal" : "Generated Proposal") : renderView === "eye-level" ? "Eye-Level Proposal" : "Empty Room Template"}
          </h3>

          {proposalResult ? (
            <div className="space-y-2">
              <div
                className="border border-border rounded-lg overflow-hidden bg-muted/10 cursor-pointer group relative"
                onClick={() => setExpanded(true)}
              >
                <img src={proposalResult} alt="Generated proposal" className="w-full object-contain" />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors flex items-center justify-center pointer-events-none">
                  <Maximize2 className="w-6 h-6 text-foreground/0 group-hover:text-foreground/50 transition-colors" />
                </div>
              </div>
              {proposalHistory.length > 1 && (
                <p className="font-body text-[10px] text-muted-foreground text-right">
                  Iteration {proposalHistory.length}
                </p>
              )}
              {/* Refinement prompt */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy || !stagingProducts.length} onClick={() => setCorrectingPiece(true)}><RefreshCw className="size-3.5" />Correct one piece</Button>
                {correctionUndo?.view === renderView && correctionUndo.after === proposalResult && <Button size="sm" variant="ghost" disabled={busy} onClick={undoPieceCorrection}><Undo2 className="size-3.5" />Undo correction</Button>}
              </div>
              {correctingPiece && <FurnitureCorrectionDialog imageUrl={proposalResult} products={stagingProducts} onClose={() => setCorrectingPiece(false)} onApply={applyPieceCorrection} />}
              <div className="flex gap-2">
                <Input
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  placeholder="Refine: e.g. 'Move the sofa further left', 'Make the rug larger'…"
                  className="font-body text-xs flex-1"
                  onKeyDown={(e) => e.key === "Enter" && !refining && refineProposal()}
                  disabled={refining}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refineProposal}
                  disabled={refining || !refinementPrompt.trim()}
                >
                  {refining ? <DotCircleLoader size="sm" className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={generateProposal}
                  disabled={generating || refining}
                  title="Regenerate from scratch"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : renderView === "eye-level" ? (
            <div className="min-h-48 flex items-center justify-center border border-dashed border-border text-sm text-muted-foreground">Furniture proposal pending</div>
          ) : emptyRoomUrl ? (
            <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
              <img src={emptyRoomUrl} alt="Empty room template" className="w-full object-contain" />
            </div>
          ) : emptyRoomGenerating ? (
            <div className="border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] gap-3">
              <DotCircleLoader size="sm" className="text-muted-foreground" />
              <p className="font-body text-xs text-muted-foreground">Generating empty room…</p>
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] gap-3 p-6">
              {emptyRoomError && <p role="alert" className="font-body text-xs text-destructive text-center">{emptyRoomError}</p>}
              {onPrepareEmptyRoom ? (
                <Button variant="outline" size="sm" onClick={onPrepareEmptyRoom}>
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                  {emptyRoomError ? "Retry Empty Room" : "Create Empty Room"}
                </Button>
              ) : <p className="font-body text-xs text-muted-foreground">Empty room will appear here</p>}
            </div>
          )}
        </div>
      </div>

      {/* Selected products summary */}
      {selectedProducts.length > 0 && (
        <div className="border border-border rounded-lg p-4">
          <h3 className="font-display text-xs text-foreground mb-3">Selected Products ({selectedProducts.length}/10)</h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
            {selectedProducts.map((p) => (
              <div key={p.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-2 bg-muted/30 rounded-md px-2.5 py-2 group">
                {/* Thumbnail with rotation overlay */}
                <div className="relative w-11 h-11 shrink-0">
                  <div
                    className="w-11 h-11 rounded border border-border overflow-hidden bg-background"
                  >
                    <PrivateTradeImage
                      src={p.image_url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-300"
                      style={{ transform: p.rotation ? `rotate(${p.rotation}deg) scale(0.85)` : undefined }}
                    />
                  </div>
                  {/* Rotation badge */}
                  {!!p.rotation && (
                    <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                      <span className="text-[7px] font-display font-bold leading-none">{p.rotation}°</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[10px] text-foreground truncate">{p.product_name}</p>
                  <p className="font-body text-[9px] text-muted-foreground truncate">
                    {p.brand_name}
                    {p.isExternal && <span className="ml-1 text-muted-foreground/50">(ext)</span>}
                  </p>
                  {p.dimensions && <p className="font-body text-[8px] text-muted-foreground/70 truncate">{p.dimensions}</p>}
                </div>
                <div className="col-span-full col-start-1 row-start-2 space-y-2">
                  <label htmlFor={`room-section-${p.id}`} className="block text-xs text-muted-foreground">Room section</label>
                  <select
                    id={`room-section-${p.id}`}
                    value={p.room_section || ""}
                    disabled={busy}
                    onChange={(e) => updateRoomSection(p.id, e.target.value)}
                    className="w-full bg-transparent border border-border rounded px-2 py-1.5 font-body text-xs text-muted-foreground outline-hidden focus:border-foreground transition-colors cursor-pointer"
                  >
                    <option value="">Room section…</option>
                    {ROOM_SECTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    {roomZone && !ROOM_SECTIONS.some(r => r === roomZone.room_name) && <option value={roomZone.room_name}>{roomZone.room_name}</option>}
                  </select>
                  {p.selected_finishes?.map(finish => <p key={`${finish.axis}:${finish.name}`} className="mt-1 font-body text-[10px] text-muted-foreground">{finish.axis}: {finish.name}</p>)}
                  <label htmlFor={`material-override-${p.id}`} className="block text-xs text-muted-foreground">Material override</label>
                  <Input
                    id={`material-override-${p.id}`}
                    type="text"
                    disabled={busy || Boolean(lockedProducts?.length)}
                    value={p.material_override || ""}
                    onChange={(e) =>
                      setSelectedProducts((prev) =>
                        prev.map((x) => x.id === p.id ? { ...x, material_override: e.target.value } : x)
                      )
                    }
                    placeholder="e.g. brushed brass"
                    className="w-full text-xs"
                  />
                </div>
                {!lockedProducts?.length && <div className="col-start-3 row-start-1 shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => rotateProduct(p.id, -1)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    title="Rotate left 90°"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => rotateProduct(p.id, 1)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    title="Rotate right 90°"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeProduct(p.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Picker */}
      {!lockedProducts?.length && <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs text-foreground">
            Add Products to Proposal {selectedProducts.length >= 10 && <span className="text-muted-foreground">(max reached)</span>}
          </h3>
          <div className="flex items-center gap-3">
            {selectedProducts.length < 10 && (
              <button
                onClick={() => setShowExternalDialog(!showExternalDialog)}
                className="font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Upload className="w-3 h-3" />
                Import External
              </button>
            )}
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {pickerOpen ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {/* External image upload mini-form */}
        {showExternalDialog && selectedProducts.length < 10 && (
          <div className="border border-dashed border-border rounded-md p-3 space-y-2 bg-muted/10">
            <p className="font-body text-[10px] text-muted-foreground">
              Import a product image — upload from your device or paste a web URL
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={externalName}
                onChange={(e) => setExternalName(e.target.value)}
                placeholder="Product name *"
                className="font-body text-xs flex-1 min-w-[120px]"
              />
              <Input
                value={externalBrand}
                onChange={(e) => setExternalBrand(e.target.value)}
                placeholder="Brand (optional)"
                className="font-body text-xs flex-1 min-w-[120px]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={externalDimensions}
                onChange={(e) => setExternalDimensions(e.target.value)}
                placeholder="Dimensions — e.g. W65 × D58 × H79cm"
                className="font-body text-xs flex-1 min-w-[180px]"
              />
              <Input
                value={externalMaterials}
                onChange={(e) => setExternalMaterials(e.target.value)}
                placeholder="Materials (optional)"
                className="font-body text-xs flex-1 min-w-[120px]"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="Paste image URL from web…"
                className="font-body text-xs flex-1 min-w-[180px]"
                onKeyDown={(e) => e.key === "Enter" && !externalUploading && externalUrl.trim() && externalName.trim() && handleExternalUrl()}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!externalName.trim() || !externalUrl.trim() || externalUploading}
                onClick={handleExternalUrl}
              >
                {externalUploading ? (
                  <DotCircleLoader size="sm" className="w-3.5 h-3.5" />
                ) : (
                  <><Link className="w-3.5 h-3.5 mr-1.5" />Import URL</>
                )}
              </Button>
              <span className="font-body text-[10px] text-muted-foreground">or</span>
              <Button
                size="sm"
                variant="outline"
                disabled={!externalName.trim() || externalUploading}
                onClick={() => externalFileRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />Upload File
              </Button>
            </div>
          </div>
        )}

        {pickerOpen && selectedProducts.length < 10 && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-9 font-body text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}
                className="flex-1 min-w-[100px] border border-border rounded-md px-2 py-1.5 font-body text-xs bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground/20"
              >
                <option value="">All Categories</option>
                {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {subcategories.length > 0 && (
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="flex-1 min-w-[100px] border border-border rounded-md px-2 py-1.5 font-body text-xs bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground/20"
                >
                  <option value="">All {category}</option>
                  {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="flex-1 min-w-[100px] border border-border rounded-md px-2 py-1.5 font-body text-xs bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground/20"
              >
                <option value="">All Brands</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    p.image_url &&
                    addProduct({
                      product_id: (p as any).trade_product_id ?? undefined,
                      product_name: p.product_name,
                      brand_name: p.brand_name,
                      image_url: p.image_url,
                      dimensions: p.dimensions,
                      materials: p.materials,
                      pdf_url: p.pdf_url,
                      pdf_urls: p.pdf_urls,
                    })
                  }
                  className="rounded border border-border overflow-hidden text-left transition-all hover:border-foreground/30"
                  title={`${p.product_name} — ${p.brand_name}`}
                >
                  <PrivateTradeImage src={p.image_url || ""} alt={p.product_name} className="w-full aspect-square object-cover" />
                  <div className="px-1 py-0.5">
                    <p className="font-body text-[9px] text-foreground truncate">{p.product_name}</p>
                    <p className="font-body text-[8px] text-muted-foreground truncate">{p.brand_name}</p>
                  </div>
                </button>
              ))}
              {products.length === 0 && (
                <p className="col-span-6 font-body text-xs text-muted-foreground py-4 text-center">No products found</p>
              )}
            </div>
          </div>
        )}
      </div>

      }
      <Dialog open={showCadOverlay} onOpenChange={setShowCadOverlay}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="w-4 h-4" /> CAD Scale Audit
            </DialogTitle>
            <DialogDescription>
              Transparent orthographic overlay of CAD W×D×Hcm. Red marks placements that diverge from the parsed CAD bounding box.
            </DialogDescription>
          </DialogHeader>

          {proposalResult && (
            <div className="relative w-full bg-muted/30 border border-border rounded overflow-hidden">
              <img src={proposalResult} alt="Proposal render" className="w-full block" />
              {cadOverlayUrl && cadOverlayVisible && (
                <img
                  src={cadOverlayUrl}
                  alt="CAD dimension overlay"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCadOverlayVisible((v) => !v)}
              disabled={!cadOverlayUrl}
            >
              {cadOverlayVisible ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
              {cadOverlayVisible ? "Hide overlay" : "Show overlay"}
            </Button>
            {cadOverlayUrl && (
              <a
                href={cadOverlayUrl}
                download={`cad-overlay-${Date.now()}.png`}
                className="text-xs underline text-muted-foreground hover:text-foreground"
              >
                Download overlay PNG
              </a>
            )}
          </div>

          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-2 py-1.5">Product</th>
                  <th className="text-left px-2 py-1.5">Status</th>
                  <th className="text-left px-2 py-1.5">CAD (cm)</th>
                  <th className="text-left px-2 py-1.5">Applied</th>
                  <th className="text-left px-2 py-1.5">Δ (cm)</th>
                </tr>
              </thead>
              <tbody>
                {cadQaRows.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-3 text-muted-foreground text-center">No CAD data for any placement.</td></tr>
                )}
                {cadQaRows.map((r, i) => {
                  const color =
                    r.status === "match" ? "text-emerald-600" :
                    r.status === "mismatch" ? "text-red-600" :
                    "text-amber-600";
                  const d = r.delta_cm || {};
                  const deltaText = [d.w, d.d, d.h]
                    .map((v, idx) => v == null ? null : `${["W","D","H"][idx]}${v >= 0 ? "+" : ""}${v}`)
                    .filter(Boolean)
                    .join(" / ");
                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{r.product_name}</div>
                        <div className="text-muted-foreground text-[10px]">{r.brand_name}</div>
                      </td>
                      <td className={`px-2 py-1.5 font-medium ${color}`}>{r.status}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.expected_dim_text || "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.applied_dim_text || r.original_dim_text || "—"}</td>
                      <td className={`px-2 py-1.5 ${r.status === "mismatch" ? "text-red-600 font-medium" : "text-muted-foreground"}`}>{deltaText || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
