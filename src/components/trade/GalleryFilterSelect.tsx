import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function GalleryFilterSelect({ value, onChange, label, allLabel, options }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  allLabel: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="gallery-filter-pill h-11 min-w-0 rounded-full border-border px-4 font-body text-base sm:text-sm [&>span]:truncate [&>svg]:shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-2rem)]">
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}