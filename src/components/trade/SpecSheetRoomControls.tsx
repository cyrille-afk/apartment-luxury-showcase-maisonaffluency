import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { normalizeSpecRoomName, parseSpecRoomBudget, specRoomBudgetStatus, type SpecCurrencyTotal } from "@/lib/specSheetRooms";

const CUSTOM_ROOM = "__custom_room__";

export function SpecRoomFilterBar(props: {
  roomNames: string[];
  counts: Record<string, number>;
  totalCount: number;
  activeRoom: string;
  onRoomChange: (room: string) => void;
  onAddRoom: () => void;
  groupByRoom: boolean;
  onGroupChange: (value: boolean) => void;
}) {
  return <div className="flex flex-col gap-3 border-y border-border/60 py-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="Filter items by room">
      <button type="button" onClick={() => props.onRoomChange("all")} aria-pressed={props.activeRoom === "all"} className={cn("shrink-0 cursor-pointer rounded-full border px-3 py-1.5 font-body text-xs transition-colors", props.activeRoom === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground")}>
        All Rooms ({props.totalCount})
      </button>
      {props.roomNames.map(room => <button key={room} type="button" onClick={() => props.onRoomChange(room)} aria-pressed={props.activeRoom === room} className={cn("shrink-0 cursor-pointer rounded-full border px-3 py-1.5 font-body text-xs transition-colors", props.activeRoom === room ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground")}>
        {room} ({props.counts[room] || 0})
      </button>)}
      <button type="button" onClick={props.onAddRoom} className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground"><Plus className="h-3 w-3" /> Add Room</button>
    </div>
    <label className="flex shrink-0 cursor-pointer items-center gap-2 font-body text-xs text-muted-foreground">
      <button type="button" role="switch" aria-checked={props.groupByRoom} onClick={() => props.onGroupChange(!props.groupByRoom)} className={cn("relative h-5 w-9 rounded-full transition-colors", props.groupByRoom ? "bg-primary" : "bg-muted")}>
        <span className={cn("absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform", props.groupByRoom ? "translate-x-4" : "translate-x-0")} />
      </button>
      Group by Room
    </label>
  </div>;
}

export function SpecRoomAssignmentSelect(props: {
  value: string;
  roomNames: string[];
  productName: string;
  onChange: (room: string) => void;
  onCustomRoom: () => void;
}) {
  return <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} className="mt-2 flex h-7 items-center">
    <Select value={props.value} onValueChange={value => value === CUSTOM_ROOM ? props.onCustomRoom() : props.onChange(value)}>
      <SelectTrigger aria-label={`Room for ${props.productName}`} className="h-7 w-auto min-w-0 max-w-full gap-2 rounded-full border-border/80 px-2.5 py-0 font-body text-[10px] text-muted-foreground shadow-none [&>svg]:h-3 [&>svg]:w-3">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className="font-body text-xs">
        {props.roomNames.map(room => <SelectItem key={room} value={room} className="text-xs">{room}</SelectItem>)}
        <SelectItem value={CUSTOM_ROOM} className="text-xs"><span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Custom room…</span></SelectItem>
      </SelectContent>
    </Select>
  </div>;
}

export function SpecRoomSectionHeader(props: {
  name: string;
  selectedCount: number;
  totals: SpecCurrencyTotal[];
  unpricedCount: number;
  budgetCents: number | null;
  budgetCurrency: string;
  onBudgetChange: (cents: number | null, currency: string) => Promise<void>;
  formatMoney: (cents: number, currency: string) => string;
}) {
  const initial = props.budgetCents == null ? "" : String(props.budgetCents / 100);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(initial); setInvalid(false); }, [initial, props.name]);
  const status = specRoomBudgetStatus(props.totals, props.budgetCents, props.budgetCurrency);
  const commit = async () => {
    const cents = parseSpecRoomBudget(draft);
    if (cents === undefined) { setInvalid(true); return; }
    if (cents === props.budgetCents) { setInvalid(false); return; }
    setSaving(true); setInvalid(false);
    try { await props.onBudgetChange(cents, props.totals.length === 1 ? props.totals[0].currency : props.budgetCurrency); }
    finally { setSaving(false); }
  };
  return <section aria-label={`${props.name} room summary`} className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Room collection</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-xl text-foreground">{props.name}</h2>
        <span className="font-body text-xs text-muted-foreground">{props.selectedCount} selected</span>
      </div>
      <p className="mt-1 font-body text-sm text-foreground">
        {props.totals.length ? props.totals.map(total => props.formatMoney(total.cents, total.currency)).join(" · ") : "No confirmed client prices"}
        {props.unpricedCount > 0 && <span className="ml-2 text-xs text-muted-foreground">· {props.unpricedCount} price{props.unpricedCount === 1 ? "" : "s"} on request</span>}
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={`room-budget-${props.name}`} className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Room Budget</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">{props.budgetCurrency}</span>
        <Input id={`room-budget-${props.name}`} value={draft} disabled={saving} inputMode="decimal" placeholder="Optional" onChange={event => { setDraft(event.target.value); setInvalid(false); }} onBlur={() => void commit()} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} className="h-8 w-40 pl-11 font-body text-xs" aria-invalid={invalid} />
      </div>
      <span className="min-h-4 font-body text-xs text-muted-foreground" role="status">
        {invalid ? "Enter a valid amount" : saving ? "Saving…" : status ? <span className={status.kind === "over" ? "text-destructive" : "text-primary"}>{props.formatMoney(status.cents, props.budgetCurrency)} {status.kind === "over" ? "over budget" : "remaining"}</span> : props.budgetCents != null && props.totals.length > 1 ? "Budget comparison needs one currency" : null}
      </span>
    </div>
  </section>;
}

export function AddSpecRoomDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (props.open) { setName(""); setError(""); } }, [props.open]);
  const save = async () => {
    const normalized = normalizeSpecRoomName(name);
    if (!normalized) { setError("Enter a room name."); return; }
    setSaving(true); setError("");
    try {
      const saved = await props.onSave(normalized);
      if (saved) props.onOpenChange(false); else setError("The room could not be saved. Please try again.");
    } finally { setSaving(false); }
  };
  return <Dialog open={props.open} onOpenChange={open => { if (!saving) props.onOpenChange(open); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Add a room</DialogTitle><DialogDescription>Create a custom room for this presentation. You can assign items and set its budget next.</DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor="custom-spec-room">Room name</Label><Input id="custom-spec-room" autoFocus maxLength={60} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void save(); }} placeholder="e.g. Garden Terrace" /></div>
      <p role="alert" className="min-h-5 font-body text-xs text-destructive">{error}</p>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => props.onOpenChange(false)}>Cancel</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : <><Check className="mr-2 h-4 w-4" /> Add Room</>}</Button></div>
    </DialogContent>
  </Dialog>;
}
