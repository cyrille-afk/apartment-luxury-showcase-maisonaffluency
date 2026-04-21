import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Detect a "curated" slug — one that intentionally diverges from a naive
 * slugify(name/display_name). Example: designer "Alinea Design Objects" with
 * slug "leo-aerts-alinea" — the slug encodes the founder + atelier and must
 * NEVER be auto-overwritten, even if it would otherwise look "wrong".
 *
 * A slug is considered curated when it does not start with the slugified
 * name OR display_name. We're intentionally permissive: any plausible
 * derivation (prefix match) is treated as non-curated.
 */
export function isCuratedSlug(d: { name: string; display_name?: string | null; slug: string | null }): boolean {
  if (!d.slug) return false;
  const candidates = [d.name, d.display_name].filter(Boolean) as string[];
  if (candidates.length === 0) return false;
  const slugBases = candidates.map((c) =>
    c
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );
  // Curated = slug doesn't start with any naive derivation of name/display_name
  return !slugBases.some((base) => base && (d.slug === base || d.slug!.startsWith(base + "-")));
}

export interface SlugHealthDesigner {
  id: string;
  name: string;
  display_name?: string | null;
  slug: string | null;
}

/* ------------------------------------------------------------------ */
/*  Slug health detection                                              */
/*                                                                     */
/*  A slug is "broken" if any of these are true:                       */
/*    - empty / null                                                   */
/*    - contains characters outside [a-z0-9-]                          */
/*    - duplicated across multiple designer rows                       */
/*                                                                     */
/*  We DO NOT flag mismatches against name/display_name — those are    */
/*  intentional editorial choices (e.g. "leo-aerts-alinea" for         */
/*  Alinea Design Objects) and must stay untouched.                    */
/* ------------------------------------------------------------------ */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SlugIssue =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "duplicate"; conflictsWith: string[] };

export function useSlugHealthMap(designers: SlugHealthDesigner[]) {
  return useMemo(() => {
    const slugCounts = new Map<string, string[]>();
    for (const d of designers) {
      if (!d.slug) continue;
      const arr = slugCounts.get(d.slug) || [];
      arr.push(d.id);
      slugCounts.set(d.slug, arr);
    }
    const out = new Map<string, SlugIssue>();
    for (const d of designers) {
      if (!d.slug || !d.slug.trim()) {
        out.set(d.id, { kind: "missing" });
        continue;
      }
      if (!SLUG_PATTERN.test(d.slug)) {
        out.set(d.id, { kind: "invalid" });
        continue;
      }
      const owners = slugCounts.get(d.slug) || [];
      if (owners.length > 1) {
        out.set(d.id, {
          kind: "duplicate",
          conflictsWith: owners.filter((id) => id !== d.id),
        });
      }
    }
    return out;
  }, [designers]);
}

function buildCandidateSlug(d: SlugHealthDesigner, taken: Set<string>): string {
  const base =
    slugify(d.display_name || d.name || "") || slugify(d.name) || `designer-${d.id.slice(0, 8)}`;
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

interface BadgeProps {
  designer: SlugHealthDesigner;
  issue: SlugIssue;
  allDesigners: SlugHealthDesigner[];
}

/** Small inline badge + one-click safe fix for the broken slug only. */
const SlugHealthBadge = ({ designer, issue, allDesigners }: BadgeProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [overrideCurated, setOverrideCurated] = useState(false);

  const curated = isCuratedSlug(designer);

  const proposedSlug = useMemo(() => {
    const taken = new Set(
      allDesigners
        .filter((d) => d.id !== designer.id && d.slug)
        .map((d) => d.slug as string),
    );
    return buildCandidateSlug(designer, taken);
  }, [designer, allDesigners]);

  const fixMutation = useMutation({
    mutationFn: async () => {
      // Hard guard: never overwrite a curated slug without explicit override.
      if (curated && !overrideCurated) {
        throw new Error(
          "This slug appears to be intentionally curated (e.g. founder-atelier format). Confirm override to proceed.",
        );
      }
      // Soft guard: re-check duplicates server-side at write time.
      const { data: conflict } = await supabase
        .from("designers")
        .select("id")
        .eq("slug", proposedSlug)
        .neq("id", designer.id)
        .maybeSingle();
      if (conflict) {
        throw new Error(`Slug "${proposedSlug}" is already used by another designer.`);
      }
      const { error } = await supabase
        .from("designers")
        .update({ slug: proposedSlug, updated_at: new Date().toISOString() })
        .eq("id", designer.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({
        title: "Slug fixed",
        description: `${designer.display_name || designer.name} → /${proposedSlug}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-designers"] });
      setIsOpen(false);
      setOverrideCurated(false);
    },
    onError: (err: any) => {
      toast({ title: "Fix blocked", description: err.message, variant: "destructive" });
    },
  });

  const label =
    issue.kind === "missing" ? "Missing slug"
      : issue.kind === "invalid" ? "Invalid slug"
        : "Duplicate slug";

  const fixDisabled = fixMutation.isPending || (curated && !overrideCurated);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex items-center"
        aria-label={label}
      >
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 border-destructive/50 text-destructive bg-destructive/5 gap-1"
        >
          <AlertTriangle className="w-3 h-3" />
          {label}
        </Badge>
      </button>
      {isOpen && (
        <div className="absolute z-30 left-0 top-full mt-1 w-80 rounded-md border border-border bg-background p-3 shadow-lg">
          <p className="text-xs text-muted-foreground mb-2">
            Current: <code className="px-1 bg-muted rounded">{designer.slug || "—"}</code>
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Proposed: <code className="px-1 bg-muted rounded">{proposedSlug}</code>
          </p>
          {issue.kind === "duplicate" && (
            <p className="text-[11px] text-destructive mb-3">
              This slug is shared with {issue.conflictsWith.length} other designer(s). Fixing will rename only this row.
            </p>
          )}
          {curated && (
            <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/5 p-2">
              <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium mb-1">Curated slug detected</p>
                  <p className="leading-snug">
                    This slug doesn't match the designer name and may be intentional
                    (e.g. founder-atelier format). Overwriting will break existing public URLs,
                    SEO indexing, and shared links.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-1.5 mt-2 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideCurated}
                  onChange={(e) => setOverrideCurated(e.target.checked)}
                  className="h-3 w-3"
                />
                <span>I understand and want to overwrite anyway</span>
              </label>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={curated ? "destructive" : "default"}
              className="flex-1 h-7 text-xs"
              onClick={() => fixMutation.mutate()}
              disabled={fixDisabled}
            >
              {fixMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : curated ? (
                "Force overwrite"
              ) : (
                "Apply fix"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setIsOpen(false);
                setOverrideCurated(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlugHealthBadge;