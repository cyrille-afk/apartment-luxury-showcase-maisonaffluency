import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Upload, Trash2 } from "lucide-react";
import { labelForMode } from "@/lib/shippingEstimator";

export default function TradeAdminShippingRates() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: lanes = [], isLoading } = useQuery({
    queryKey: ["admin-shipping-lanes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_lanes")
        .select("*, shipping_rate_brackets(*)")
        .order("origin_country").order("dest_country");
      if (error) throw error;
      return data || [];
    },
    enabled: !loading && isAdmin,
  });

  const deleteLane = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_lanes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-shipping-lanes"] }); toast.success("Lane deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCsvImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim() && !l.startsWith("#"));
    const header = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(l => {
      const cells = l.split(",").map(c => c.trim());
      return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
    });

    let inserted = 0, errors = 0;
    for (const r of rows) {
      try {
        const { data: lane, error: lerr } = await supabase.from("shipping_lanes")
          .upsert({
            origin_country: r.origin_country,
            origin_city: r.origin_city || "",
            dest_country: r.dest_country,
            dest_zone: r.dest_zone || "",
            carrier_name: r.carrier,
            mode: r.mode,
            transit_days_min: parseInt(r.transit_min || "0"),
            transit_days_max: parseInt(r.transit_max || "0"),
            source: "csv",
          }, { onConflict: "id" }).select("id").single();
        if (lerr) throw lerr;

        await supabase.from("shipping_rate_brackets").insert({
          lane_id: lane.id,
          min_volume_cbm: parseFloat(r.min_cbm || "0"),
          max_volume_cbm: parseFloat(r.max_cbm || "9999"),
          base_rate_cents: Math.round(parseFloat(r.base_rate || "0") * 100),
          rate_per_cbm_cents: Math.round(parseFloat(r.rate_per_cbm || "0") * 100),
          currency: r.currency || "EUR",
          valid_from: r.valid_from || new Date().toISOString().slice(0, 10),
          valid_to: r.valid_to || null,
          source: "csv",
        });
        inserted++;
      } catch (e) { errors++; }
    }
    qc.invalidateQueries({ queryKey: ["admin-shipping-lanes"] });
    toast.success(`Imported ${inserted} rows · ${errors} errors`);
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Shipping Rates Admin — Trade Portal</title></Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-foreground">Shipping rate matrix</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Manage carrier lanes and per-cbm/per-kg rate brackets that power the shipping estimator.
            </p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv" hidden
              onChange={e => e.target.files?.[0] && handleCsvImport(e.target.files[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> CSV import
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" /> New lane
            </Button>
          </div>
        </div>

        {showNew && <NewLaneForm onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["admin-shipping-lanes"] }); }} />}

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origin</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Carrier · mode</TableHead>
                <TableHead>Transit</TableHead>
                <TableHead className="text-right">Brackets</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : lanes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No lanes yet</TableCell></TableRow>
              ) : lanes.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-body text-sm">{l.origin_country} {l.origin_city && <span className="text-muted-foreground">· {l.origin_city}</span>}</TableCell>
                  <TableCell className="font-body text-sm">{l.dest_country} {l.dest_zone && <span className="text-muted-foreground">· {l.dest_zone}</span>}</TableCell>
                  <TableCell className="font-body text-sm">{l.carrier_name} <span className="text-muted-foreground">· {labelForMode(l.mode)}</span></TableCell>
                  <TableCell className="font-body text-xs text-muted-foreground">{l.transit_days_min}–{l.transit_days_max} d</TableCell>
                  <TableCell className="text-right font-body text-sm">{l.shipping_rate_brackets?.length || 0}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => deleteLane.mutate(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-md bg-muted/40 p-4 font-body text-xs text-muted-foreground">
          <strong className="text-foreground">CSV format:</strong> <code>origin_country,origin_city,dest_country,dest_zone,carrier,mode,transit_min,transit_max,min_cbm,max_cbm,base_rate,rate_per_cbm,currency,valid_from,valid_to</code>
          <br />Mode: sea_lcl | sea_fcl | air | road | courier. Rates in major currency unit (e.g. EUR, not cents).
        </div>
      </div>
    </>
  );
}

function NewLaneForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    origin_country: "IT", origin_city: "", dest_country: "SG", dest_zone: "",
    carrier_name: "", mode: "sea_lcl", transit_days_min: 30, transit_days_max: 40,
    base_rate: 150, rate_per_cbm: 200, currency: "EUR",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const { data: lane, error } = await supabase.from("shipping_lanes").insert({
        origin_country: form.origin_country, origin_city: form.origin_city,
        dest_country: form.dest_country, dest_zone: form.dest_zone,
        carrier_name: form.carrier_name, mode: form.mode,
        transit_days_min: form.transit_days_min, transit_days_max: form.transit_days_max,
      }).select("id").single();
      if (error) throw error;

      await supabase.from("shipping_rate_brackets").insert({
        lane_id: lane.id,
        base_rate_cents: Math.round(form.base_rate * 100),
        rate_per_cbm_cents: Math.round(form.rate_per_cbm * 100),
        currency: form.currency,
      });

      toast.success("Lane created");
      onCreated();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Origin country</Label><Input value={form.origin_country} onChange={e => setForm({...form, origin_country: e.target.value.toUpperCase()})} /></div>
        <div><Label className="text-xs">Origin city</Label><Input value={form.origin_city} onChange={e => setForm({...form, origin_city: e.target.value})} /></div>
        <div><Label className="text-xs">Dest country</Label><Input value={form.dest_country} onChange={e => setForm({...form, dest_country: e.target.value.toUpperCase()})} /></div>
        <div><Label className="text-xs">Dest zone</Label><Input value={form.dest_zone} onChange={e => setForm({...form, dest_zone: e.target.value})} /></div>
        <div><Label className="text-xs">Carrier</Label><Input value={form.carrier_name} onChange={e => setForm({...form, carrier_name: e.target.value})} /></div>
        <div>
          <Label className="text-xs">Mode</Label>
          <select value={form.mode} onChange={e => setForm({...form, mode: e.target.value})} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="sea_lcl">Sea LCL</option><option value="sea_fcl">Sea FCL</option>
            <option value="air">Air</option><option value="road">Road</option><option value="courier">Courier</option>
          </select>
        </div>
        <div><Label className="text-xs">Transit min (d)</Label><Input type="number" value={form.transit_days_min} onChange={e => setForm({...form, transit_days_min: parseInt(e.target.value)})} /></div>
        <div><Label className="text-xs">Transit max (d)</Label><Input type="number" value={form.transit_days_max} onChange={e => setForm({...form, transit_days_max: parseInt(e.target.value)})} /></div>
        <div><Label className="text-xs">Base rate ({form.currency})</Label><Input type="number" value={form.base_rate} onChange={e => setForm({...form, base_rate: parseFloat(e.target.value)})} /></div>
        <div><Label className="text-xs">Per cbm ({form.currency})</Label><Input type="number" value={form.rate_per_cbm} onChange={e => setForm({...form, rate_per_cbm: parseFloat(e.target.value)})} /></div>
        <div><Label className="text-xs">Currency</Label><Input value={form.currency} onChange={e => setForm({...form, currency: e.target.value.toUpperCase()})} /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create lane"}</Button>
      </div>
    </div>
  );
}
