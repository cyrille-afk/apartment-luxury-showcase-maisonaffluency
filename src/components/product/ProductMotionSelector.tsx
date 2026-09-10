import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProductMotionValue } from "@/lib/productMotionOptions";

interface ProductMotionSelectorProps {
  value: ProductMotionValue;
  onChange: (value: ProductMotionValue) => void;
}

const OPTIONS: Array<{ value: ProductMotionValue; label: string }> = [
  { value: "swivel", label: "Swivel Base" },
  { value: "fixed", label: "Fixed Static Base" },
];

export default function ProductMotionSelector({
  value,
  onChange,
}: ProductMotionSelectorProps) {
  return (
    <fieldset className="border-y border-border/60 py-4">
      <legend className="sr-only">Motion Option</legend>
      <p className="mb-3 font-body text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Motion Option
      </p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Motion Option">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "h-11 min-w-0 rounded-none px-2 font-body text-[10px] uppercase tracking-[0.12em]",
                selected
                  ? "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                  : "border-border/70 bg-background text-foreground hover:bg-muted/60",
              )}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}