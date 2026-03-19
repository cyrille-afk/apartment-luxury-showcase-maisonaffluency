import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { getAllTradeProducts, getAllBrands } from "@/lib/tradeProducts";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "@/lib/productTaxonomy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Wand2, Search, X, Download, ArrowLeft, RefreshCw, Send, Maximize2, Minimize2, Upload, RotateCw, RotateCcw, ZoomIn, ZoomOut, Move, MousePointer2, Crosshair, Trash2, Link, Save, Image, Layout, FolderOpen, FileText,
} from "lucide-react";
import ProductChecklist from "./ProductChecklist";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

const toAbsoluteUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
};

interface SelectedProduct {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string;
  dimensions?: string;
  materials?: string;
  isExternal?: boolean;
  rotation?: number;
  pdf_url?: string;
  pdf_urls?: { label: string; url: string; filename?: string }[];
}

interface ProposalBuilderProps {
  furnishedImageUrl: string;
  emptyRoomUrl: string | null;
  emptyRoomGenerating: boolean;
  style: string;
  onClose: () => void;
  onResult?: (result: { imageUrl: string; storedUrl: string | null; text: string; pinnedProducts: SelectedProduct[] }) => void;
}

let _pinId = 0;
const nextPinId = () => `pin-${++_pinId}-${Date.now()}`;

