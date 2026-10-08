import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RoomCameraPresets({ value, onChange, pieces, disabled = false }: {
  value: string; onChange: (value: string) => void;
  pieces: { id: string; name: string }[]; disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label="Room camera view" className="h-9 w-[200px] max-w-full bg-background text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="overview">Full-room overview</SelectItem>
        {pieces.map((piece) => <SelectItem key={piece.id} value={piece.id}>Close-up · {piece.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}