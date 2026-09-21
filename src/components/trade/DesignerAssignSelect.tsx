/**
 * Manual Curatorial Assignment cell.
 *
 * Multi-select over the canonical designer registry. Every toggle writes the
 * `predicted_designer_matches` array for that lead immediately — no save step,
 * no dialog. A discreet "✓ Assigned" marker confirms and fades.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Props = {
  leadId: string;
  studioName: string;
  value: string[];
  onChange: (next: string[]) => void;
};

export const useDesignerRegistry = () =>
  useQuery({
    queryKey: ["designer-registry", "names"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, name, display_name")
        .eq("is_published", true)
        .order("name", { ascending: true })
        .limit(1000);
      if (error) throw error;
      const names = (data ?? [])
        .map((d) => (d.display_name?.trim() || d.name?.trim() || ""))
        .filter(Boolean);
      return Array.from(new Set(names)).sort((a, b) =>
        a.localeCompare(b, "en", { sensitivity: "base" }),
      );
    },
  });

const DesignerAssignSelect = ({ leadId, studioName, value, onChange }: Props) => {
  const { data: registry = [], isLoading } = useDesignerRegistry();
  const [open, setOpen] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const name of registry) {
      const first = name.charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(first) ? first : "#";
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(name);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
  }, [registry]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const flash = () => {
    setAssigned(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAssigned(false), 1000);
  };

  const persist = async (next: string[]) => {
    const previous = value;
    onChange(next); // optimistic
    setSaving(true);
    const { error } = await supabase
      .from("acquisition_leads")
      .update({ predicted_designer_matches: next })
      .eq("id", leadId);
    setSaving(false);
    if (error) {
      onChange(previous);
      toast.error(`Could not update ${studioName}.`);
      return;
    }
    flash();
  };

  const toggle = (name: string) =>
    persist(value.includes(name) ? value.filter((n) => n !== name) : [...value, name]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 && (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
        {value.map((name) => (
          <Badge
            key={name}
            variant="outline"
            className="group rounded-none border-border pr-1 text-[11px] font-normal"
          >
            {name}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => toggle(name)}
              className="ml-1.5 text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={saving}
              className="inline-flex items-center gap-1.5 border border-border bg-transparent px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
            >
              Assign
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 rounded-none border-border p-0">
            <Command className="rounded-none bg-popover">
              <CommandInput placeholder="Search designers…" className="text-sm" />
              <CommandList className="max-h-64">
                <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                  {isLoading ? "Loading registry…" : "No designer found."}
                </CommandEmpty>
                <CommandGroup>
                  {registry.map((name) => {
                    const active = value.includes(name);
                    return (
                      <CommandItem
                        key={name}
                        value={name}
                        onSelect={() => toggle(name)}
                        className="cursor-pointer rounded-none text-[13px]"
                      >
                        <Check
                          className={`mr-2 h-3.5 w-3.5 ${active ? "opacity-100" : "opacity-0"}`}
                        />
                        {name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <span
          aria-live="polite"
          className={`text-[10px] uppercase tracking-[0.2em] text-emerald-600 transition-opacity duration-300 ${
            assigned ? "opacity-100" : "opacity-0"
          }`}
        >
          ✓ Assigned
        </span>
      </div>
    </div>
  );
};

export default DesignerAssignSelect;
