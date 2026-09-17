import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, FileText, Package, Paperclip, ReceiptText } from "lucide-react";
import { autoPoNumber } from "@/lib/procurementExcel";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface QuoteLineDrawerItem {
  item_id: string;
  quote_id: string;
  quote_ref: string;
  product_name: string;
  brand_name: string;
  quantity: number;
  client_name?: string | null;
  project_name?: string | null;
  po_number?: string | null;
  cost_code?: string | null;
  lead_time?: string | null;
  lead_time_weeks_override?: number | null;
  required_by_date?: string | null;
  dimensions?: string | null;
  materials?: string | null;
  sku?: string | null;
  stage?: string | null;
  /** Slack in days before this edit — used to detect an Amber -> Red escalation. */
  slack?: number | null;
  /** Expected-ready date before this edit. */
  expected?: Date | string | null;
}

interface QuoteLineDrawerProps {
  item: QuoteLineDrawerItem | null;
  onOpenChange: (open: boolean) => void;
}

const stageLabel = (stage?: string | null) =>
  stage ? stage.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()) : "Not started";

export default function QuoteLineDrawer({ item, onOpenChange }: QuoteLineDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [poNumber, setPoNumber] = useState("");
  const [costCode, setCostCode] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [leadWeeks, setLeadWeeks] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingPo, setGeneratingPo] = useState(false);

  /**
   * Generate and persist a PO reference for this line, matching the
   * `{quoteRef}-NNN` sequence used across the procurement workbook.
   */
  const generatePoReference = async () => {
    if (!item) return;
    setGeneratingPo(true);
    const { data: siblings, error: fetchError } = await supabase
      .from("trade_quote_items")
      .select("id, po_number")
      .eq("quote_id", item.quote_id)
      .order("created_at", { ascending: true });
    if (fetchError) {
      setGeneratingPo(false);
      toast({ title: "Could not generate PO", description: fetchError.message, variant: "destructive" });
      return;
    }
    const rows = siblings ?? [];
    const idx = rows.findIndex((row) => row.id === item.item_id);
    let seq = idx >= 0 ? idx + 1 : rows.length + 1;
    const taken = new Set(rows.map((row) => row.po_number).filter(Boolean));
    while (taken.has(autoPoNumber(item.quote_ref, seq))) seq += 1;
    const po = autoPoNumber(item.quote_ref, seq);
    const { error } = await supabase
      .from("trade_quote_items")
      .update({ po_number: po })
      .eq("id", item.item_id);
    setGeneratingPo(false);
    if (error) {
      toast({ title: "Could not generate PO", description: error.message, variant: "destructive" });
      return;
    }
    setPoNumber(po);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["delivery-tracker"] }),
      queryClient.invalidateQueries({ queryKey: ["ffe-schedule"] }),
    ]);
    toast({ title: "Purchase order generated", description: `${po} is now linked to this line.` });
  };

  useEffect(() => {
    setPoNumber(item?.po_number || "");
    setCostCode(item?.cost_code || "");
    setRequiredBy(item?.required_by_date || "");
    setLeadWeeks(item?.lead_time_weeks_override?.toString() || "");
  }, [item]);

  const save = async () => {
    if (!item) return;
    setSaving(true);
    const parsedLead = leadWeeks === "" ? null : Number(leadWeeks);
    const { error } = await supabase
      .from("trade_quote_items")
      .update({
        po_number: poNumber.trim() || null,
        cost_code: costCode.trim() || null,
        required_by_date: requiredBy || null,
        lead_time_weeks_override: Number.isFinite(parsedLead) ? parsedLead : null,
      })
      .eq("id", item.item_id);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["delivery-tracker"] }),
      queryClient.invalidateQueries({ queryKey: ["ffe-schedule"] }),
    ]);

    // Amber (<= 14 days slack) -> Red escalation: the database trigger raises the
    // in-app notification, this hook sends the procurement email.
    const priorSlack = typeof item.slack === "number" ? item.slack : null;
    if (priorSlack != null && priorSlack >= 0 && priorSlack <= 14) {
      const priorExpected = item.expected
        ? new Date(item.expected as string | Date).toISOString()
        : null;
      supabase.functions
        .invoke("notify-delivery-escalation", {
          body: { item_id: item.item_id, previous_slack: priorSlack, previous_expected: priorExpected },
        })
        .catch((err) => console.warn("delivery escalation hook failed", err));
    }
    toast({ title: "FF&E line updated", description: `${item.quote_ref} configuration saved.` });
    onOpenChange(false);
  };

  return (
    <Sheet open={!!item} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-[100dvh] w-full overflow-y-auto overscroll-contain p-0 sm:max-w-xl lg:max-w-2xl"
        overlayClassName="bg-foreground/35 backdrop-blur-sm"
      >
        {item && (
          <div className="px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-10">
            <SheetHeader className="border-b border-border pb-6 pr-10">
              <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Quote line workspace</p>
              <SheetTitle className="font-display text-2xl font-normal sm:text-3xl">{item.quote_ref}</SheetTitle>
              <SheetDescription className="font-body text-xs">
                {[item.project_name, item.client_name].filter(Boolean).join(" · ") || "Unassigned project"}
              </SheetDescription>
            </SheetHeader>

            <section className="grid grid-cols-2 gap-px border border-border bg-border mt-6">
              <div className="bg-background p-4">
                <Package className="h-4 w-4 text-muted-foreground mb-3" />
                <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Item</p>
                <p className="font-display text-base text-foreground mt-1">{item.product_name}</p>
                <p className="font-body text-xs text-muted-foreground mt-1">{item.brand_name}</p>
              </div>
              <div className="bg-background p-4">
                <ClipboardList className="h-4 w-4 text-muted-foreground mb-3" />
                <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Order</p>
                <p className="font-display text-base text-foreground mt-1">{item.quantity} unit{item.quantity === 1 ? "" : "s"}</p>
                <p className="font-body text-xs text-muted-foreground mt-1">{stageLabel(item.stage)}</p>
              </div>
            </section>

            <section className="mt-8 space-y-5">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <ReceiptText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-body text-[11px] uppercase tracking-[0.18em] text-foreground">PO information</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-po" className="font-body text-xs text-muted-foreground">PO number</Label>
                  <Input id="drawer-po" value={poNumber} onChange={(event) => setPoNumber(event.target.value)} placeholder="Auto-generated if empty" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-cost" className="font-body text-xs text-muted-foreground">Cost code</Label>
                  <Input id="drawer-cost" value={costCode} onChange={(event) => setCostCode(event.target.value)} placeholder="Optional" />
                </div>
              </div>
            </section>

            <section className="mt-8 space-y-5">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-body text-[11px] uppercase tracking-[0.18em] text-foreground">Delivery configuration</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-required" className="font-body text-xs text-muted-foreground">Required by</Label>
                  <Input id="drawer-required" type="date" value={requiredBy} onChange={(event) => setRequiredBy(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-lead" className="font-body text-xs text-muted-foreground">Lead time override (weeks)</Label>
                  <Input id="drawer-lead" type="number" min="0" value={leadWeeks} onChange={(event) => setLeadWeeks(event.target.value)} placeholder={item.lead_time || "Supplier lead time"} />
                </div>
              </div>
              {(item.sku || item.dimensions || item.materials) && (
                <dl className="grid gap-3 border-t border-border pt-4 font-body text-xs sm:grid-cols-2">
                  {item.sku && <div><dt className="text-muted-foreground">SKU</dt><dd className="mt-1 text-foreground">{item.sku}</dd></div>}
                  {item.dimensions && <div><dt className="text-muted-foreground">Dimensions</dt><dd className="mt-1 text-foreground">{item.dimensions}</dd></div>}
                  {item.materials && <div className="sm:col-span-2"><dt className="text-muted-foreground">Configuration</dt><dd className="mt-1 text-foreground">{item.materials}</dd></div>}
                </dl>
              )}
            </section>

            <div className="sticky bottom-0 mt-10 border-t border-border bg-background/95 py-4 backdrop-blur-sm">
              <Button className="w-full" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save FF&E configuration"}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}