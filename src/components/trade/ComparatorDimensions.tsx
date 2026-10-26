import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { comparatorDimensionGroups } from "@/lib/comparatorDimensions";

type Group = ReturnType<typeof comparatorDimensionGroups>[number];

function DimensionGroup({ group }: { group: Group }) {
  return <div className="flex flex-col gap-1">
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
  </div>;
}

/** Shows the first recorded size; any other sizes sit behind a dropdown. */
export function ComparatorDimensions({ dimensions }: { dimensions: string }) {
  const groups = comparatorDimensionGroups(dimensions);
  const [open, setOpen] = useState(false);
  if (!groups.length) return <span className="text-muted-foreground">—</span>;
  const [first, ...rest] = groups;
  return <div className="flex flex-col gap-3 text-left">
    <DimensionGroup group={first} />
    {rest.length > 0 && <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        {open ? "Hide other sizes" : `Other sizes (${rest.length})`}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && rest.map((group, index) => <DimensionGroup key={index} group={group} />)}
    </div>}
  </div>;
}
