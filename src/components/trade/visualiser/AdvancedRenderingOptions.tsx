import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DEFAULT_ADVANCED_RENDERING, VISUALISER_ENVIRONMENTS, environmentSourcePref, type AdvancedRenderingSettings, type EnvironmentSourcePref } from "@/lib/visualiserAdvancedRendering";

export default function AdvancedRenderingOptions({ settings, onChange, environment, onEnvironmentChange, className, inline = false, pathTrace, depthOfField, onDepthOfFieldChange, dofStrength, onDofStrengthChange }: {
  settings: AdvancedRenderingSettings;
  onChange: (settings: AdvancedRenderingSettings) => void;
  environment: EnvironmentSourcePref;
  onEnvironmentChange: (source: EnvironmentSourcePref) => void;
  className?: string;
  inline?: boolean;
  pathTrace: boolean;
  depthOfField: boolean;
  onDepthOfFieldChange: (enabled: boolean) => void;
  dofStrength: number;
  onDofStrengthChange: (strength: number) => void;
}) {
  const label = VISUALISER_ENVIRONMENTS.find((item) => item.value === environment)?.label ?? "Studio";
  const content = <>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs"><span>Furniture Shadow Intensity</span><output className="tabular-nums text-muted-foreground">{settings.contactShadowIntensity ?? 72}%</output></div>
          <Slider thumbLabel="Furniture Shadow Intensity" min={0} max={100} step={1} value={[settings.contactShadowIntensity ?? 72]} disabled={pathTrace} title={pathTrace ? "Photoreal shadows follow physical lighting; switch Photoreal Render off to tune live shadows." : "Furniture shadow intensity"} onValueChange={([value]) => onChange({ ...settings, contactShadowIntensity: value })} />
          <div className="flex items-center justify-between text-xs"><span>Furniture Shadow Softness</span><output className="tabular-nums text-muted-foreground">{100 - settings.shadowSharpness}%</output></div>
          <Slider thumbLabel="Furniture Shadow Softness" min={0} max={100} step={1} value={[100 - settings.shadowSharpness]} disabled={pathTrace} title={pathTrace ? "Photoreal shadows follow physical lighting; switch Photoreal Render off to tune live shadows." : "Softness of furniture shadow edges"} onValueChange={([value]) => onChange({ ...settings, shadowSharpness: 100 - value })} />
          <Button variant="outline" size="sm" className="w-full text-xs" disabled={pathTrace} onClick={() => onChange({ ...settings, shadowSharpness: DEFAULT_ADVANCED_RENDERING.shadowSharpness, contactShadowIntensity: DEFAULT_ADVANCED_RENDERING.contactShadowIntensity })}>Reset Furniture Shadows</Button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs"><label htmlFor="advanced-dof">Depth of Field</label><Switch id="advanced-dof" checked={depthOfField} onCheckedChange={onDepthOfFieldChange} /></div>
          <div className="flex items-center justify-between text-xs"><span>Bokeh Strength</span><output className="tabular-nums text-muted-foreground">{dofStrength.toFixed(1)}</output></div>
          <Slider thumbLabel="Bokeh Strength" min={1} max={10} step={0.1} value={[dofStrength]} disabled={!depthOfField} onValueChange={([value]) => onDofStrengthChange(value)} />
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { onDepthOfFieldChange(true); onDofStrengthChange(1); }}>Reset DoF</Button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs"><span>Contrast / Intensity</span><output className="tabular-nums text-muted-foreground">{settings.contrastIntensity}%</output></div>
          <Slider thumbLabel="Contrast / Intensity" min={0} max={100} step={1} value={[settings.contrastIntensity]} onValueChange={([value]) => onChange({ ...settings, contrastIntensity: value })} />
        </div>
        <div className="space-y-2">
          <div className="text-xs">EXR Environment</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between text-xs" aria-label="EXR Environment">{label}<span aria-hidden="true">▾</span></Button></DropdownMenuTrigger>
            <DropdownMenuContent className="z-[90]" align="start">
              <DropdownMenuRadioGroup value={environment} onValueChange={(value) => onEnvironmentChange(environmentSourcePref(value))}>
                {VISUALISER_ENVIRONMENTS.map((item) => <DropdownMenuRadioItem key={item.value} value={item.value}>{item.label}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </>;
  if (inline) return <div className="space-y-5">{content}</div>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={className} aria-label="Advanced Rendering Options">
          <SlidersHorizontal className="mr-2 h-3.5 w-3.5" /> Advanced Rendering Options
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="z-[80] w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto space-y-5" aria-label="Advanced Rendering Options">
        <h3 className="text-sm font-medium">Advanced Rendering Options</h3>
        {content}
      </PopoverContent>
    </Popover>
  );
}