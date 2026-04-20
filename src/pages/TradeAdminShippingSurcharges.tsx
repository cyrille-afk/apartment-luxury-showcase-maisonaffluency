import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const TYPES = ["fuel","insurance","customs","handling","last_mile","security","documentation"];
const METHODS = ["percent","flat","per_cbm","per_kg"];

export default function TradeAdminShippingSurcharges() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"surcharges" | "duties">("surcharges");

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Shipping Surcharges & Duties — Trade Portal</title></Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Surcharges & duties</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Configure fuel, insurance, customs, last-mile and import-duty rules applied to every shipping estimate.
          </p>
        </div>

        <div className="flex gap-1 border-b border-border">
          {(["surcharges","duties"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 font-body text-sm capitalize border-b-2 -mb-px transition-colors
                ${tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "surcharges" ? <SurchargesTab /> : <DutiesTab />}
      </div>
    </>
  );
}

function SurchargesTab() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["shipping-surcharges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_surcharges").select("*").order("surcharge_type");
      if (error) throw error;
      return data || [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("shipping_surcharges").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-surcharges"] }); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New surcharge</Button>
      </div>
      {showNew && <NewSurcharge onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["shipping-surcharges"] }); }} />}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Type</TableHead><TableHead>Scope</TableHead><TableHead>Method</TableHead>
            <TableHead className="text-right">Value</TableHead><TableHead>Currency</TableHead><TableHead>Active</TableHead><TableHead className="w-12"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-body text-sm capitalize">{r.surcharge_type.replace("_"," ")}</TableCell>
                <TableCell className="font-body text-xs text-muted-foreground">{r.scope}{r.carrier_name ? ` · ${r.carrier_name}` : ""}{r.dest_country ? ` · ${r.dest_country}` : ""}</TableCell>
                <TableCell className="font-body text-xs">{r.calc_method}</TableCell>
                <TableCell className="text-right font-body text-sm tabular-nums">
                  {r.calc_method === "percent" ? `${r.value_numeric}%` : `${r.value_numeric / (r.calc_method === "flat" ? 100 : 100)} ${r.currency}`}
                </TableCell>
                <TableCell className="font-body text-xs">{r.currency}</TableCell>
                <TableCell><span className={`text-[10px] px-2 py-0.5 rounded ${r.active ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{r.active ? "active" : "off"}</span></TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NewSurcharge({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ surcharge_type: "fuel", scope: "global", calc_method: "percent", value_numeric: 18, currency: "EUR", carrier_name: "", dest_country: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        surcharge_type: f.surcharge_type, scope: f.scope, calc_method: f.calc_method,
        value_numeric: f.calc_method === "flat" ? f.value_numeric * 100 : f.value_numeric,
        currency: f.currency, active: true,
      };
      if (f.scope === "carrier") payload.carrier_name = f.carrier_name;
      if (f.scope === "dest_zone") payload.dest_country = f.dest_country;
      const { error } = await supabase.from("shipping_surcharges").insert(payload);
      if (error) throw error;
      toast.success("Created");
      onCreated();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Type</Label>
          <select value={f.surcharge_type} onChange={e => setF({...f, surcharge_type: e.target.value})} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select></div>
        <div><Label className="text-xs">Scope</Label>
          <select value={f.scope} onChange={e => setF({...f, scope: e.target.value})} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="global">global</option><option value="carrier">carrier</option><option value="dest_zone">dest country</option>
          </select></div>
        <div><Label className="text-xs">Method</Label>
          <select value={f.calc_method} onChange={e => setF({...f, calc_method: e.target.value})} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select></div>
        <div><Label className="text-xs">Value {f.calc_method === "percent" ? "(%)" : `(${f.currency})`}</Label>
          <Input type="number" step="0.01" value={f.value_numeric} onChange={e => setF({...f, value_numeric: parseFloat(e.target.value)})} /></div>
        {f.scope === "carrier" && <div><Label className="text-xs">Carrier</Label><Input value={f.carrier_name} onChange={e => setF({...f, carrier_name: e.target.value})} /></div>}
        {f.scope === "dest_zone" && <div><Label className="text-xs">Dest country code</Label><Input value={f.dest_country} onChange={e => setF({...f, dest_country: e.target.value.toUpperCase()})} /></div>}
        <div><Label className="text-xs">Currency</Label><Input value={f.currency} onChange={e => setF({...f, currency: e.target.value.toUpperCase()})} /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
      </div>
    </div>
  );
}

function DutiesTab() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["shipping-duties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_duty_rates").select("*").order("dest_country").order("category");
      if (error) throw error;
      return data || [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("shipping_duty_rates").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-duties"] }); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New duty rate</Button>
      </div>
      {showNew && <NewDuty onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["shipping-duties"] }); }} />}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Country</TableHead><TableHead>HS chapter</TableHead><TableHead>Category</TableHead>
            <TableHead className="text-right">Duty %</TableHead><TableHead className="text-right">VAT %</TableHead>
            <TableHead>Notes</TableHead><TableHead className="w-12"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-body text-sm">{r.dest_country}</TableCell>
                <TableCell className="font-body text-xs">{r.hs_chapter}</TableCell>
                <TableCell className="font-body text-xs capitalize">{r.category}</TableCell>
                <TableCell className="text-right font-body tabular-nums">{r.duty_percent}%</TableCell>
                <TableCell className="text-right font-body tabular-nums">{r.vat_percent}%</TableCell>
                <TableCell className="font-body text-xs text-muted-foreground">{r.notes}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NewDuty({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ dest_country: "SG", hs_chapter: "94", category: "furniture", duty_percent: 0, vat_percent: 9, notes: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("shipping_duty_rates").insert(f);
      if (error) throw error;
      toast.success("Created"); onCreated();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><Label className="text-xs">Dest country</Label><Input value={f.dest_country} onChange={e => setF({...f, dest_country: e.target.value.toUpperCase()})} /></div>
        <div><Label className="text-xs">HS chapter</Label><Input value={f.hs_chapter} onChange={e => setF({...f, hs_chapter: e.target.value})} /></div>
        <div><Label className="text-xs">Category</Label>
          <select value={f.category} onChange={e => setF({...f, category: e.target.value})} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {["furniture","lighting","art","textile","accessory","other"].map(c => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div><Label className="text-xs">Duty %</Label><Input type="number" step="0.1" value={f.duty_percent} onChange={e => setF({...f, duty_percent: parseFloat(e.target.value)})} /></div>
        <div><Label className="text-xs">VAT %</Label><Input type="number" step="0.1" value={f.vat_percent} onChange={e => setF({...f, vat_percent: parseFloat(e.target.value)})} /></div>
        <div className="col-span-2 md:col-span-3"><Label className="text-xs">Notes</Label><Input value={f.notes} onChange={e => setF({...f, notes: e.target.value})} /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
      </div>
    </div>
  );
}
