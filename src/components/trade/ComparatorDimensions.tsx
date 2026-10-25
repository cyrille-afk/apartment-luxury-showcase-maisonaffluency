import { comparatorDimensionGroups } from "@/lib/comparatorDimensions";

export function ComparatorDimensions({ dimensions }: { dimensions: string }) {
  const groups = comparatorDimensionGroups(dimensions);
  if (!groups.length) return <span className="text-muted-foreground">—</span>;
  return <div className="flex flex-col gap-3 text-left">
    {groups.map((group, index) => <div key={index} className="flex flex-col gap-1">
      {group.name && <p className="mb-1 text-xs font-semibold text-muted-foreground">{group.name}</p>}
      {group.rows.length > 0 && <dl className="flex flex-col gap-1">
        {group.rows.map((row, rowIndex) => <div key={`${row.label}-${rowIndex}`} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0 text-left leading-snug">
          <dt className="text-xs font-bold text-muted-foreground">{row.label}:</dt>
          <dd className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
            <span className="text-sm font-medium text-foreground">{row.metric}</span>
            <span className="text-xs text-muted-foreground">({row.imperial})</span>
          </dd>
        </div>)}
      </dl>}
      {group.note && <p className="text-xs text-muted-foreground">{group.note}</p>}
    </div>)}
  </div>;
}