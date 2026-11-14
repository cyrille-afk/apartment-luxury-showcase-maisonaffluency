import { downloadDocumentPdf } from "@/lib/appPdfDownload";
import coverLogo from "@/assets/affluency-quote-logo.jpg";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { replacementCandidates, type ReplacementProduct } from "@/lib/specSheetReplacement";
import { retainedSpecItems, specRemovalKey } from "@/lib/specSheetRemoval";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cleanSpecDescription, specClientPriceCents, specDimensions, specFinishes, SPEC_DIMENSIONS_PLACEHOLDER } from "@/lib/specSheetCard";
import { materialSwatchTone } from "@/lib/materialSwatch";
import { currencySymbol, formatPdfDate, formatPdfMoney } from "@/lib/pdfFormatting";
import { AddSpecRoomDialog, SpecRoomAssignmentSelect, SpecRoomFilterBar, SpecRoomSectionHeader } from "@/components/trade/SpecSheetRoomControls";
import {
  groupSpecItems, normalizeSpecRoomName, specRoomBudgetStatus, specRoomName, specRoomNames,
  sumSpecClientTotals, unpricedSpecItemCount, type SpecRoomAssignment, type SpecRoomRecord,
} from "@/lib/specSheetRooms";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { DotCircleLoader, PageLoader } from "@/components/ui/dot-circle-loader";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Check, FileDown, ImageIcon, Search, Upload, X, Replace } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

interface SpecItem {
  item_id: string;
  source_product_id: string;
  replacement_id: string | null;
  product_name: string;
  brand_name: string;
  category: string;
  dimensions: string;
  finish: string;
  finishes: string[];
  description: string;
  image_url: string;
  quantity: number;
  client_price_cents: number | null;
  currency: string;
  project_name: string | null;
  client_name: string | null;
  inherited_room: string | null;
}

type ThemeKey = "mono" | "warm" | "corporate";

const THEMES: Record<ThemeKey, {
  label: string;
  ink: string;
  muted: string;
  accent: string;
  rule: string;
  paper: string;
  heading: string;
  body: string;
  swatch: string[];
}> = {
  mono: {
    label: "Minimalist Monochrome",
    ink: "#111111", muted: "#6b6b6b", accent: "#111111", rule: "#e2e2e2", paper: "#ffffff",
    heading: "'Times New Roman', Georgia, serif",
    body: "Helvetica, Arial, sans-serif",
    swatch: ["#111111", "#6b6b6b", "#e2e2e2"],
  },
  warm: {
    label: "Warm Luxury",
    ink: "#2b241c", muted: "#8a7a66", accent: "#9a7b4f", rule: "#e6ddd0", paper: "#fdfbf7",
    heading: "Georgia, 'Times New Roman', serif",
    body: "Georgia, 'Times New Roman', serif",
    swatch: ["#2b241c", "#9a7b4f", "#e6ddd0"],
  },
  corporate: {
    label: "Corporate Sleek",
    ink: "#0f1f2e", muted: "#5b6b7a", accent: "#1c5d99", rule: "#dde5ec", paper: "#ffffff",
    heading: "Helvetica, Arial, sans-serif",
    body: "Helvetica, Arial, sans-serif",
    swatch: ["#0f1f2e", "#1c5d99", "#dde5ec"],
  },
};

type FieldKey = "brand" | "category" | "dimensions" | "finish" | "description" | "price" | "quantity";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "dimensions", label: "Dimensions" },
  { key: "finish", label: "Finish" },
  { key: "description", label: "Description" },
  { key: "quantity", label: "Quantity" },
  { key: "price", label: "Client price" },
];

interface DeckSettings {
  logoUrl: string;
  projectName: string;
  proposalTitle: string;
  theme: ThemeKey;
  fields: Record<FieldKey, boolean>;
}

const SETTINGS_KEY = "trade-spec-generator-settings-v1";
const DEFAULT_LOGO = "/logo.png";

const DEFAULT_SETTINGS: DeckSettings = {
  logoUrl: DEFAULT_LOGO,
  projectName: "",
  proposalTitle: "Specification Proposal",
  theme: "mono",
  fields: { brand: true, category: true, dimensions: true, finish: true, description: true, quantity: true, price: true },
};

