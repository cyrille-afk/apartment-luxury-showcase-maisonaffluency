import { useState, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Save, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface DesignerRow {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  specialty: string;
  biography: string;
  philosophy: string;
  notable_works: string;
  image_url: string;
  source: string;
  is_published: boolean;
}

const TradeDesignersAdmin = () => {
  const { isSuperAdmin, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Record<string, Partial<DesignerRow>>>({});

  const { data: designers = [], isLoading } = useQuery({
    queryKey: ["admin-designers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, name, display_name, specialty, biography, philosophy, notable_works, image_url, source, is_published")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as DesignerRow[];
    },
    enabled: !!isSuperAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DesignerRow> }) => {
      const { error } = await supabase
        .from("designers")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-designers"] });
      setEditBuffer((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({ title: "Saved", description: "Designer updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    let list = designers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.display_name?.toLowerCase().includes(q)) ||
          d.specialty.toLowerCase().includes(q)
      );
    }
    if (activeLetter) {
      list = list.filter((d) => d.name[0]?.toUpperCase() === activeLetter);
    }
    return list;
  }, [designers, search, activeLetter]);

  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    designers.forEach((d) => {
      const letter = d.name[0]?.toUpperCase();
      if (letter) counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }, [designers]);

  const getField = useCallback(
    (id: string, field: keyof DesignerRow) => {
      return (editBuffer[id]?.[field] ?? designers.find((d) => d.id === id)?.[field]) as string;
    },
    [editBuffer, designers]
  );

  const setField = useCallback((id: string, field: keyof DesignerRow, value: string) => {
    setEditBuffer((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }, []);

  const hasChanges = (id: string) => !!editBuffer[id] && Object.keys(editBuffer[id]).length > 0;

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>Designer Editor — Trade Admin</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl tracking-wide">Designer Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {designers.length} designers · Search, filter, and edit biographies inline.
          </p>
        </div>

        {/* Search + A-Z */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or specialty…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveLetter(null);
              }}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveLetter(null)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                !activeLetter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {ALPHABET.map((letter) => {
              const count = letterCounts[letter] || 0;
              return (
                <button
                  key={letter}
                  onClick={() => {
                    setActiveLetter(letter === activeLetter ? null : letter);
                    setSearch("");
                  }}
                  disabled={count === 0}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    activeLetter === letter
                      ? "bg-primary text-primary-foreground"
                      : count > 0
                      ? "bg-muted text-muted-foreground hover:text-foreground"
                      : "bg-muted/50 text-muted-foreground/30 cursor-not-allowed"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No designers match your search.</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((d) => {
              const isOpen = expandedId === d.id;
              const dirty = hasChanges(d.id);

              return (
                <div key={d.id} className="border border-border rounded-sm overflow-hidden">
                  {/* Row header */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : d.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    {d.image_url && (
                      <img
                        src={d.image_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm truncate">{d.display_name || d.name}</span>
                        <Badge variant={d.is_published ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {d.is_published ? "Published" : "Draft"}
                        </Badge>
                        {dirty && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-secondary text-secondary">
                            Unsaved
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{d.specialty}</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {/* Expanded editor */}
                  {isOpen && (
                    <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/10">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Biography</label>
                        <Textarea
                          value={getField(d.id, "biography")}
                          onChange={(e) => setField(d.id, "biography", e.target.value)}
                          rows={10}
                          className="mt-1 font-body text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Philosophy / Pull-quote</label>
                        <Textarea
                          value={getField(d.id, "philosophy")}
                          onChange={(e) => setField(d.id, "philosophy", e.target.value)}
                          rows={3}
                          className="mt-1 font-body text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Specialty</label>
                        <Input
                          value={getField(d.id, "specialty")}
                          onChange={(e) => setField(d.id, "specialty", e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          disabled={!dirty || saveMutation.isPending}
                          onClick={() => saveMutation.mutate({ id: d.id, updates: editBuffer[d.id] })}
                        >
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          Save
                        </Button>
                        {dirty && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditBuffer((prev) => {
                                const next = { ...prev };
                                delete next[d.id];
                                return next;
                              })
                            }
                          >
                            Discard
                          </Button>
                        )}
                        <a
                          href={`/designer/${d.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          Preview <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default TradeDesignersAdmin;
