import type { MutableRefObject } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WalkInput } from "@/lib/roomWalkthrough";

export default function RoomWalkthroughControls({ input, view, onView, onExit }: {
  input: MutableRefObject<WalkInput>; view: "entrance" | "left" | "right";
  onView: (view: "entrance" | "left" | "right") => void; onExit: () => void;
}) {
  const moves = [
    { label: "Turn left", icon: RotateCcw, axis: "turn", value: 1 },
    { label: "Move forward", icon: ArrowUp, axis: "forward", value: 1 },
    { label: "Turn right", icon: RotateCw, axis: "turn", value: -1 },
    { label: "Move left", icon: ArrowLeft, axis: "right", value: -1 },
    { label: "Move backward", icon: ArrowDown, axis: "forward", value: -1 },
    { label: "Move right", icon: ArrowRight, axis: "right", value: 1 },
  ] as const;
  return <div role="group" aria-label="Interactive walkthrough controls" className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-end justify-between gap-3">
    <div className="grid grid-cols-3 gap-1 border border-border bg-background/95 p-2 shadow-sm">
      {moves.map(({ label, icon: Icon, axis, value }) => <Button key={label} size="icon" variant="ghost" className="h-12 w-12 touch-none sm:h-10 sm:w-10" aria-label={label} title={label}
        onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.current[axis] = value; }}
        onPointerUp={() => { input.current[axis] = 0; }} onPointerCancel={() => { input.current[axis] = 0; }} onLostPointerCapture={() => { input.current[axis] = 0; }}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); input.current[axis] = value; } }}
        onKeyUp={() => { input.current[axis] = 0; }} onBlur={() => { input.current[axis] = 0; }}><Icon className="h-4 w-4" /></Button>)}
    </div>
    <div className="flex flex-wrap gap-2 border border-border bg-background/95 p-2 shadow-sm">
      <Select value={view} onValueChange={v => { if (v === "entrance" || v === "left" || v === "right") onView(v); }}>
        <SelectTrigger aria-label="Walkthrough viewpoint" className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="entrance">Entrance</SelectItem><SelectItem value="left">Left side</SelectItem><SelectItem value="right">Right side</SelectItem></SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={onExit}><X className="mr-1.5 h-4 w-4" />Exit walkthrough</Button>
    </div>
  </div>;
}