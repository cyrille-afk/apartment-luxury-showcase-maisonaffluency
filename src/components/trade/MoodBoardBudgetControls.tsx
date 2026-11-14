import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { budgetCategories, type MoodBudgetSettings, type MoodRoomType, type moodBudgetLedger } from "@/lib/moodBoardBudget";
import { formatCents } from "@/lib/productPricing";

export function MoodBoardBudgetControls({ settings, onChange }: { settings: MoodBudgetSettings; onChange: (next: MoodBudgetSettings) => void }) {
  return <div className="flex flex-wrap items-end gap-3 border-y border-border py-3">
    <label className="space-y-1 text-[11px] text-muted-foreground">Room type
      <Select value={settings.roomType} onValueChange={v => onChange({ ...settings, roomType: v as MoodRoomType })}>
        <SelectTrigger aria-label="Room type" className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{(["living", "dining", "bedroom", "office"] as const).map(v => <SelectItem key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</SelectItem>)}</SelectContent>
      </Select>
    </label>
    <label className="space-y-1 text-[11px] text-muted-foreground">Total budget (EUR)
      <Input aria-label="Total budget (EUR)" type="number" min="0" step="100" value={settings.totalEur ?? ""} placeholder="No ceiling" className="h-8 w-40 text-xs" onChange={e => onChange({ ...settings, totalEur: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} />
    </label>
    <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-2 text-xs"><SlidersHorizontal className="h-3.5 w-3.5" />Category Budget Allocation</Button></PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <p className="font-display text-sm">Category caps · EUR</p>
        {budgetCategories.map(category => <label key={category} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">{category}
          <Input aria-label={`${category} budget cap (EUR)`} type="number" min="0" step="100" value={settings.caps[category] ?? ""} placeholder="No cap" className="h-8 w-28 text-xs" onChange={e => {
            const caps = { ...settings.caps }; if (e.target.value === "") delete caps[category]; else caps[category] = Math.max(0, Number(e.target.value)); onChange({ ...settings, caps });
          }} />
        </label>)}
      </PopoverContent>
    </Popover>
  </div>;
}

export function MoodBoardBudgetBar({ ledger, pending }: { ledger: ReturnType<typeof moodBudgetLedger>; pending: boolean }) {
  const fmt = (n: number) => formatCents(n, "EUR");
  return <div aria-label="Mood board budget" className="space-y-2 border-b border-border pb-4">
    <div className="flex flex-wrap justify-between gap-2 text-xs">
      <span className="text-foreground">Allocated · {pending ? "Loading prices…" : fmt(ledger.allocated)} <span className="text-muted-foreground">RRP</span></span>
      <span className={ledger.remaining != null && ledger.remaining < 0 ? "text-destructive" : "text-muted-foreground"}>{pending ? "Confirming budget…" : ledger.unpriced ? "Remaining unconfirmed" : ledger.remaining == null ? "No total ceiling" : `${ledger.remaining < 0 ? "Over budget" : "Remaining"} · ${fmt(Math.abs(ledger.remaining))}`}</span>
    </div>
    <Progress aria-label="Allocated versus total budget" value={ledger.total ? Math.min(100, ledger.allocated / ledger.total * 100) : 0} className="h-1.5" />
    {!pending && ledger.unpriced > 0 && <p className="text-[11px] text-muted-foreground">{ledger.unpriced} piece{ledger.unpriced === 1 ? "" : "s"} awaiting EUR pricing · budget incomplete</p>}
  </div>;
}