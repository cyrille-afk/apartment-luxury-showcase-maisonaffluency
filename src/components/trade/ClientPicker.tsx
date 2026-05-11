import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, User as UserIcon, X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/hooks/useStudio";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export type PickedClient = {
  id: string;
  name: string;
  type: "company" | "studio" | "individual";
  primary_contact?: {
    first_name: string;
    last_name: string;
    role_title: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type Props = {
  /** Currently selected client id (null/undefined when none) */
  value: string | null | undefined;
  /** Called when selection changes. Receives the full client (or null when cleared). */
  onChange: (client: PickedClient | null) => void;
  /** Compact look for headers/dialogs. */
  size?: "sm" | "md";
  /** Visual placeholder when nothing is picked. */
  placeholder?: string;
  /** Disable interactivity (read-only mode). */
  disabled?: boolean;
  /** Show a small "manage" link next to the field. */
  showManageLink?: boolean;
  className?: string;
};

type ClientRow = {
  id: string; name: string; type: PickedClient["type"];
};
type ContactRow = {
  client_id: string; first_name: string; last_name: string;
  role_title: string | null; email: string | null; phone: string | null;
  is_primary: boolean;
};

export default function ClientPicker({
  value, onChange, size = "md", placeholder = "Select a client…",
  disabled, showManageLink = true, className,
}: Props) {
  const { user } = useAuth();
  const { currentStudio, canEdit } = useStudio();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [primaries, setPrimaries] = useState<Record<string, ContactRow | undefined>>({});
  const [picked, setPicked] = useState<PickedClient | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load list when popover opens (or studio changes)
  const refresh = async () => {
    if (!currentStudio) return;
    setLoading(true);
    const { data: cls } = await supabase
      .from("clients" as any)
      .select("id, name, type")
      .eq("studio_id", currentStudio.id)
      .order("name");
    const list = (cls || []) as unknown as ClientRow[];
    setClients(list);
    if (list.length) {
      const { data: cts } = await supabase
        .from("client_contacts" as any)
        .select("client_id, first_name, last_name, role_title, email, phone, is_primary")
        .in("client_id", list.map((c) => c.id))
        .eq("is_primary", true);
      const map: Record<string, ContactRow | undefined> = {};
      ((cts || []) as unknown as ContactRow[]).forEach((c) => { map[c.client_id] = c; });
      setPrimaries(map);
    } else {
      setPrimaries({});
    }
    setLoading(false);
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open, currentStudio?.id]);

  // Resolve currently-selected client (in case it isn't in the loaded page)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!value) { setPicked(null); return; }
      // try cache first
      const cached = clients.find((c) => c.id === value);
      const primary = primaries[value];
      if (cached) {
        setPicked({
          id: cached.id, name: cached.name, type: cached.type,
          primary_contact: primary ? {
            first_name: primary.first_name, last_name: primary.last_name,
            role_title: primary.role_title, email: primary.email, phone: primary.phone,
          } : null,
        });
        return;
      }
      const { data: c } = await supabase.from("clients" as any)
        .select("id, name, type").eq("id", value).maybeSingle();
      if (!c) { if (!cancelled) setPicked(null); return; }
      const { data: ct } = await supabase.from("client_contacts" as any)
        .select("first_name, last_name, role_title, email, phone")
        .eq("client_id", value).eq("is_primary", true).maybeSingle();
      if (cancelled) return;
      setPicked({
        id: (c as any).id, name: (c as any).name, type: (c as any).type,
        primary_contact: ct ? {
          first_name: (ct as any).first_name, last_name: (ct as any).last_name,
          role_title: (ct as any).role_title, email: (ct as any).email, phone: (ct as any).phone,
        } : null,
      });
    })();
    return () => { cancelled = true; };
  }, [value, clients, primaries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      const p = primaries[c.id];
      if (!p) return false;
      return `${p.first_name} ${p.last_name} ${p.email ?? ""}`.toLowerCase().includes(q);
    });
  }, [clients, primaries, search]);

  const exactMatch = useMemo(
    () => clients.some((c) => c.name.trim().toLowerCase() === search.trim().toLowerCase()),
    [clients, search]
  );

  const select = (c: ClientRow) => {
    const p = primaries[c.id];
    const next: PickedClient = {
      id: c.id, name: c.name, type: c.type,
      primary_contact: p ? {
        first_name: p.first_name, last_name: p.last_name,
        role_title: p.role_title, email: p.email, phone: p.phone,
      } : null,
    };
    setPicked(next);
    onChange(next);
    setOpen(false);
    setSearch("");
  };

  const handleCreate = async () => {
    if (!user || !currentStudio || !search.trim()) return;
    if (!canEdit) {
      toast({ title: "You can't create clients in this studio", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("clients" as any)
      .insert({
        studio_id: currentStudio.id,
        created_by: user.id,
        name: search.trim(),
        type: "company",
      })
      .select("id, name, type")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Could not create client", description: error?.message, variant: "destructive" });
      return;
    }
    const row = data as unknown as ClientRow;
    setClients((arr) => [...arr, row].sort((a, b) => a.name.localeCompare(b.name)));
    select(row);
    toast({ title: "Client created", description: "Add contacts in /trade/clients to enrich it." });
  };

  const clear = () => { setPicked(null); onChange(null); };

  const triggerHeight = size === "sm" ? "h-9" : "h-10";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex-1 flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left font-body text-sm",
                "hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed",
                triggerHeight
              )}
            >
              <span className={cn("truncate", !picked && "text-muted-foreground")}>
                {picked ? picked.name : placeholder}
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]"
            onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
          >
            <div className="p-2 border-b border-border">
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or type a new client name…"
                className="h-9"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm font-body text-muted-foreground">
                  No clients match.
                </p>
              ) : (
                filtered.map((c) => {
                  const p = primaries[c.id];
                  const isSel = picked?.id === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => select(c)}
                      className={cn(
                        "w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-accent/40 transition-colors",
                        isSel && "bg-accent/30"
                      )}
                    >
                      <Check className={cn("h-4 w-4 mt-0.5 shrink-0", isSel ? "opacity-100 text-primary" : "opacity-0")} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-body text-sm text-foreground truncate">{c.name}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.type}</span>
                        </div>
                        {p && (
                          <div className="text-xs font-body text-muted-foreground truncate">
                            {[p.first_name, p.last_name].filter(Boolean).join(" ")}
                            {p.email && <> · {p.email}</>}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {canEdit && search.trim() && !exactMatch && (
              <div className="border-t border-border p-2">
                <Button
                  type="button" variant="ghost" size="sm"
                  className="w-full justify-start"
                  onClick={handleCreate} disabled={creating}
                >
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create "{search.trim()}"
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        {picked && !disabled && (
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={clear} aria-label="Clear client">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {picked?.primary_contact && (picked.primary_contact.first_name || picked.primary_contact.email) && (
        <div className="text-xs font-body text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" />
            {[picked.primary_contact.first_name, picked.primary_contact.last_name].filter(Boolean).join(" ") || "—"}
            {picked.primary_contact.role_title && <> · {picked.primary_contact.role_title}</>}
          </span>
          {picked.primary_contact.email && <span>{picked.primary_contact.email}</span>}
          {picked.primary_contact.phone && <span>{picked.primary_contact.phone}</span>}
        </div>
      )}

      {showManageLink && (
        <Link
          to="/trade/clients"
          className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground hover:text-foreground"
        >
          Manage clients <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