function loadSettings(): DeckSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      fields: { ...DEFAULT_SETTINGS.fields, ...(parsed?.fields || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function amount(cents: number, currency = "EUR") {
  const code = currency.toUpperCase();
  const symbol = code === "USD" ? "$" : currencySymbol(code);
  return `${symbol}${(cents / 100).toLocaleString("en", { maximumFractionDigits: 0 })}`;
}

function money(cents: number | null, currency = "EUR") {
  if (cents == null || cents <= 0) return "Price upon Request";
  return amount(cents, currency);
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TradeSpecSheetGenerator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [replacementItem, setReplacementItem] = useState<SpecItem | null>(null);
  const [savingReplacement, setSavingReplacement] = useState(false);
  const [replacementError, setReplacementError] = useState("");
  const { projectFilter, clearProjectFilter } = useProjectFilter();

  const [settings, setSettings] = useState<DeckSettings>(() => loadSettings());
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [activeRoom, setActiveRoom] = useState("all");
  const [groupByRoom, setGroupByRoom] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [customRoomItem, setCustomRoomItem] = useState<SpecItem | null>(null);
  const [initialised, setInitialised] = useState(false);
  const [removals, setRemovals] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const removalKey = user ? specRemovalKey(user.id, projectFilter) : "";
  const removedIds = removals.key === removalKey ? removals.ids : [];
  useEffect(() => {
    if (!removalKey) return;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(removalKey) || "[]");
      setRemovals({ key: removalKey, ids: Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [] });
    } catch { setRemovals({ key: removalKey, ids: [] }); }
  }, [removalKey]);
  const saveRemovals = (ids: string[]) => {
    setRemovals({ key: removalKey, ids });
    try { localStorage.setItem(removalKey, JSON.stringify(ids)); } catch { /* current page still updates */ }
  };

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  const patch = (next: Partial<DeckSettings>) => setSettings((s) => ({ ...s, ...next }));
  const toggleField = (key: FieldKey) =>
    setSettings((s) => ({ ...s, fields: { ...s.fields, [key]: !s.fields[key] } }));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["spec-generator-items", user?.id, projectFilter],
    queryFn: async (): Promise<SpecItem[]> => {
      if (!user) return [];
      let qq = supabase
        .from("trade_quotes")
        .select("id, client_name, status, project_id, project_board_id")
        .eq("user_id", user.id)
        .in("status", ["draft", "confirmed", "submitted", "responded", "priced", "deposit_paid", "paid"]);
      if (projectFilter) qq = qq.eq("project_id", projectFilter);
      const { data: quotes } = await qq;
      if (!quotes?.length) return [];

      const quoteIds = quotes.map((q: any) => q.id);
      const { data: qItems } = await supabase
        .from("trade_quote_items")
        .select("id, product_id, quantity, unit_price_cents, quote_id")
        .in("quote_id", quoteIds);
      if (!qItems?.length) return [];

      const { data: replacements, error: replacementReadError } = await supabase.from("spec_sheet_catalogue_replacements")
        .select("source_product_id, replacement_product_id").eq("user_id", user.id);
      if (replacementReadError) throw replacementReadError;
      const replacementMap = Object.fromEntries((replacements || []).map(r => [r.source_product_id, r.replacement_product_id]));
      const productIds = [...new Set([...qItems.map(i => i.product_id), ...Object.values(replacementMap)])];
      const { data: products } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, category, currency, dimensions, width_mm, depth_mm, height_mm, size_variants, default_variant_label, description, materials_description, meta_description, materials, image_url, gallery_images, available_finishes, rrp_price_cents")
        .in("id", productIds);

      const projectIds = [...new Set(quotes.map((q: any) => q.project_id).filter(Boolean))] as string[];
      const { data: projects } = projectIds.length
        ? await supabase.from("projects" as any).select("id, name").in("id", projectIds)
        : { data: [] as any[] };

      const productMap = Object.fromEntries(((products as any[]) || []).map((p: any) => [p.id, p]));
      const quoteMap = Object.fromEntries((quotes as any[]).map((q: any) => [q.id, q]));
      const projectMap = Object.fromEntries((((projects as any[]) || [])).map((p: any) => [p.id, p.name]));

      const { data: boardLinks, error: boardLinkError } = await supabase
        .from("client_board_items")
        .select("source_quote_item_id, subfolder, board_id")
        .in("source_quote_item_id", qItems.map((item: any) => item.id));
      if (boardLinkError) throw boardLinkError;
      const boardIds = [...new Set((boardLinks || []).map(link => link.board_id))];
      const { data: boards, error: boardError } = boardIds.length
        ? await supabase.from("client_boards").select("id, title, project_id").in("id", boardIds)
        : { data: [] as { id: string; title: string; project_id: string | null }[], error: null };
      if (boardError) throw boardError;
      const boardMap = new Map((boards || []).map(board => [board.id, board]));
      const inheritedRooms = new Map<string, string>();
      for (const quoteItem of qItems as any[]) {
        const quote = quoteMap[quoteItem.quote_id];
        const candidates = (boardLinks || [])
          .filter(link => link.source_quote_item_id === quoteItem.id)
          .map(link => ({ link, board: boardMap.get(link.board_id) }))
          .filter((entry): entry is { link: any; board: { id: string; title: string; project_id: string | null } } => !!entry.board && entry.board.project_id === quote?.project_id)
          .sort((a, b) => Number(b.board.id === quote?.project_board_id) - Number(a.board.id === quote?.project_board_id));
        const inherited = candidates[0];
        const room = normalizeSpecRoomName(inherited?.link.subfolder) || normalizeSpecRoomName(inherited?.board.title);
        if (room) inheritedRooms.set(quoteItem.id, room);
      }

      const seen = new Set<string>();
      const rows: SpecItem[] = [];
      for (const item of qItems as any[]) {
        const replacementId = replacementMap[item.product_id];
        const p: any = productMap[replacementId] || productMap[item.product_id];
        if (!p) continue;
        if (seen.has(item.product_id)) continue;
        seen.add(item.product_id);
        const q: any = quoteMap[item.quote_id];
        rows.push({
          item_id: item.id,
          source_product_id: item.product_id,
          replacement_id: replacementId && productMap[replacementId] ? replacementId : null,
          product_name: p.product_name || "Unknown item",
          brand_name: p.brand_name || "",
          category: p.category || "",
          dimensions: specDimensions(p),
          finishes: specFinishes(p),
          finish: specFinishes(p).join(" / "),
          description: cleanSpecDescription(p),
          image_url: p.image_url || p.gallery_images?.[0] || "",
          quantity: item.quantity || 1,
          client_price_cents: specClientPriceCents(p, replacementId ? null : item.unit_price_cents),
          currency: p.currency || "EUR",
          project_name: q?.project_id ? projectMap[q.project_id] || null : null,
          client_name: q?.client_name || null,
          inherited_room: inheritedRooms.get(item.id) || null,
        });
      }
      return rows;
    },
    enabled: !!user,
  });

  const roomScope = projectFilter || "all";
  useEffect(() => { setActiveRoom("all"); }, [roomScope]);
  const { data: roomState = { rooms: [], assignments: [] } } = useQuery<{
    rooms: SpecRoomRecord[];
    assignments: SpecRoomAssignment[];
  }>({
    queryKey: ["spec-sheet-rooms", user?.id, roomScope],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { rooms: [], assignments: [] };
      let roomQuery = supabase.from("spec_sheet_rooms")
        .select("id, name, project_id, budget_cents, currency, position")
        .eq("user_id", user.id)
        .order("position")
        .order("name");
      roomQuery = projectFilter ? roomQuery.eq("project_id", projectFilter) : roomQuery.is("project_id", null);
      const { data: rooms, error: roomError } = await roomQuery;
      if (roomError) throw roomError;
      const roomIds = (rooms || []).map(room => room.id);
      const { data: assignments, error: assignmentError } = roomIds.length
        ? await supabase.from("spec_sheet_item_rooms").select("quote_item_id, room_id").eq("user_id", user.id).in("room_id", roomIds)
        : { data: [] as SpecRoomAssignment[], error: null };
      if (assignmentError) throw assignmentError;
      return { rooms: (rooms || []) as SpecRoomRecord[], assignments: assignments || [] };
    },
  });
  const rooms = roomState.rooms;
  const assignments = roomState.assignments;

  const { data: candidates = [], isFetching: loadingCandidates, error: candidateError } = useQuery({
    queryKey: ["spec-replacement-candidates", user?.id, replacementItem?.source_product_id],
    enabled: !!user && !!replacementItem,
    queryFn: async () => {
      if (!replacementItem) return [];
      const { data, error } = await supabase.from("trade_products")
        .select("id, product_name, brand_name, category, currency, description, materials_description, meta_description, materials, size_variants, default_variant_label, available_finishes, rrp_price_cents, is_active, is_hidden")
        .ilike("product_name", `%${replacementItem.product_name.trim().replace(/[%_]/g, '')}%`);
      if (error) throw error;
      const products: ReplacementProduct[] = (data || []).map(p => ({
        ...p,
        size_variants: Array.isArray(p.size_variants) ? p.size_variants.flatMap(v => {
          if (!v || typeof v !== "object" || Array.isArray(v)) return [];
          return [{ label: typeof v.label === "string" ? v.label : null,
            base: typeof v.base === "string" ? v.base : null, top: typeof v.top === "string" ? v.top : null,
            price_cents: typeof v.price_cents === "number" ? v.price_cents : null }];
        }) : [],
      }));
      return replacementCandidates({ id: replacementItem.source_product_id, product_name: replacementItem.product_name, category: replacementItem.category }, products);
    },
  });

  const saveReplacement = async (candidate: ReplacementProduct | null) => {
    if (!user || !replacementItem || savingReplacement) return;
    setSavingReplacement(true);
    setReplacementError("");
    try {
      const result = candidate
        ? await supabase.from("spec_sheet_catalogue_replacements").upsert({ user_id: user.id, source_product_id: replacementItem.source_product_id, replacement_product_id: candidate.id })
        : await supabase.from("spec_sheet_catalogue_replacements").delete().eq("user_id", user.id).eq("source_product_id", replacementItem.source_product_id);
      if (result.error) throw result.error;
      await queryClient.invalidateQueries({ queryKey: ["spec-generator-items", user.id] });
      setReplacementItem(null);
      toast({ title: candidate ? "Complete catalogue record saved" : "Original record restored" });
    } catch {
      setReplacementError("The replacement could not be saved. Please try again.");
    } finally {
      setSavingReplacement(false);
    }
  };

  const refreshRooms = () => user
    ? queryClient.invalidateQueries({ queryKey: ["spec-sheet-rooms", user.id, roomScope] })
    : Promise.resolve();

  const ensureRoom = async (name: string): Promise<SpecRoomRecord | null> => {
    if (!user) return null;
    const normalized = normalizeSpecRoomName(name);
    const existing = rooms.find(room => room.name.toLocaleLowerCase() === normalized.toLocaleLowerCase());
    if (existing) return existing;
    const { data, error } = await supabase.from("spec_sheet_rooms").insert({
      user_id: user.id,
      project_id: projectFilter || null,
      name: normalized,
      currency: items[0]?.currency || "EUR",
      position: rooms.length,
    }).select("id, name, project_id, budget_cents, currency, position").single();
    if (error) throw error;
    return data as SpecRoomRecord;
  };

  const saveAssignment = async (item: SpecItem, room: SpecRoomRecord) => {
    if (!user) return;
    const { error } = await supabase.from("spec_sheet_item_rooms").upsert({
      user_id: user.id,
      quote_item_id: item.item_id,
      room_id: room.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,quote_item_id" });
    if (error) throw error;
  };

  const changeItemRoom = async (item: SpecItem, name: string) => {
    if (name === specRoomName(item, assignments, rooms)) return;
    try {
      const room = await ensureRoom(name);
      if (!room) return;
      await saveAssignment(item, room);
      await refreshRooms();
      toast({ title: `${item.product_name} moved to ${room.name}` });
    } catch {
      toast({ title: "Room assignment could not be saved", description: "Please try again.", variant: "destructive" });
    }
  };

  const saveRoomFromDialog = async (name: string) => {
    try {
      const room = await ensureRoom(name);
      if (!room) return false;
      if (customRoomItem) await saveAssignment(customRoomItem, room);
      else setActiveRoom(room.name);
      await refreshRooms();
      return true;
    } catch {
      return false;
    }
  };

  const updateRoomBudget = async (roomName: string, cents: number | null, currency: string) => {
    try {
      const room = await ensureRoom(roomName);
      if (!room || !user) return;
      const { error } = await supabase.from("spec_sheet_rooms").update({
        budget_cents: cents,
        currency,
        updated_at: new Date().toISOString(),
      }).eq("id", room.id).eq("user_id", user.id);
      if (error) throw error;
      await refreshRooms();
    } catch {
      toast({ title: "Room budget could not be saved", description: "Please try again.", variant: "destructive" });
    }
  };

  // Select every item the first time the catalog loads.
  useEffect(() => {
    if (initialised || !items.length) return;
    setSelected(Object.fromEntries(items.map((i) => [i.item_id, true])));
    setInitialised(true);
  }, [items, initialised]);

  const sheetItems = useMemo(() => retainedSpecItems(items, removedIds), [items, removedIds]);
  const roomFor = useMemo(() => (item: SpecItem) => specRoomName(item, assignments, rooms), [assignments, rooms]);
  const roomNames = useMemo(() => specRoomNames(sheetItems, rooms, assignments), [sheetItems, rooms, assignments]);
  const searchItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sheetItems;
    return sheetItems.filter((i) =>
      [i.product_name, i.brand_name, i.category, i.dimensions, i.finish, i.project_name, i.client_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [sheetItems, search]);
  const roomCounts = useMemo(() => Object.fromEntries(roomNames.map(name => [name, searchItems.filter(item => roomFor(item) === name).length])), [roomNames, searchItems, roomFor]);
  const visibleItems = useMemo(() => activeRoom === "all" ? searchItems : searchItems.filter(item => roomFor(item) === activeRoom), [activeRoom, searchItems, roomFor]);
  const visibleRoomGroups = useMemo(() => groupSpecItems(visibleItems, roomNames, roomFor), [visibleItems, roomNames, roomFor]);

  const chosen = useMemo(() => sheetItems.filter((i) => selected[i.item_id]), [sheetItems, selected]);
  const chosenTotals = useMemo(() => sumSpecClientTotals(chosen), [chosen]);
  const currency = items[0]?.currency || "EUR";
  const roomRecord = (name: string) => rooms.find(room => room.name === name);

  const toggleItem = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const selectAll = () => setSelected(Object.fromEntries(visibleItems.map((i) => [i.item_id, true])));
  const clearAll = () => setSelected({});

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_500_000) {
      toast({ title: "Logo too large", description: "Please use an image under 1.5 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ logoUrl: String(reader.result || "") });
    reader.readAsDataURL(file);
  };

  /* ---------------- PDF / print export ---------------- */

  const exportPdf = () => {
    if (!chosen.length) {
      toast({ title: "Nothing selected", description: "Tick at least one item to include in the deck." });
      return;
    }
    const t = THEMES[settings.theme];
    const f = settings.fields;
    const today = formatPdfDate(new Date());
    const title = settings.proposalTitle.trim() || "Specification Proposal";
    const project = settings.projectName.trim() || chosen[0]?.project_name || "";

    const row = (label: string, value: string) =>
      value
        ? `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
        : "";
    const pdfMoney = (cents: number, currencyCode: string) => formatPdfMoney(cents, currencyCode);

    const productSheet = (i: SpecItem) => `
      <section class="sheet">
        <div class="sheet-img">${
          i.image_url
            ? `<img src="${escapeHtml(i.image_url)}" alt="${escapeHtml(i.product_name)}" />`
            : `<div class="noimg">No image</div>`
        }</div>
        <div class="sheet-body">
          <h2>${escapeHtml(i.product_name)}</h2>
          ${f.brand && i.brand_name ? `<p class="brand">${escapeHtml(i.brand_name)}</p>` : ""}
          <table class="meta">
            ${f.category ? row("Category", i.category) : ""}
            ${f.dimensions ? row("Dimensions", i.dimensions) : ""}
            ${f.finish ? row("Finish", i.finish) : ""}
            ${f.quantity ? row("Quantity", String(i.quantity)) : ""}
            ${f.price ? row("Client price", i.client_price_cents == null ? "Price upon Request" : pdfMoney(i.client_price_cents, i.currency)) : ""}
          </table>
          ${f.description && i.description ? `<p class="desc">${escapeHtml(i.description)}</p>` : ""}
        </div>
      </section>`;

    const exportGroups = groupSpecItems(chosen, roomNames, roomFor);
    const sheets = exportGroups.map((group, roomIndex) => {
      const totals = sumSpecClientTotals(group.items);
      const unpriced = unpricedSpecItemCount(group.items);
      const room = roomRecord(group.name);
      const budgetStatus = specRoomBudgetStatus(totals, room?.budget_cents, room?.currency || currency);
      return `
        <section class="room-divider${roomIndex === 0 ? " first" : ""}">
          <p class="room-number">Room ${String(roomIndex + 1).padStart(2, "0")} / ${String(exportGroups.length).padStart(2, "0")}</p>
          <h1>${escapeHtml(group.name)}</h1>
          <div class="room-rule"></div>
          <p class="room-count">${group.items.length} selected item${group.items.length === 1 ? "" : "s"}</p>
        </section>
        <div class="room-items">${group.items.map(productSheet).join("")}</div>
        <section class="room-total">
          <div><p class="eyebrow">Room subtotal</p><h3>${escapeHtml(group.name)}</h3></div>
          <div class="room-total-values">
            ${f.price ? `<p class="subtotal">${totals.length ? totals.map(total => escapeHtml(pdfMoney(total.cents, total.currency))).join(" · ") : "Price upon Request"}</p>` : ""}
            ${f.price && room?.budget_cents != null ? `<p>Room budget: ${escapeHtml(pdfMoney(room.budget_cents, room.currency))}</p>` : ""}
            ${f.price && budgetStatus ? `<p class="budget-status">${escapeHtml(pdfMoney(budgetStatus.cents, room?.currency || currency))} ${budgetStatus.kind === "over" ? "over budget" : "remaining"}</p>` : ""}
            ${unpriced ? `<p>${unpriced} item${unpriced === 1 ? "" : "s"} priced on request</p>` : ""}
          </div>
        </section>`;
    }).join("");

    const summaryRows = exportGroups.map(group => {
      const totals = sumSpecClientTotals(group.items);
      const room = roomRecord(group.name);
      return `<tr><th>${escapeHtml(group.name)}<span>${group.items.length} item${group.items.length === 1 ? "" : "s"}</span></th><td>${f.price ? escapeHtml(totals.map(total => pdfMoney(total.cents, total.currency)).join(" · ") || "Price upon Request") : ""}${f.price && room?.budget_cents != null ? `<small>Budget ${escapeHtml(pdfMoney(room.budget_cents, room.currency))}</small>` : ""}</td></tr>`;
    }).join("");
    const projectSummary = `<section class="project-summary">
      <p class="eyebrow">Project Summary</p>
      <h1>${escapeHtml(project || title)}</h1>
      <p class="summary-intro">${chosen.length} selected item${chosen.length === 1 ? "" : "s"} across ${exportGroups.length} room${exportGroups.length === 1 ? "" : "s"}</p>
      <table class="summary-table">${summaryRows}</table>
      ${f.price ? `<div class="grand-total"><p class="eyebrow">Project client total</p><p>${chosenTotals.length ? chosenTotals.map(total => escapeHtml(pdfMoney(total.cents, total.currency))).join(" · ") : "Price upon Request"}</p></div>` : ""}
      <p class="summary-note">Client retail presentation only. Supplier costs and studio margins are not included.</p>
    </section>`;

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin:0; background:${t.paper}; color:${t.ink}; font-family:${t.body}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .cover { height: 247mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; page-break-after:always; break-after:page; }
  .cover img { max-height: 26mm; max-width: 70mm; object-fit:contain; margin-bottom: 18mm; }
  .cover h1 { font-family:${t.heading}; font-size: 30pt; font-weight:400; letter-spacing:.02em; margin:0 0 6mm; }
  .cover .project { font-size: 12pt; letter-spacing:.28em; text-transform:uppercase; color:${t.accent}; margin:0 0 14mm; }
  .cover .rule { width: 40mm; height:1px; background:${t.accent}; margin: 0 0 14mm; }
  .cover .date { font-size: 9pt; letter-spacing:.2em; text-transform:uppercase; color:${t.muted}; }
  .sheet { display:flex; gap: 10mm; align-items:flex-start; padding: 8mm 0; border-bottom:1px solid ${t.rule};
           page-break-inside: avoid; break-inside: avoid; }
  .sheet-img { width: 74mm; flex: 0 0 74mm; }
  .sheet-img img { width:100%; height: 62mm; object-fit:cover; display:block; background:#f3f3f3; }
  .noimg { width:100%; height:62mm; background:#f3f3f3; color:${t.muted}; font-size:8pt; letter-spacing:.2em;
           text-transform:uppercase; display:flex; align-items:center; justify-content:center; }
  .sheet-body { flex:1 1 auto; }
  .sheet-body h2 { font-family:${t.heading}; font-weight:400; font-size: 16pt; margin:0 0 2mm; }
  .brand { margin:0 0 4mm; font-size: 8pt; letter-spacing:.26em; text-transform:uppercase; color:${t.accent}; }
  table.meta { width:100%; border-collapse:collapse; margin-bottom: 4mm; }
  table.meta th { text-align:left; width: 30mm; padding: 1.4mm 0; font-size: 7.5pt; font-weight:400;
                  letter-spacing:.18em; text-transform:uppercase; color:${t.muted}; vertical-align:top; }
  table.meta td { padding: 1.4mm 0; font-size: 9.5pt; color:${t.ink}; }
  .desc { font-size: 9pt; line-height: 1.55; color:${t.ink}; text-align: justify; margin: 0; }
  .room-divider { height:247mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; break-before:page; page-break-before:always; break-after:page; page-break-after:always; break-inside:avoid; }
  .room-divider.first { break-before:auto; page-break-before:auto; }
  .room-number,.eyebrow { margin:0 0 6mm; font-size:8pt; letter-spacing:.28em; text-transform:uppercase; color:${t.accent}; }
  .room-divider h1,.project-summary h1 { margin:0; font-family:${t.heading}; font-size:34pt; font-weight:400; line-height:1.12; }
  .room-rule { width:34mm; height:1px; margin:12mm 0; background:${t.accent}; }
  .room-count,.summary-intro { margin:0; font-size:10pt; letter-spacing:.12em; color:${t.muted}; }
  .room-total { display:flex; justify-content:space-between; gap:10mm; align-items:flex-start; margin:8mm 0 0; padding:7mm 0; border-top:1px solid ${t.accent}; border-bottom:1px solid ${t.rule}; break-inside:avoid; page-break-inside:avoid; }
  .room-total h3 { margin:0; font-family:${t.heading}; font-size:17pt; font-weight:400; }
  .room-total-values { text-align:right; font-size:8.5pt; line-height:1.7; color:${t.muted}; }
  .room-total-values p { margin:0; }
  .room-total-values .subtotal { font-family:${t.heading}; font-size:17pt; color:${t.ink}; }
  .room-total-values .budget-status { color:${t.accent}; }
  .project-summary { min-height:247mm; padding-top:18mm; break-before:page; page-break-before:always; }
  .project-summary h1 { font-size:28pt; margin-bottom:4mm; }
  .summary-intro { margin-bottom:14mm; }
  .summary-table { width:100%; border-collapse:collapse; }
  .summary-table tr { break-inside:avoid; page-break-inside:avoid; }
  .summary-table th,.summary-table td { padding:5mm 0; border-bottom:1px solid ${t.rule}; text-align:left; vertical-align:top; }
  .summary-table th { font-family:${t.heading}; font-size:13pt; font-weight:400; }
  .summary-table th span { display:block; margin-top:1.5mm; font-family:${t.body}; font-size:8pt; color:${t.muted}; }
  .summary-table td { text-align:right; font-size:10pt; }
  .summary-table td small { display:block; margin-top:1.5mm; color:${t.muted}; font-size:8pt; }
  .grand-total { display:flex; justify-content:space-between; align-items:flex-start; gap:10mm; padding:8mm 0; border-bottom:1px solid ${t.accent}; break-inside:avoid; }
  .grand-total p { margin:0; }
  .grand-total p:last-child { font-family:${t.heading}; font-size:20pt; text-align:right; }
  .summary-note { margin-top:10mm; font-size:8pt; line-height:1.6; color:${t.muted}; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 7pt; letter-spacing:.2em;
           text-transform:uppercase; color:${t.muted}; text-align:center; }
</style></head><body>
  <div class="cover">
    ${settings.logoUrl ? `<img src="${escapeHtml(settings.logoUrl === DEFAULT_LOGO ? coverLogo : settings.logoUrl)}" alt="Logo" />` : ""}
    <h1>${escapeHtml(title)}</h1>
    ${project ? `<p class="project">${escapeHtml(project)}</p>` : ""}
    <div class="rule"></div>
    <p class="date">${escapeHtml(today)}</p>
  </div>
  ${sheets}
  ${projectSummary}
</body></html>`;

    void downloadDocumentPdf({ html, filename: `${title}.pdf`, marginMm: 16 });
  };

  const renderRoomHeader = (name: string) => {
    const selectedInRoom = chosen.filter(item => roomFor(item) === name);
    const totals = sumSpecClientTotals(selectedInRoom);
    const room = roomRecord(name);
    return <SpecRoomSectionHeader
      name={name}
      selectedCount={selectedInRoom.length}
      totals={totals}
      unpricedCount={unpricedSpecItemCount(selectedInRoom)}
      budgetCents={room?.budget_cents ?? null}
      budgetCurrency={room?.currency || (totals.length === 1 ? totals[0].currency : currency)}
      onBudgetChange={(cents, budgetCurrency) => updateRoomBudget(name, cents, budgetCurrency)}
      formatMoney={amount}
    />;
  };

  const renderCard = (i: SpecItem) => {
    const isOn = !!selected[i.item_id];
    const itemRoom = roomFor(i);
    return <div key={i.item_id} className="relative">
      <div
        onClick={() => toggleItem(i.item_id)}
        className={cn(
          "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-left transition-all duration-200",
          isOn ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/30",
        )}
      >
        <button
          type="button"
          aria-label={`${isOn ? "Exclude" : "Include"} ${i.product_name}`}
          aria-pressed={isOn}
          onClick={event => { event.stopPropagation(); toggleItem(i.item_id); }}
          className={cn(
            "absolute right-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200",
            isOn ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/90 text-transparent",
          )}
        ><Check className="h-3.5 w-3.5" /></button>
        <div className="aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
          {i.image_url ? <img src={i.image_url} alt={i.product_name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>}
        </div>
        <div className="flex flex-1 flex-col p-3">
          {settings.fields.brand && <p className="h-4 truncate font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{i.brand_name || "\u00a0"}</p>}
          <p className="mt-1.5 h-5 truncate font-display text-sm text-foreground">{i.product_name}</p>
          {settings.fields.category && <p className="mt-1 h-4 truncate font-body text-xs text-muted-foreground">{i.category || "\u00a0"}</p>}
          {settings.fields.dimensions && <p className={cn("mt-1.5 h-4 truncate font-body text-xs", i.dimensions === SPEC_DIMENSIONS_PLACEHOLDER ? "italic text-muted-foreground/60" : "text-muted-foreground")}>{i.dimensions}</p>}
          {settings.fields.finish && <div className="mt-1.5 flex h-4 min-w-0 items-center gap-1.5">
            {i.finishes.slice(0, 3).map(finish => <span key={finish} className="h-3 w-3 shrink-0 rounded-full border border-border" style={{ background: materialSwatchTone(finish).css }} aria-hidden />)}
            <span className={cn("truncate font-body text-xs", i.finish ? "text-muted-foreground" : "italic text-muted-foreground/60")}>{i.finish || "Finish on request"}</span>
          </div>}
          {settings.fields.description && <p className="mt-1.5 line-clamp-2 h-8 font-body text-xs leading-4 text-muted-foreground">{i.description}</p>}
          <SpecRoomAssignmentSelect value={itemRoom} roomNames={roomNames} productName={i.product_name} onChange={name => void changeItemRoom(i, name)} onCustomRoom={() => { setCustomRoomItem(i); setAddRoomOpen(true); }} />
          <div className="mt-auto flex items-center justify-between pt-3">
            {settings.fields.quantity ? <span className="font-body text-[11px] uppercase tracking-widest text-muted-foreground">Qty {i.quantity}</span> : <span />}
            {settings.fields.price && <span className="font-body text-sm text-foreground">{money(i.client_price_cents, i.currency)}</span>}
          </div>
        </div>
      </div>
      <Button variant="outline" size="icon" title="Replace catalogue record" aria-label={`Replace catalogue record for ${i.product_name.trim()}`} className="absolute left-2 top-2 z-10 h-7 w-7 bg-background/90" onClick={event => { event.stopPropagation(); setReplacementError(""); setReplacementItem(i); }}><Replace className="h-3.5 w-3.5" /></Button>
      <Button variant="outline" size="icon" title="Remove from sheet" aria-label={`Remove ${i.product_name.trim()} from sheet`} className="absolute right-10 top-2 z-10 h-7 w-7 bg-background/90" onClick={event => { event.stopPropagation(); saveRemovals([...removedIds, i.item_id]); }}><X className="h-3.5 w-3.5" /></Button>
    </div>;
  };

  /* ---------------- Render ---------------- */

  return (
    <div className="mx-auto w-[92%] max-w-[1800px] space-y-6">
      <Helmet>
        <title>Specification Sheet Generator | Maison Affluency</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <TradeBreadcrumb />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-wide text-foreground">Specification Sheet Generator</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Curate project items and export a branded client pitch — supplier costs never leave the studio.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {projectFilter && (
            <Button variant="ghost" size="sm" className="font-body text-xs" onClick={clearProjectFilter}>
              <X className="mr-1 h-3 w-3" /> Clear project filter
            </Button>
          )}
          <Button onClick={exportPdf} className="font-body text-xs uppercase tracking-widest">
            <FileDown className="mr-2 h-4 w-4" />
            Export Branded Pitch PDF ({chosen.length})
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* -------- Catalog grid -------- */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items, brands, categories…"
                className="pl-9 font-body text-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="font-body text-xs" onClick={selectAll}>Select all</Button>
            <Button variant="ghost" size="sm" className="font-body text-xs" onClick={clearAll}>Clear</Button>
            {removedIds.length > 0 && <Button variant="ghost" size="sm" onClick={() => saveRemovals([])}>Restore removed ({removedIds.length})</Button>}
            <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              {chosen.length} of {sheetItems.length} selected
            </span>
          </div>

          <SpecRoomFilterBar
            roomNames={roomNames}
            counts={roomCounts}
            totalCount={searchItems.length}
            activeRoom={activeRoom}
            onRoomChange={setActiveRoom}
            onAddRoom={() => { setCustomRoomItem(null); setAddRoomOpen(true); }}
            groupByRoom={groupByRoom}
            onGroupChange={setGroupByRoom}
          />

          {isLoading ? (
            <PageLoader />
          ) : sheetItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center font-body text-sm text-muted-foreground">
              No project items found. Add products to a quote to build a presentation deck.
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center font-body text-sm text-muted-foreground">
              No items match this room and search. Choose another filter or add an item to this room.
            </div>
          ) : groupByRoom || activeRoom !== "all" ? (
            <div className="space-y-8">
              {visibleRoomGroups.map(group => <section key={group.name} className="space-y-4">
                {renderRoomHeader(group.name)}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{group.items.map(renderCard)}</div>
              </section>)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{visibleItems.map(renderCard)}</div>
          )}
        </section>

        {/* -------- Customizer sidebar -------- */}
        <aside className="h-fit space-y-6 rounded-lg border border-border bg-card p-5 xl:sticky xl:top-6">
          <div>
            <h2 className="font-body text-xs uppercase tracking-[0.22em] text-muted-foreground">Header &amp; branding</h2>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded border border-border bg-background">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Deck logo" className="max-h-12 max-w-[72px] object-contain" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logo-upload" className="inline-flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-1.5 font-body text-xs hover:bg-muted">
                    <Upload className="h-3.5 w-3.5" /> Upload logo
                  </Label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onLogoFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ logoUrl: DEFAULT_LOGO })}
                    className="block font-body text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Use Maison Affluency logo
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-name" className="font-body text-xs text-muted-foreground">Project name</Label>
                <Input
                  id="project-name"
                  value={settings.projectName}
                  onChange={(e) => patch({ projectName: e.target.value })}
                  placeholder="e.g. Villa Alix — Ground Floor"
                  className="font-body text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proposal-title" className="font-body text-xs text-muted-foreground">Proposal title</Label>
                <Input
                  id="proposal-title"
                  value={settings.proposalTitle}
                  onChange={(e) => patch({ proposalTitle: e.target.value })}
                  placeholder="Specification Proposal"
                  className="font-body text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h2 className="font-body text-xs uppercase tracking-[0.22em] text-muted-foreground">Typography &amp; theme</h2>
            <div className="mt-3 space-y-3">
              <Select value={settings.theme} onValueChange={(v) => patch({ theme: v as ThemeKey })}>
                <SelectTrigger className="font-body text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                    <SelectItem key={k} value={k} className="font-body text-sm">{THEMES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                {THEMES[settings.theme].swatch.map((c) => (
                  <span key={c} className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: c }} />
                ))}
                <span className="font-body text-[11px] text-muted-foreground">Deck palette</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h2 className="font-body text-xs uppercase tracking-[0.22em] text-muted-foreground">Information shown</h2>
            <div className="mt-3 space-y-2.5">
              {FIELDS.map((field) => (
                <label key={field.key} className="flex cursor-pointer items-center gap-2.5 font-body text-sm text-foreground">
                  <Checkbox checked={settings.fields[field.key]} onCheckedChange={() => toggleField(field.key)} />
                  {field.label}
                </label>
              ))}
            </div>
            <p className="mt-3 font-body text-[11px] leading-relaxed text-muted-foreground">
              Supplier costs and studio margins are never included in the exported deck.
            </p>
          </div>

          <Button onClick={exportPdf} className="w-full font-body text-xs uppercase tracking-widest">
            <FileDown className="mr-2 h-4 w-4" /> Export Branded Pitch PDF
          </Button>
          <p className="text-center font-body text-[11px] text-muted-foreground">
            {chosen.length} item{chosen.length === 1 ? "" : "s"} · {chosenTotals.length ? chosenTotals.map(total => money(total.cents, total.currency)).join(" · ") : "Price upon Request"}
          </p>
        </aside>
      </div>
      <AddSpecRoomDialog open={addRoomOpen} onOpenChange={open => { setAddRoomOpen(open); if (!open) setCustomRoomItem(null); }} onSave={saveRoomFromDialog} />
      <Dialog open={!!replacementItem} onOpenChange={(open) => { if (!open && !savingReplacement) setReplacementItem(null); }}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Replace catalogue record</DialogTitle>
            <DialogDescription>{replacementItem?.product_name} — use complete specifications and catalogue prices in this sheet and its PDF. Saved quotes and quantities remain unchanged.</DialogDescription>
          </DialogHeader>
          {loadingCandidates ? <DotCircleLoader /> : candidateError ? <p className="text-sm text-destructive">Catalogue records could not be loaded. Close and try again.</p> : candidates.length === 0 ? <p className="text-sm text-muted-foreground">No complete matching catalogue record is available.</p> : candidates.map(p => (
            <div key={p.id} className="space-y-3 border-t border-border pt-4">
              <p className="font-display text-lg">{p.brand_name}</p>
              <p className="text-sm text-muted-foreground">{specDimensions(p)}</p>
              <p className="text-sm">{specFinishes(p).join(" / ")}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{cleanSpecDescription(p)}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{money(specClientPriceCents(p), p.currency || "EUR")}</span>
                <Button disabled={savingReplacement || replacementItem?.replacement_id === p.id} onClick={() => saveReplacement(p)}>
                  <Replace className="mr-2 h-4 w-4" />{replacementItem?.replacement_id === p.id ? "Current record" : "Use this record"}
                </Button>
              </div>
            </div>
          ))}
          {replacementItem?.replacement_id && <Button variant="outline" disabled={savingReplacement} onClick={() => saveReplacement(null)}>Restore original record</Button>}
          <p role="alert" className="min-h-5 text-sm text-destructive">{replacementError}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
