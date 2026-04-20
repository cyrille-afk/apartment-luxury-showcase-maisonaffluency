import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { estimateShipping, ShippingBreakdown as Breakdown } from "@/lib/shippingEstimator";
import { toast } from "sonner";
import ShippingBreakdown from "./ShippingBreakdown";
import ShippingDocIntake, { ExtractedShipment } from "./ShippingDocIntake";
import { supabase } from "@/integrations/supabase/client";

const ORIGINS = [
  { code: "IT", label: "Italy" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "BE", label: "Belgium" },
  { code: "ES", label: "Spain" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
];

const DESTINATIONS = [
  { code: "SG", label: "Singapore" },
  { code: "HK", label: "Hong Kong" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "FR", label: "France" },
  { code: "AU", label: "Australia" },
];

const MODES = [
  { value: "", label: "Auto (cheapest)" },
  { value: "sea_lcl", label: "Sea LCL" },
  { value: "air", label: "Air freight" },
  { value: "courier", label: "Courier" },
];

const CATEGORIES = [
  { value: "furniture", label: "Furniture" },
  { value: "lighting", label: "Lighting" },
  { value: "art", label: "Art & collectibles" },
  { value: "textile", label: "Textile / rug" },
  { value: "accessory", label: "Accessory" },
];

interface Props {
  defaultOrigin?: string;
  defaultDest?: string;
  defaultCurrency?: string;
  quoteId?: string | null;
  orderTimelineId?: string | null;
  onSaved?: (id: string) => void;
}

export default function ShippingEstimatorForm({
  defaultOrigin = "IT",
  defaultDest = "SG",
  defaultCurrency = "EUR",
  quoteId,
  orderTimelineId,
  onSaved,
}: Props) {
  const [origin, setOrigin] = useState(defaultOrigin);
  const [dest, setDest] = useState(defaultDest);
  const [mode, setMode] = useState<string>("");
  const [category, setCategory] = useState<string>("furniture");
  const [cbm, setCbm] = useState<string>("2");
  const [kg, setKg] = useState<string>("400");
  const [value, setValue] = useState<string>("15000");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  const ORIGIN_CODES = new Set(ORIGINS.map(o => o.code));
  const DEST_CODES = new Set(DESTINATIONS.map(o => o.code));
  const MODE_VALUES = new Set(MODES.map(m => m.value).filter(Boolean));
  const CAT_VALUES = new Set(CATEGORIES.map(c => c.value));
  const CURRENCIES = new Set(["EUR","USD","GBP","SGD","HKD","AED"]);

  const applyExtracted = (e: ExtractedShipment) => {
    if (e.origin_country && ORIGIN_CODES.has(e.origin_country.toUpperCase())) setOrigin(e.origin_country.toUpperCase());
    if (e.dest_country && DEST_CODES.has(e.dest_country.toUpperCase())) setDest(e.dest_country.toUpperCase());
    if (e.mode && MODE_VALUES.has(e.mode)) setMode(e.mode);
    if (e.category && CAT_VALUES.has(e.category)) setCategory(e.category);
    if (e.total_volume_cbm != null) setCbm(String(e.total_volume_cbm));
    if (e.total_weight_kg != null) setKg(String(e.total_weight_kg));
    if (e.declared_value != null) setValue(String(e.declared_value));
    if (e.currency && CURRENCIES.has(e.currency.toUpperCase())) setCurrency(e.currency.toUpperCase());
  };

  const handleCompute = async () => {
    setComputing(true);
    try {
      const result = await estimateShipping({
        origin_country: origin,
        dest_country: dest,
        total_volume_cbm: parseFloat(cbm) || 0,
        total_weight_kg: parseFloat(kg) || 0,
        declared_value_cents: Math.round((parseFloat(value) || 0) * 100),
        currency,
        preferred_mode: (mode || undefined) as any,
        category: category as any,
      });
      setBreakdown(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to compute estimate");
    } finally {
      setComputing(false);
    }
  };

  const handleSave = async () => {
    if (!breakdown || !breakdown.available) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);

      const { data, error } = await supabase.from("shipping_quotes").insert({
        user_id: u.user.id,
        quote_id: quoteId || null,
        order_timeline_id: orderTimelineId || null,
        origin_country: origin,
        dest_country: dest,
        total_volume_cbm: parseFloat(cbm) || 0,
        total_weight_kg: parseFloat(kg) || 0,
        declared_value_cents: Math.round((parseFloat(value) || 0) * 100),
        currency,
        selected_lane_id: breakdown.selected_lane_id,
        selected_carrier: breakdown.selected_carrier,
        selected_mode: breakdown.selected_mode,
        freight_cents: breakdown.freight_cents,
        fuel_cents: breakdown.fuel_cents,
        insurance_cents: breakdown.insurance_cents,
        duty_cents: breakdown.duty_cents,
        vat_cents: breakdown.vat_cents,
        customs_cents: breakdown.customs_cents,
        handling_cents: breakdown.handling_cents,
        last_mile_cents: breakdown.last_mile_cents,
        total_cents: breakdown.total_cents,
        status: "estimate",
        valid_until: validUntil.toISOString().slice(0, 10),
        computed_breakdown: breakdown as any,
      }).select("id").single();

      if (error) throw error;
      toast.success("Estimate saved");
      onSaved?.(data.id);
    } catch (e: any) {
      toast.error(e.message || "Failed to save estimate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="font-body text-xs">Origin country</Label>
          <select value={origin} onChange={e => setOrigin(e.target.value)}
            className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {ORIGINS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="font-body text-xs">Destination country</Label>
          <select value={dest} onChange={e => setDest(e.target.value)}
            className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {DESTINATIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="font-body text-xs">Mode</Label>
          <select value={mode} onChange={e => setMode(e.target.value)}
            className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {MODES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="font-body text-xs">Category (for duty)</Label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {CATEGORIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="font-body text-xs">Total volume (cbm)</Label>
          <Input type="number" step="0.001" min="0" value={cbm} onChange={e => setCbm(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="font-body text-xs">Total weight (kg)</Label>
          <Input type="number" step="1" value={kg} onChange={e => setKg(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="font-body text-xs">Declared value</Label>
          <Input type="number" step="1" value={value} onChange={e => setValue(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="font-body text-xs">Currency</Label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {["EUR","USD","GBP","SGD","HKD","AED"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleCompute} disabled={computing} className="flex-1">
          {computing ? "Calculating…" : "Calculate estimate"}
        </Button>
        {breakdown?.available && (
          <Button onClick={handleSave} disabled={saving} variant="outline">
            {saving ? "Saving…" : "Save estimate"}
          </Button>
        )}
      </div>

      {breakdown && <ShippingBreakdown breakdown={breakdown} />}
    </div>
  );
}
