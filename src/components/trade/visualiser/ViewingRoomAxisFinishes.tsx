import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AXIS_MATERIAL_KEY, keptAxisColours, viewingRoomSelection, viewingRoomViewerMaterials, type ViewingRoomAxisRole, type ViewingRoomChoice, type ViewingRoomSlot } from "@/lib/viewingRoom";

export default function ViewingRoomAxisFinishes({ slot, draft, disabled, onChange }: { slot: ViewingRoomSlot; draft: ViewingRoomChoice; disabled: boolean; onChange: (choice: ViewingRoomChoice) => void }) {
  const available = draft.finish_options.filter(finish => finish.size_key === draft.size_key);
  const selected = available.find(finish => finish.key === draft.finish_key) ?? available.find(finish => finish.retail_price === draft.retail_price) ?? available[0];
  if (!selected) return null;
  const shown = viewingRoomViewerMaterials(draft);
  const roles = (["seat", "backrest", "frame"] as const).filter(role => available.some(finish => finish.axes.some(axis => axis.role === role && axis.value)));
  const valueOf = (finish: typeof selected, role: ViewingRoomAxisRole) => finish.axes.find(axis => axis.role === role)?.value;
  const pick = (role: ViewingRoomAxisRole, key: string) => {
    const [value, colourId] = JSON.parse(key) as [string, string];
    const next = available.find(finish => roles.every(r => valueOf(finish, r) === (r === role ? value : valueOf(selected, r)))) ?? available.find(finish => valueOf(finish, role) === value);
    if (!next) return;
    const colours = keptAxisColours(next, draft.axis_colours);
    for (const axis of next.axes) {
      const current = shown[AXIS_MATERIAL_KEY[axis.role]];
      const colour = axis.colours.find(c => c.id === (axis.role === role ? colourId : colours[axis.role] ?? current?.id)) ?? axis.colours[0];
      if (colour) colours[axis.role] = colour.id;
    }
    onChange(viewingRoomSelection(slot, draft.id, next.key, draft.size_key, undefined, colours));
  };
  return <div className="space-y-4">{roles.map(role => {
    const ranges = new Map<string, typeof selected.axes[number]>();
    for (const finish of available) { const axis = finish.axes.find(a => a.role === role); if (axis?.value && !ranges.has(axis.value)) ranges.set(axis.value, axis); }
    const axis = selected.axes.find(a => a.role === role);
    if (!axis) return null;
    const current = axis.colours.find(c => c.id === shown[AXIS_MATERIAL_KEY[role]]?.id) ?? axis.colours[0];
    return <div key={role} className="space-y-2"><p className="text-xs text-muted-foreground">{axis.label}</p>
      <Select value={JSON.stringify([axis.value, current?.id ?? ""])} disabled={disabled} onValueChange={key => pick(role, key)}>
        <SelectTrigger aria-label={axis.label} className="h-auto min-h-10 whitespace-normal"><SelectValue /></SelectTrigger>
        <SelectContent>{[...ranges].map(([value, range]) => <SelectGroup key={value}><SelectLabel>{value}</SelectLabel>{range.colours.length ? range.colours.map(colour => <SelectItem key={colour.id} value={JSON.stringify([value, colour.id])}><span className="flex min-w-0 items-center gap-2">{colour.image_url && <img src={colour.image_url} alt="" className="size-5 shrink-0 rounded-full object-cover" />}{colour.name}</span></SelectItem>) : <SelectItem value={JSON.stringify([value, ""])}>{/com|customer/i.test(value) ? "Customer’s own material" : `${value} (colour on request)`}</SelectItem>}</SelectGroup>)}</SelectContent>
      </Select>
    </div>;
  })}</div>;
}