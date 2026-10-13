import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function GalleryFilterSelect({ value, onChange, label, allLabel, options, counts, allCount }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  allLabel: string;
  options: string[];
  /** Pieces matching each option, keyed by the option label. */
  counts?: Record<string, number>;
  /** Pieces matching when nothing is selected (the "all" option). */
  allCount?: number;
}) {
  const hasCounts = counts !== undefined || allCount !== undefined;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="gallery-filter-pill h-11 min-w-0 rounded-full border-border px-4 font-body text-base sm:text-sm [&>span]:truncate [&>svg]:shrink-0 [&_.gallery-filter-count]:hidden">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={`max-w-[calc(100vw-2rem)]${hasCounts ? " min-w-[20rem]" : ""}`}>
        <SelectItem value="all">
          {allLabel}
          {allCount !== undefined && (
            <span className="gallery-filter-count ml-auto pl-4 text-xs tabular-nums text-muted-foreground">{allCount}</span>
          )}
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
            {counts?.[option] !== undefined && (
              <span className="gallery-filter-count ml-auto pl-4 text-xs tabular-nums text-muted-foreground">{counts[option]}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
