/**
 * Manual Curatorial Assignment cell.
 *
 * Multi-select over the canonical designer registry. Every toggle writes the
 * `predicted_designer_matches` array for that lead immediately — no save step,
 * no dialog. A discreet "✓ Assigned" marker confirms and fades.
 *
 * Dropdown uses alphabetical accordion groups: collapsed by default, search
 * auto-expands groups that contain matches and hides groups with no matches.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
        .map((d) => d.display_name?.trim() || d.name?.trim() || "")
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
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  const q = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    return groups
      .map(([letter, names]) => [letter, names.filter((n) => n.toLowerCase().includes(q))] as const)
      .filter(([, names]) => names.length > 0);
  }, [groups, q]);

  // Search override: expand matching groups, collapse all when cleared.
  useEffect(() => {
    if (!q) {
      setExpanded(new Set());
      return;
    }
    const matching = new Set(filteredGroups.map(([letter]) => letter));
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const letter of matching) next.add(letter);
      return next;
    });
  }, [q, filteredGroups]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

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

  const toggleLetter = (letter: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });

  const removeBadge = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    toggle(name);
  };

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
              onClick={(e) => removeBadge(e, name)}
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
          <PopoverContent
            align="start"
            className="w-64 rounded-none border-border p-0"
            onPointerDownOutside={() => setOpen(false)}
          >
            <div className="flex flex-col bg-popover">
              {/* Sticky search */}
              <div className="sticky top-0 z-10 border-b border-border bg-popover p-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search designers…"
                  className="w-full rounded-none border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
                />
              </div>

              {/* Scrollable accordion list */}
              <div className="max-h-64 overflow-y-auto px-1 py-1">
                {isLoading && (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Loading registry…
                  </div>
                )}
                {!isLoading && filteredGroups.length === 0 && (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No designer found.
                  </div>
                )}
                {filteredGroups.map(([letter, names]) => {
                  const isExpanded = expanded.has(letter);
                  return (
                    <div key={letter} className="border-b border-border/60 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggleLetter(letter)}
                        className="flex w-full items-center justify-between px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span>{letter}</span>
                        <ChevronRight
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                      {isExpanded && (
                        <div className="pb-1">
                          {names.map((name) => {
                            const active = value.includes(name);
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => toggle(name)}
                                className="flex w-full items-center px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-muted/50"
                              >
                                <Check
                                  className={`mr-2 h-3.5 w-3.5 flex-shrink-0 ${
                                    active ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <span className="truncate">{name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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