export default function ProposalBuilder({
  furnishedImageUrl,
  emptyRoomUrl,
  emptyRoomGenerating,
  style,
  onClose,
  onResult,
}: ProposalBuilderProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const externalFileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [creatingPresentation, setCreatingPresentation] = useState(false);
  const [showPrices, setShowPrices] = useState(true);

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [generating, setGenerating] = useState(false);
  const [proposalResult, setProposalResult] = useState<string | null>(null);
  const [proposalHistory, setProposalHistory] = useState<string[]>([]);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [refining, setRefining] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const products = useMemo(() => {
    let all = getAllTradeProducts().filter((p) => p.image_url);
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
  }, [search, category, subcategory, brand]);

  const brands = useMemo(() => getAllBrands(getAllTradeProducts()), []);
  const subcategories = category ? (SUBCATEGORY_MAP[category] || []) : [];

  const addProduct = useCallback((product: { product_name: string; brand_name: string; image_url: string; dimensions?: string; materials?: string; isExternal?: boolean; pdf_url?: string; pdf_urls?: { label: string; url: string; filename?: string }[] }) => {
    if (selectedProducts.length >= 10) {
      toast({ title: "Maximum 10 products per proposal", variant: "destructive" });
      return;
    }
    setSelectedProducts((prev) => [
      ...prev,
      { id: nextPinId(), ...product },
    ]);
  }, [selectedProducts.length, toast]);

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
      const path = `proposal-externals/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("assets").upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      addProduct({
        product_name: externalName.trim(),
        brand_name: externalBrand.trim() || "External",
        image_url: urlData.publicUrl,
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
    if (!emptyRoomUrl || selectedProducts.length === 0) return;
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");

      const placements = selectedProducts.map((p) => ({
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: toAbsoluteUrl(p.image_url),
        rotation: p.rotation || 0,
        dimensions: p.dimensions || null,
      }));

      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: {
          imageUrl: toAbsoluteUrl(emptyRoomUrl),
          referenceImageUrl: toAbsoluteUrl(furnishedImageUrl),
          mode: "proposal_render",
          style,
          placements,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const resultUrl = data.storedUrl || data.imageUrl;
      setProposalHistory((prev) => [...prev, resultUrl]);
      setProposalResult(resultUrl);
      onResult?.({ imageUrl: data.imageUrl, storedUrl: data.storedUrl, text: data.text, pinnedProducts: selectedProducts });
      toast({ title: "Proposal generated successfully" });
    } catch (e: any) {
      toast({ title: "Proposal generation failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const refineProposal = async () => {
    if (!proposalResult || !refinementPrompt.trim()) return;
    setRefining(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");

      const placements = selectedProducts.map((p) => ({
        product_name: p.product_name,
        brand_name: p.brand_name,
      }));

      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: {
          imageUrl: toAbsoluteUrl(proposalResult),
          referenceImageUrl: toAbsoluteUrl(furnishedImageUrl),
          mode: "proposal_refine",
          style,
          placements,
          refinementPrompt: refinementPrompt.trim(),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const resultUrl = data.storedUrl || data.imageUrl;
      setProposalHistory((prev) => [...prev, resultUrl]);
      setProposalResult(resultUrl);
      setRefinementPrompt("");
      onResult?.({ imageUrl: data.imageUrl, storedUrl: data.storedUrl, text: data.text, pinnedProducts: selectedProducts });
      toast({ title: "Proposal refined successfully" });
    } catch (e: any) {
      toast({ title: "Refinement failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setRefining(false);
    }
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
            const formatted = new Intl.NumberFormat("en-SG", {
              style: "currency",
              currency: pricing.currency || "SGD",
              minimumFractionDigits: 0,
            }).format(price / 100);
            desc += `\nPrice: ${formatted}${pricing.trade_price_cents ? " (Trade)" : " (RRP)"}`;
          } else {
            desc += `\nPrice on request`;
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
      }> = [];

      // Slide 1: Cover — Maison Affluency branded with date
      slides.push({
        presentation_id: presId,
        image_url: furnishedImageUrl,
        title: "Maison Affluency",
        description: `Furniture Proposal\n${dateLabel}`,
        sort_order: sortOrder++,
      });

      // Slide 2: Client's original 2D layout — source drawing
      slides.push({
        presentation_id: presId,
        image_url: furnishedImageUrl,
        title: "Client's Original 2D Layout",
        description: "Source drawing provided by client — spatial reference for furniture positioning.",
        sort_order: sortOrder++,
      });

      // Slide 3: Client's 3D rendering (empty room / architectural shell)
      if (emptyRoomUrl) {
        slides.push({
          presentation_id: presId,
          image_url: emptyRoomUrl,
          title: "3D Architectural Rendering",
          description: "Architectural shell with movable furniture removed — blank canvas for proposals.",
          sort_order: sortOrder++,
        });
      }

      // For each proposal iteration: proposal slide → product cards (4/page) → quote
      const proposals = proposalHistory.length > 0 ? proposalHistory : [proposalResult];
      const quoteIds: string[] = [];

      for (let optIdx = 0; optIdx < proposals.length; optIdx++) {
        const optionLabel = proposals.length === 1 ? "Proposal" : `Option ${optIdx + 1}`;

        // Proposal slide
        slides.push({
          presentation_id: presId,
          image_url: proposals[optIdx],
          title: optionLabel,
          description: `AI-generated furniture proposal featuring ${productNames}.`,
          sort_order: sortOrder++,
        });

        // Product specification pages (4 per page)
        const productPages = buildProductPageSlides(selectedProducts, presId, sortOrder, optionLabel);
        slides.push(...productPages);
        sortOrder += productPages.length;

        // Create a separate quote for this option
        try {
          const { data: quote, error: quoteError } = await supabase
            .from("trade_quotes")
            .insert({
              user_id: user.id,
              status: "draft",
              notes: `Auto-generated from Proposal Builder — ${optionLabel} — ${dateLabel}`,
              client_name: "",
            })
            .select("id")
            .single();

          if (!quoteError && quote) {
            quoteIds.push(quote.id);
            for (const product of selectedProducts) {
              try {
                await supabase.rpc("add_gallery_product_to_quote", {
                  _user_id: user.id,
                  _quote_id: quote.id,
                  _product_name: product.product_name,
                  _brand_name: product.brand_name,
                  _image_url: product.image_url,
                  _dimensions: product.dimensions || null,
                  _materials: product.materials || null,
                  _quantity: 1,
                });
              } catch (e) {
                console.warn("Failed to add product to quote:", product.product_name, e);
              }
            }

            // Quote summary slide for this option
            const quoteDesc = selectedProducts.map(p => `• ${p.product_name} — ${p.brand_name}`).join("\n");
            slides.push({
              presentation_id: presId,
              image_url: proposals[optIdx],
              title: `${optionLabel} — Quote Summary`,
              description: `Products:\n${quoteDesc}\n\nQuote Ref: QU-${quote.id.slice(0, 6).toUpperCase()}\nPricing to be confirmed.`,
              sort_order: sortOrder++,
            });
          }
        } catch (e) {
          console.warn("Could not create quote for option", optIdx + 1, e);
        }
      }

      // Insert all slides
      const { error: slidesError } = await supabase.from("presentation_slides").insert(slides);
      if (slidesError) throw slidesError;

      const quoteLabel = quoteIds.length > 1
        ? `${quoteIds.length} quotes created for comparison`
        : quoteIds.length === 1
          ? `Quote QU-${quoteIds[0].slice(0, 6).toUpperCase()} created`
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
  const [sourceMarker, setSourceMarker] = useState<MoveMarker | null>(null);
  const [targetMarker, setTargetMarker] = useState<MoveMarker | null>(null);
  const [moveLabel, setMoveLabel] = useState(""); // optional label for what's being moved
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
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(5, Math.max(0.2, z - e.deltaY * 0.001)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (moveMode) return; // don't pan in move mode
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOffset.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan, moveMode]);

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

  // Handle click-to-place markers on the image
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (!moveMode || !imageElRef.current) return;
    e.stopPropagation();

    // Use the image's natural dimensions and its bounding rect to calculate
    // percentage coordinates that are correct regardless of CSS transforms.
    const rect = imageElRef.current.getBoundingClientRect();

    // getBoundingClientRect already accounts for CSS transforms (scale, rotate, translate),
    // so we can compute the click offset within the *rendered* image directly.
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;

    // When the image is rotated, the bounding-rect axes no longer align with the image axes.
    // We need to "un-rotate" the coordinate so it maps back to the un-rotated image.
    const rad = -(rotation * Math.PI) / 180; // negate to reverse rotation
    const cx = 0.5, cy = 0.5; // center of image in [0..1]
    const dx = rawX - cx;
    const dy = rawY - cy;
    const unrotatedX = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
    const unrotatedY = cy + dx * Math.sin(rad) + dy * Math.cos(rad);

    const xPct = Math.round(Math.max(0, Math.min(100, unrotatedX * 100)));
    const yPct = Math.round(Math.max(0, Math.min(100, unrotatedY * 100)));
    const clamped = { x: xPct, y: yPct };

    if (!sourceMarker) {
      setSourceMarker(clamped);
    } else if (!targetMarker) {
      setTargetMarker(clamped);
      // Auto-fill the refinement prompt
      const label = moveLabel.trim() || "the furniture piece";
      const direction = describeDirection(sourceMarker, clamped);
      setRefinementPrompt(`Move ${label} at position (${sourceMarker.x}%, ${sourceMarker.y}%) to (${clamped.x}%, ${clamped.y}%) — move it ${direction}. Keep everything else exactly the same.`);
    }
  }, [moveMode, sourceMarker, targetMarker, moveLabel, rotation]);

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
          </div>
          <div className="flex items-center gap-1.5">
            {/* Move mode toggle */}
            <Button
              variant={moveMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMoveMode((m) => !m);
                if (moveMode) clearMarkers();
              }}
              title={moveMode ? "Exit move mode" : "Click to reposition furniture"}
              className="gap-1.5"
            >
              <Crosshair className="w-3.5 h-3.5" />
              {moveMode ? "Exit Move" : "Move Furniture"}
            </Button>

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
            <Button variant="outline" size="sm" onClick={downloadProposal}>
              <Download className="w-3.5 h-3.5 mr-1.5" />Download
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
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
              disabled={creatingPresentation || saving}
              className="gap-1.5"
            >
              {creatingPresentation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Create Presentation
            </Button>
            <label className="flex items-center gap-1.5 font-body text-[10px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} className="rounded border-border" />
              Prices
            </label>
            <Button variant="ghost" size="sm" onClick={() => { setExpanded(false); resetTransform(); clearMarkers(); setMoveMode(false); }}>
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

        <div
          ref={imageContainerRef}
          className={`flex-1 overflow-hidden flex items-center justify-center select-none ${moveMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
          onWheel={handleWheel}
          onPointerDown={moveMode ? undefined : handlePointerDown}
          onPointerMove={moveMode ? undefined : handlePointerMove}
          onPointerUp={moveMode ? undefined : handlePointerUp}
        >
          <div
            className="relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
              transition: isPanning.current ? "none" : "transform 0.2s ease",
            }}
            onClick={moveMode ? handleImageClick : undefined}
          >
            <img
              ref={imageElRef}
              src={proposalResult}
              alt="Generated proposal"
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
              draggable={false}
            />
            {/* Floating collapse button on image */}
            {!moveMode && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(false); resetTransform(); clearMarkers(); setMoveMode(false); }}
                className="absolute top-3 right-3 z-20 bg-background/80 backdrop-blur-sm border border-border rounded-full p-2 hover:bg-background transition-colors shadow-lg"
                title="Collapse"
              >
                <Minimize2 className="w-4 h-4 text-foreground" />
              </button>
            )}
            {/* Render markers over image */}
            {sourceMarker && renderMarker(sourceMarker, "source")}
            {targetMarker && renderMarker(targetMarker, "target")}
            {/* Draw line between markers */}
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
          </div>
        </div>
        <div className="p-4 border-t border-border">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input
              value={refinementPrompt}
              onChange={(e) => setRefinementPrompt(e.target.value)}
              placeholder={moveMode ? "Markers will auto-fill this prompt — or type manually" : "Refine: e.g. 'Move the sofa further left', 'Rotate the chair to face the window'…"}
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
              {refining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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
    <div className="space-y-6">
      {/* Hidden file input for external uploads */}
      <input
        ref={externalFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleExternalFile}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-sm text-foreground">Proposal Builder</h2>
            <p className="font-body text-[11px] text-muted-foreground">
              Select replacement products — AI will place them matching the client's original layout
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={generateProposal}
            disabled={generating || !emptyRoomUrl || selectedProducts.length === 0}
          >
            {generating ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
            ) : (
              <><Wand2 className="w-3.5 h-3.5 mr-1.5" />Generate Proposal ({selectedProducts.length})</>
            )}
          </Button>
          {proposalResult && (
            <>
              <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
                <Maximize2 className="w-3.5 h-3.5 mr-1.5" />Expand
              </Button>
              <Button variant="outline" size="sm" onClick={downloadProposal}>
                <Download className="w-3.5 h-3.5 mr-1.5" />Download
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
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
                disabled={creatingPresentation || saving}
                className="gap-1.5"
              >
                {creatingPresentation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
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
            {proposalResult ? "Generated Proposal" : "Empty Room Template"}
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
                <div onClick={(e) => e.stopPropagation()}>
                  <ProductChecklist products={selectedProducts} />
                </div>
              </div>
              {proposalHistory.length > 1 && (
                <p className="font-body text-[10px] text-muted-foreground text-right">
                  Iteration {proposalHistory.length}
                </p>
              )}
              {/* Refinement prompt */}
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
                  {refining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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
          ) : emptyRoomUrl ? (
            <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
              <img src={emptyRoomUrl} alt="Empty room template" className="w-full object-contain" />
            </div>
          ) : emptyRoomGenerating ? (
            <div className="border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <p className="font-body text-xs text-muted-foreground">Generating empty room…</p>
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-lg flex items-center justify-center min-h-[300px]">
              <p className="font-body text-xs text-muted-foreground">Empty room will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected products summary */}
      {selectedProducts.length > 0 && (
        <div className="border border-border rounded-lg p-4">
          <h3 className="font-display text-xs text-foreground mb-3"><h3 className="font-display text-xs text-foreground mb-3">Selected Products ({selectedProducts.length}/10)</h3></h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {selectedProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-muted/30 rounded-md px-2.5 py-2 group">
                {/* Thumbnail with rotation overlay */}
                <div className="relative w-11 h-11 shrink-0">
                  <div
                    className="w-11 h-11 rounded border border-border overflow-hidden bg-background"
                  >
                    <img
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
                <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Picker */}
      <div className="border border-border rounded-lg p-4 space-y-3">
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
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
                className="flex-1 min-w-[100px] border border-border rounded-md px-2 py-1.5 font-body text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
              >
                <option value="">All Categories</option>
                {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {subcategories.length > 0 && (
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="flex-1 min-w-[100px] border border-border rounded-md px-2 py-1.5 font-body text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                >
                  <option value="">All {category}</option>
                  {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="flex-1 min-w-[100px] border border-border rounded-md px-2 py-1.5 font-body text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
              >
                <option value="">All Brands</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    p.image_url &&
                    addProduct({
                      product_name: p.product_name,
                      brand_name: p.brand_name,
                      image_url: p.image_url!,
                      dimensions: p.dimensions,
                      materials: p.materials,
                      pdf_url: p.pdf_url,
                      pdf_urls: p.pdf_urls,
                    })
                  }
                  className="rounded border border-border overflow-hidden text-left transition-all hover:border-foreground/30"
                  title={`${p.product_name} — ${p.brand_name}`}
                >
                  <img src={p.image_url!} alt={p.product_name} className="w-full aspect-square object-cover" />
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
    </div>
  );
}
