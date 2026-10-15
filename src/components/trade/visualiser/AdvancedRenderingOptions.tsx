import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { environmentSourcePref, type AdvancedRenderingSettings, type EnvironmentSourcePref } from "@/lib/visualiserAdvancedRendering";

const environments = [
  { value: "studio-softbox-exr", label: "Studio Softbox" },
  { value: "window-interior-exr", label: "Window Interior" },
  { value: "empty-room-exr", label: "Small Empty Room" },
] as const;

export default function AdvancedRenderingOptions({ settings, onChange, environment, onEnvironmentChange, className, pathTrace }: {
  settings: AdvancedRenderingSettings;
  onChange: (settings: AdvancedRenderingSettings) => void;
  environment: EnvironmentSourcePref;
  onEnvironmentChange: (source: EnvironmentSourcePref) => void;
  className?: string;
  pathTrace: boolean;
}) {
  const label = environments.find((item) => item.value === environment)?.label ?? "Legacy Studio HDR";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={className} aria-label="Advanced Rendering Options">
          <SlidersHorizontal className="mr-2 h-3.5 w-3.5" /> Advanced Rendering Options
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="z-[80] w-80 max-w-[calc(100vw-2rem)] space-y-5" aria-label="Advanced Rendering Options">
        <h3 className="text-sm font-medium">Advanced Rendering Options</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs"><span>Shadow Sharpness</span><output className="tabular-nums text-muted-foreground">{settings.shadowSharpness}%</output></div>
          <Slider thumbLabel="Shadow Sharpness" min={0} max={100} step={1} value={[settings.shadowSharpness]} disabled={pathTrace} title={pathTrace ? "Shadow-map controls apply to the live view; photoreal shadows follow physical light sources." : "Contact shadow sharpness"} onValueChange={([value]) => onChange({ ...settings, shadowSharpness: value })} />
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
                {environments.map((item) => <DropdownMenuRadioItem key={item.value} value={item.value}>{item.label}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PopoverContent>
    </Popover>
  );
}