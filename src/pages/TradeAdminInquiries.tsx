import { Helmet } from "react-helmet-async";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Inbox, Mail, Phone, Package, User, Clock, ExternalLink, FileText, X, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type InquiryRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  source: string | null;
  product_id: string | null;
  product_slug: string | null;
  product_name: string | null;
  designer_name: string | null;
  status: string;
  linked_quote_id: string | null;
  admin_notes: string | null;
  assigned_admin_id: string | null;
  concierge_lead_id: string | null;
};

const STATUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "in_review", label: "In review" },
  { key: "quote_drafted", label: "Quote drafted" },
  { key: "ready_to_send", label: "Ready to send" },
  { key: "sent", label: "Sent" },
  { key: "closed", label: "Closed" },
  { key: "rejected", label: "Rejected" },
];

const SOURCE_OPTIONS = [
  { key: "all", label: "All sources" },
  { key: "public_product", label: "Price on Request" },
  { key: "concierge_lead", label: "Concierge chat" },
  { key: "contact_form", label: "Contact form" },
];

const STATUS_STYLES: Record<string, string> = {
  new: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  in_review: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  quote_drafted: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  ready_to_send: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  sent: "bg-emerald-600/10 text-emerald-500 border-emerald-600/20",
  closed: "bg-muted text-muted-foreground border-border",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function TradeAdminInquiries() {
  const { user, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quoteKind, setQuoteKind] = useState<"public" | "trade">("public");
  const [notesDraft, setNotesDraft] = useState<string>("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-inquiries", statusFilter, sourceFilter],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      let query = supabase
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (sourceFilter !== "all") query = query.eq("source", sourceFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as InquiryRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [] as InquiryRow[];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.company, r.product_name, r.designer_name, r.message]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const selected = filtered.find((r) => r.id === selectedId) || filtered[0] || null;

  const updateInquiry = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<InquiryRow> }) => {
      const { error } = await supabase.from("inquiries").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const draftQuote = useMutation({
    mutationFn: async ({ inquiryId, kind }: { inquiryId: string; kind: "public" | "trade" }) => {
      const { data, error } = await supabase.functions.invoke("draft-quote-from-inquiry", {
        body: { inquiryId, quoteKind: kind },
      });
      if (error) throw error;
      return data as { quoteId: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
      toast({ title: "Draft quote created", description: "Opening quote for review…" });
      navigate(`/trade/quotes/${data.quoteId}`);
    },
    onError: (err: any) => toast({ title: "Draft failed", description: err.message, variant: "destructive" }),
  });

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const unread = rows?.filter((r) => r.status === "new").length || 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Inquiries Inbox — Maison Affluency Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-2xl">
              <Inbox className="h-5 w-5 text-accent" />
              Inquiries
              {unread > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{unread}</span>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Price-on-Request submissions, concierge leads, and contact-form messages. Draft a quote and mark it ready when reviewed.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            {SOURCE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, product…"
            className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
          {/* List */}
          <div className="rounded-xl border border-border bg-card/40">
            <div className="max-h-[70vh] overflow-y-auto">
              {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
              {!isLoading && filtered.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">No inquiries match.</div>
              )}
              {filtered.map((r) => {
                const isSel = selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedId(r.id); setNotesDraft(r.admin_notes || ""); }}
                    className={`block w-full border-b border-border/60 px-3 py-3 text-left text-sm transition-colors ${isSel ? "bg-accent/10" : "hover:bg-muted/40"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-heading text-foreground">{r.name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLES[r.status] || "border-border text-muted-foreground"}`}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.product_name ? `${r.product_name}${r.designer_name ? ` · ${r.designer_name}` : ""}` : r.subject || r.email}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      <span>·</span>
                      <span>{r.source?.replace(/_/g, " ") || "form"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail */}
          <div className="rounded-xl border border-border bg-card/40 p-5">
            {!selected && <div className="text-sm text-muted-foreground">Select an inquiry.</div>}
            {selected && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-xl">{selected.name}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLES[selected.status] || "border-border text-muted-foreground"}`}>
                        {selected.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <a className="flex items-center gap-1 hover:text-foreground" href={`mailto:${selected.email}`}>
                        <Mail className="h-3.5 w-3.5" /> {selected.email}
                      </a>
                      {selected.phone && (
                        <a className="flex items-center gap-1 hover:text-foreground" href={`tel:${selected.phone}`}>
                          <Phone className="h-3.5 w-3.5" /> {selected.phone}
                        </a>
                      )}
                      {selected.company && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" /> {selected.company}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })} · {selected.source?.replace(/_/g, " ") || "form"}
                    </div>
                  </div>
                </div>

                {/* Product card */}
                {(selected.product_name || selected.designer_name) && (
                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
                    <Package className="h-4 w-4 text-accent" />
                    <div className="flex-1 text-sm">
                      <div className="font-heading">{selected.product_name || "Unnamed product"}</div>
                      {selected.designer_name && <div className="text-xs text-muted-foreground">{selected.designer_name}</div>}
                    </div>
                    {selected.product_slug && (
                      <a
                        href={`/designers/${(selected.designer_name || "").toLowerCase().replace(/\s+/g, "-")}/${selected.product_slug}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Message */}
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Message</div>
                  <div className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-background/50 p-3 text-sm">
                    {selected.message}
                  </div>
                </div>

                {/* Draft quote panel */}
                <div className="mt-5 rounded-xl border border-accent/40 bg-accent/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-heading">
                    <FileText className="h-4 w-4 text-accent" /> Draft quote
                  </div>
                  {selected.linked_quote_id ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">A draft quote already exists.</span>
                      <button
                        onClick={() => navigate(`/trade/quotes/${selected.linked_quote_id}`)}
                        className="flex items-center gap-1 rounded-md border border-accent/40 px-3 py-1.5 text-xs text-accent hover:bg-accent/10"
                      >
                        Open quote <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <label className="flex items-center gap-1.5">
                          <input type="radio" name="qk" checked={quoteKind === "public"} onChange={() => setQuoteKind("public")} />
                          Public (MSRP)
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="radio" name="qk" checked={quoteKind === "trade"} onChange={() => setQuoteKind("trade")} />
                          Trade
                        </label>
                      </div>
                      <button
                        disabled={draftQuote.isPending}
                        onClick={() => draftQuote.mutate({ inquiryId: selected.id, kind: quoteKind })}
                        className="rounded-md bg-accent px-3 py-1.5 text-xs font-heading text-accent-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {draftQuote.isPending ? "Creating…" : "Generate draft quote"}
                      </button>
                      {!selected.product_id && (
                        <span className="text-xs text-muted-foreground">
                          No product linked — line items will be empty; add them in the quote page.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="mt-5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Admin notes</div>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    onBlur={() => {
                      if (notesDraft !== (selected.admin_notes || "")) {
                        updateInquiry.mutate({ id: selected.id, patch: { admin_notes: notesDraft } });
                      }
                    }}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Internal notes about this inquiry…"
                  />
                </div>

                {/* Status actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {selected.status !== "in_review" && selected.status === "new" && (
                    <button
                      onClick={() => updateInquiry.mutate({ id: selected.id, patch: { status: "in_review" } })}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted/40"
                    >
                      Mark in review
                    </button>
                  )}
                  {selected.linked_quote_id && selected.status !== "ready_to_send" && selected.status !== "sent" && (
                    <button
                      onClick={() => updateInquiry.mutate({ id: selected.id, patch: { status: "ready_to_send" } })}
                      className="flex items-center gap-1 rounded-md bg-emerald-600/90 px-3 py-1.5 text-xs text-white hover:bg-emerald-600"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark ready to send
                    </button>
                  )}
                  {selected.status !== "rejected" && (
                    <button
                      onClick={() => updateInquiry.mutate({ id: selected.id, patch: { status: "rejected" } })}
                      className="flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  )}
                  {selected.status === "ready_to_send" && (
                    <button
                      onClick={() => updateInquiry.mutate({ id: selected.id, patch: { status: "sent" } })}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted/40"
                    >
                      Mark sent
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
