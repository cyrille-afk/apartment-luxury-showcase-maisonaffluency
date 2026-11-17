import { ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CIPRIANI_PACKAGE_OPTIONS } from "@/lib/proposalPresentation";

export type ProposalPresentation = {
  clientName: string;
  residenceName: string;
  packageName: string;
  roomLabel: string;
  targetCents: number | null;
  heroImage: string | null;
  floorPlanImage: string | null;
  roomImage: string | null;
  highlight: { x: number; y: number; width: number; height: number } | null;
};

export function ProposalPresentationSettings({ value, onChange, defaultHighlight }: { value: ProposalPresentation; onChange: (value: ProposalPresentation) => void; defaultHighlight?: ProposalPresentation['highlight'] }) {
  const update = (patch: Partial<ProposalPresentation>) => onChange({ ...value, ...patch });
  const imageInput = (key: "heroImage" | "floorPlanImage" | "roomImage", label: string) => (
    <label className="flex cursor-pointer items-center gap-2 border border-border bg-card px-3 py-2 text-xs">
      <ImagePlus className="size-4 shrink-0" /><span>{label}{value[key] ? " ✓" : ""}</span>
      <input className="sr-only" aria-label={label} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
        const file = event.target.files?.[0];
        if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
        const reader = new FileReader();
        reader.onload = () => { if (typeof reader.result === "string") update({ [key]: reader.result, ...(key === "floorPlanImage" ? { highlight: null } : {}) }); };
        reader.readAsDataURL(file);
      }} />
    </label>
  );
  return <section aria-label="Proposal presentation details" className="mx-auto mb-6 grid max-w-[794px] gap-3 border border-border bg-card p-4 text-card-foreground sm:grid-cols-3">
    {([['clientName', 'Client name'], ['residenceName', 'Residence floor plan']] as const).map(([key, label]) => <label key={key} className="text-xs">{label}<Input className="mt-1" value={value[key]} onChange={e => update({ [key]: e.target.value })} /></label>)}
    <div className="text-xs">Package<Select value={value.packageName || "bespoke"} onValueChange={packageName => update({ packageName: packageName === "bespoke" ? "" : packageName })}><SelectTrigger aria-label="Package" className="mt-1"><SelectValue /></SelectTrigger><SelectContent className="z-[11005]"><SelectItem value="bespoke">Bespoke collection</SelectItem>{CIPRIANI_PACKAGE_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
    <label className="text-xs">Room<Input className="mt-1" value={value.roomLabel} onChange={e => update({ roomLabel: e.target.value })} /></label>
    <label className="text-xs">Target allocation<Input className="mt-1" type="number" min="0" step="0.01" value={value.targetCents == null ? "" : value.targetCents / 100} onChange={e => update({ targetCents: e.target.value === "" ? null : Math.round(Math.max(0, Number(e.target.value)) * 100) })} /></label>
    {imageInput("heroImage", "Cipriani hero image")}{imageInput("floorPlanImage", "Apartment floor plan")}{imageInput("roomImage", "Rendered room vignette")}
    {value.floorPlanImage && <div className="grid gap-2 sm:col-span-3 sm:grid-cols-3">
      {([['x', 'Room centre X', 0, 100], ['y', 'Room centre Y', 0, 100], ['width', 'Room width', 1, 100], ['height', 'Room depth', 1, 100]] as const).map(([key, label, min, max]) => <label key={key} className="text-xs">{label}<input aria-label={label} className="mt-2 block w-full accent-primary" type="range" min={min} max={max} value={value.highlight?.[key] ?? (key === 'x' || key === 'y' ? 50 : 20)} onChange={e => update({ highlight: { x: 50, y: 50, width: 20, height: 20, ...value.highlight, [key]: Number(e.target.value) } })} /></label>)}
      {defaultHighlight && <button type="button" className="self-end justify-self-start border border-border px-3 py-2 text-xs hover:bg-muted" onClick={() => update({ highlight: { ...defaultHighlight } })}>Reset highlight to room</button>}
    </div>}
  </section>;
}