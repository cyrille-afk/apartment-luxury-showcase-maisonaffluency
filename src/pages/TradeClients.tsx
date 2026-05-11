import { useEffect, useState, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Plus, Search, Pencil, Trash2, Star, Building2, User, Mail, Phone, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ClientDocumentsSection from "@/components/trade/ClientDocumentsSection";

type ClientType = "company" | "studio" | "individual";

type Client = {
  id: string;
  studio_id: string;
  created_by: string;
  name: string;
  type: ClientType;
  website: string | null;
  tax_id: string | null;
  default_currency: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_region: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Contact = {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
};

const emptyClient = (studio_id: string, user_id: string): Partial<Client> => ({
  studio_id, created_by: user_id, name: "", type: "company",
  website: "", tax_id: "", default_currency: "",
  billing_address_line1: "", billing_address_line2: "", billing_city: "",
  billing_region: "", billing_postal_code: "", billing_country: "", notes: "",
});

const emptyContact = (client_id: string): Partial<Contact> => ({
  client_id, first_name: "", last_name: "", role_title: "",
  email: "", phone: "", is_primary: false, notes: "",
});

export default function TradeClients() {
  const { user } = useAuth();
  const { currentStudio, canEdit } = useStudio();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [contactsByClient, setContactsByClient] = useState<Record<string, Contact[]>>({});
  const [docCountsByClient, setDocCountsByClient] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Client> | null>(null);
  const [editingContacts, setEditingContacts] = useState<Partial<Contact>[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [attemptedSave, setAttemptedSave] = useState(false);

  // ---------- Validation ----------
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Allow digits, spaces, +, -, (), min 6 digits
  const PHONE_RE = /^[+()\-\s\d]{6,}$/;

  const clientErrors = useMemo(() => {
    const errs: { name?: string; website?: string; default_currency?: string } = {};
    if (!editing) return errs;
    if (!editing.name?.trim()) errs.name = "Name is required.";
    else if (editing.name.trim().length > 120) errs.name = "Keep under 120 characters.";
    if (editing.website && editing.website.trim()) {
      try { new URL(editing.website.trim().startsWith("http") ? editing.website.trim() : `https://${editing.website.trim()}`); }
      catch { errs.website = "Enter a valid URL."; }
    }
    if (editing.default_currency && !/^[A-Z]{3}$/.test(editing.default_currency.trim()))
      errs.default_currency = "Use a 3-letter code (e.g. EUR).";
    return errs;
  }, [editing]);

  const contactErrors = useMemo(() => {
    return editingContacts.map((ct) => {
      const errs: { name?: string; email?: string; phone?: string } = {};
      const hasAny = !!(ct.first_name?.trim() || ct.last_name?.trim() || ct.email?.trim() || ct.phone?.trim() || ct.role_title?.trim());
      if (hasAny && !ct.first_name?.trim() && !ct.last_name?.trim())
        errs.name = "Add a first or last name.";
      if (ct.email && ct.email.trim() && !EMAIL_RE.test(ct.email.trim()))
        errs.email = "Enter a valid email.";
      if (ct.phone && ct.phone.trim() && !PHONE_RE.test(ct.phone.trim()))
        errs.phone = "Enter a valid phone number.";
      return errs;
    });
  }, [editingContacts]);

  const hasErrors = useMemo(() => {
    return Object.keys(clientErrors).length > 0
      || contactErrors.some((e) => Object.keys(e).length > 0);
  }, [clientErrors, contactErrors]);

  const refresh = useCallback(async () => {
    if (!currentStudio) { setClients([]); setContactsByClient({}); setLoading(false); return; }
    setLoading(true);
    const { data: cls, error } = await supabase
      .from("clients" as any)
      .select("*")
      .eq("studio_id", currentStudio.id)
      .order("name");
    if (error) {
      toast({ title: "Failed to load clients", description: error.message, variant: "destructive" });
      setLoading(false); return;
    }
    const list = (cls || []) as unknown as Client[];
    setClients(list);
    if (list.length) {
      const ids = list.map((c) => c.id);
      const { data: cts } = await supabase
        .from("client_contacts" as any)
        .select("*")
        .in("client_id", ids);
      const grouped: Record<string, Contact[]> = {};
      ((cts || []) as unknown as Contact[]).forEach((c) => {
        (grouped[c.client_id] ||= []).push(c);
      });
      // primary first
      Object.values(grouped).forEach((arr) =>
        arr.sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      );
      setContactsByClient(grouped);

      const { data: docs } = await supabase
        .from("client_documents" as any)
        .select("client_id")
        .in("client_id", ids);
      const counts: Record<string, number> = {};
      ((docs || []) as unknown as { client_id: string }[]).forEach((d) => {
        counts[d.client_id] = (counts[d.client_id] || 0) + 1;
      });
      setDocCountsByClient(counts);
    } else {
      setContactsByClient({});
      setDocCountsByClient({});
    }
    setLoading(false);
  }, [currentStudio, toast]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-open edit dialog when navigated with ?edit=<clientId>
  const [autoEditedFor, setAutoEditedFor] = useState<string | null>(null);
  useEffect(() => {
    if (loading || !clients.length) return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId || autoEditedFor === editId) return;
    const found = clients.find((c) => c.id === editId);
    if (found) {
      setEditing({ ...found });
      setEditingContacts((contactsByClient[found.id] || []).map((ct) => ({ ...ct })));
      setAutoEditedFor(editId);
    }
  }, [loading, clients, contactsByClient, autoEditedFor]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      const cts = contactsByClient[c.id] || [];
      return cts.some((ct) =>
        `${ct.first_name} ${ct.last_name} ${ct.email ?? ""}`.toLowerCase().includes(q)
      );
    });
  }, [clients, contactsByClient, search]);

  const openNew = () => {
    if (!user || !currentStudio) return;
    setAttemptedSave(false);
    setEditing(emptyClient(currentStudio.id, user.id));
    setEditingContacts([emptyContact("")]);
  };

  const openEdit = (c: Client) => {
    setAttemptedSave(false);
    setEditing({ ...c });
    setEditingContacts((contactsByClient[c.id] || []).map((ct) => ({ ...ct })));
  };

  const closeEdit = () => { setEditing(null); setEditingContacts([]); setAttemptedSave(false); };

  const addContactRow = () => setEditingContacts((arr) => [...arr, emptyContact(editing?.id || "")]);
  const removeContactRow = (i: number) =>
    setEditingContacts((arr) => arr.filter((_, idx) => idx !== i));
  const updateContact = (i: number, patch: Partial<Contact>) =>
    setEditingContacts((arr) => arr.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setPrimary = (i: number) =>
    setEditingContacts((arr) => arr.map((c, idx) => ({ ...c, is_primary: idx === i })));

  const handleSave = async () => {
    if (!editing || !user || !currentStudio) return;
    setAttemptedSave(true);
    if (hasErrors) {
      toast({ title: "Please fix the highlighted fields.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        studio_id: currentStudio.id,
        created_by: editing.created_by || user.id,
        name: editing.name.trim(),
        type: (editing.type || "company") as ClientType,
        website: editing.website || null,
        tax_id: editing.tax_id || null,
        default_currency: editing.default_currency || null,
        billing_address_line1: editing.billing_address_line1 || null,
        billing_address_line2: editing.billing_address_line2 || null,
        billing_city: editing.billing_city || null,
        billing_region: editing.billing_region || null,
        billing_postal_code: editing.billing_postal_code || null,
        billing_country: editing.billing_country || null,
        notes: editing.notes || null,
      };

      let clientId = editing.id;
      if (clientId) {
        const { error } = await supabase.from("clients" as any).update(payload).eq("id", clientId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("clients" as any).insert(payload).select("id").single();
        if (error) throw error;
        clientId = (data as any).id;
      }

      // Sync contacts: delete removed, upsert remaining
      const existing = contactsByClient[clientId!] || [];
      const keptIds = new Set(editingContacts.map((c) => c.id).filter(Boolean) as string[]);
      const toDelete = existing.filter((c) => !keptIds.has(c.id)).map((c) => c.id);
      if (toDelete.length) {
        await supabase.from("client_contacts" as any).delete().in("id", toDelete);
      }

      // Ensure at most one primary; if none flagged, mark first one if any
      let contacts = editingContacts.filter(
        (c) => (c.first_name?.trim() || c.last_name?.trim() || c.email?.trim() || c.phone?.trim())
      );
      if (contacts.length && !contacts.some((c) => c.is_primary)) {
        contacts = contacts.map((c, i) => ({ ...c, is_primary: i === 0 }));
      }

      // Two-pass to satisfy unique-primary index: clear primaries first then write.
      if (clientId) {
        await supabase.from("client_contacts" as any)
          .update({ is_primary: false }).eq("client_id", clientId);
      }

      for (const ct of contacts) {
        const ctPayload = {
          client_id: clientId!,
          first_name: ct.first_name || "",
          last_name: ct.last_name || "",
          role_title: ct.role_title || null,
          email: ct.email || null,
          phone: ct.phone || null,
          is_primary: !!ct.is_primary,
          notes: ct.notes || null,
        };
        if (ct.id) {
          const { error } = await supabase.from("client_contacts" as any)
            .update(ctPayload).eq("id", ct.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("client_contacts" as any).insert(ctPayload);
          if (error) throw error;
        }
      }

      toast({ title: editing.id ? "Client updated" : "Client created" });
      closeEdit();
      await refresh();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("clients" as any).delete().eq("id", confirmDelete.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Client deleted" });
      setConfirmDelete(null);
      await refresh();
    }
  };

  if (!currentStudio) {
    return (
      <div className="px-4 md:px-12 py-12">
        <Card className="p-8 text-center">
          <p className="font-body text-muted-foreground">
            Select or create a studio to manage shared clients.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-12 py-8 md:py-12 max-w-6xl mx-auto">
      <Helmet>
        <title>Clients — {currentStudio.name}</title>
        <meta name="description" content="Shared clients address book for your studio" />
      </Helmet>

      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-body text-xs uppercase tracking-[0.3em] text-primary mb-2">
            {currentStudio.name}
          </p>
          <h1 className="font-display text-3xl md:text-4xl text-foreground">Clients</h1>
          <p className="font-body text-sm text-muted-foreground mt-2 max-w-xl">
            A shared address book for your studio. Reuse client and contact details across quotes,
            projects and presentations.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="rounded-full">
            <Plus className="h-4 w-4 mr-2" /> New client
          </Button>
        )}
      </header>

      <div className="relative mb-6">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients or contacts…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-body text-muted-foreground">
            {clients.length === 0 ? "No clients yet." : "No clients match your search."}
          </p>
          {canEdit && clients.length === 0 && (
            <Button onClick={openNew} variant="outline" className="mt-4 rounded-full">
              <Plus className="h-4 w-4 mr-2" /> Add your first client
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((c) => {
            const cts = contactsByClient[c.id] || [];
            const primary = cts.find((x) => x.is_primary) || cts[0];
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-xl text-foreground">{c.name}</h3>
                      <Badge variant="secondary" className="capitalize">{c.type}</Badge>
                      {c.billing_country && (
                        <span className="font-body text-xs text-muted-foreground">{c.billing_country}</span>
                      )}
                    </div>
                    {primary && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-body text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          {[primary.first_name, primary.last_name].filter(Boolean).join(" ") || "—"}
                          {primary.role_title && <span className="text-xs"> · {primary.role_title}</span>}
                        </span>
                        {primary.email && (
                          <a href={`mailto:${primary.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                            <Mail className="h-3.5 w-3.5" />{primary.email}
                          </a>
                        )}
                        {primary.phone && (
                          <a href={`tel:${primary.phone}`} className="flex items-center gap-1.5 hover:text-foreground">
                            <Phone className="h-3.5 w-3.5" />{primary.phone}
                          </a>
                        )}
                      </div>
                    )}
                    {cts.length > 1 && (
                      <p className="mt-1 font-body text-xs text-muted-foreground">
                        +{cts.length - 1} other contact{cts.length - 1 > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(c)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit client" : "New client"}</DialogTitle>
            <DialogDescription>
              Visible to all members of {currentStudio.name}.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-6">
              <section className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={editing.name || ""}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="Studio Volpe"
                      aria-invalid={attemptedSave && !!clientErrors.name}
                      className={attemptedSave && clientErrors.name ? "border-destructive" : ""}
                    />
                    {attemptedSave && clientErrors.name && (
                      <p className="text-xs text-destructive mt-1">{clientErrors.name}</p>
                    )}
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={editing.type || "company"}
                      onValueChange={(v) => setEditing({ ...editing, type: v as ClientType })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="studio">Studio</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input
                      value={editing.website || ""}
                      onChange={(e) => setEditing({ ...editing, website: e.target.value })}
                      placeholder="https://…"
                      aria-invalid={attemptedSave && !!clientErrors.website}
                      className={attemptedSave && clientErrors.website ? "border-destructive" : ""}
                    />
                    {attemptedSave && clientErrors.website && (
                      <p className="text-xs text-destructive mt-1">{clientErrors.website}</p>
                    )}
                  </div>
                  <div>
                    <Label>Default currency</Label>
                    <Input
                      value={editing.default_currency || ""}
                      onChange={(e) => setEditing({ ...editing, default_currency: e.target.value.toUpperCase() })}
                      placeholder="EUR"
                      maxLength={3}
                      aria-invalid={attemptedSave && !!clientErrors.default_currency}
                      className={attemptedSave && clientErrors.default_currency ? "border-destructive" : ""}
                    />
                    {attemptedSave && clientErrors.default_currency && (
                      <p className="text-xs text-destructive mt-1">{clientErrors.default_currency}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Tax ID / VAT</Label>
                    <Input
                      value={editing.tax_id || ""}
                      onChange={(e) => setEditing({ ...editing, tax_id: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-body text-sm uppercase tracking-wider text-muted-foreground">
                  Billing address
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Address line 1</Label>
                    <Input
                      value={editing.billing_address_line1 || ""}
                      onChange={(e) => setEditing({ ...editing, billing_address_line1: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Address line 2</Label>
                    <Input
                      value={editing.billing_address_line2 || ""}
                      onChange={(e) => setEditing({ ...editing, billing_address_line2: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={editing.billing_city || ""}
                      onChange={(e) => setEditing({ ...editing, billing_city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Region / State</Label>
                    <Input
                      value={editing.billing_region || ""}
                      onChange={(e) => setEditing({ ...editing, billing_region: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Postal code</Label>
                    <Input
                      value={editing.billing_postal_code || ""}
                      onChange={(e) => setEditing({ ...editing, billing_postal_code: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input
                      value={editing.billing_country || ""}
                      onChange={(e) => setEditing({ ...editing, billing_country: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-body text-sm uppercase tracking-wider text-muted-foreground">
                    Contacts
                  </h4>
                  <Button type="button" variant="outline" size="sm" onClick={addContactRow}>
                    <Plus className="h-3 w-3 mr-1" /> Add contact
                  </Button>
                </div>

                {editingContacts.length === 0 && (
                  <p className="text-sm font-body text-muted-foreground">No contacts yet.</p>
                )}

                {editingContacts.map((ct, i) => (
                  <div key={ct.id || i} className="border border-border rounded-lg p-3 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setPrimary(i)}
                        className={`flex items-center gap-1.5 text-xs font-body ${
                          ct.is_primary ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Mark as primary contact"
                      >
                        <Star className={`h-3.5 w-3.5 ${ct.is_primary ? "fill-current" : ""}`} />
                        {ct.is_primary ? "Primary contact" : "Make primary"}
                      </button>
                      <Button
                        type="button" size="icon" variant="ghost"
                        onClick={() => removeContactRow(i)} aria-label="Remove contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-xs">First name</Label>
                        <Input value={ct.first_name || ""}
                          aria-invalid={attemptedSave && !!contactErrors[i]?.name}
                          className={attemptedSave && contactErrors[i]?.name ? "border-destructive" : ""}
                          onChange={(e) => updateContact(i, { first_name: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Last name</Label>
                        <Input value={ct.last_name || ""}
                          aria-invalid={attemptedSave && !!contactErrors[i]?.name}
                          className={attemptedSave && contactErrors[i]?.name ? "border-destructive" : ""}
                          onChange={(e) => updateContact(i, { last_name: e.target.value })} />
                      </div>
                      {attemptedSave && contactErrors[i]?.name && (
                        <p className="md:col-span-2 -mt-2 text-xs text-destructive">{contactErrors[i].name}</p>
                      )}
                      <div className="md:col-span-2">
                        <Label className="text-xs">Role / Title</Label>
                        <Input value={ct.role_title || ""}
                          onChange={(e) => updateContact(i, { role_title: e.target.value })}
                          placeholder="Project Manager" />
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input type="email" value={ct.email || ""}
                          aria-invalid={attemptedSave && !!contactErrors[i]?.email}
                          className={attemptedSave && contactErrors[i]?.email ? "border-destructive" : ""}
                          onChange={(e) => updateContact(i, { email: e.target.value })} />
                        {attemptedSave && contactErrors[i]?.email && (
                          <p className="text-xs text-destructive mt-1">{contactErrors[i].email}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">Phone</Label>
                        <Input type="tel" value={ct.phone || ""}
                          aria-invalid={attemptedSave && !!contactErrors[i]?.phone}
                          className={attemptedSave && contactErrors[i]?.phone ? "border-destructive" : ""}
                          onChange={(e) => updateContact(i, { phone: e.target.value })} />
                        {attemptedSave && contactErrors[i]?.phone && (
                          <p className="text-xs text-destructive mt-1">{contactErrors[i].phone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              {editing.id && user && (
                <ClientDocumentsSection
                  clientId={editing.id}
                  studioId={editing.studio_id || currentStudio.id}
                  userId={user.id}
                  canEdit={canEdit}
                />
              )}
              {!editing.id && (
                <section className="border border-dashed border-border rounded-lg p-3 text-xs text-muted-foreground font-body">
                  Save the client first to attach documents (NDA, T&Cs, counterparty form…).
                </section>
              )}

              <section>
                <Label>Notes</Label>
                <Textarea
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={3}
                  placeholder="Preferences, billing instructions, key dates…"
                />
              </section>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={closeEdit} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (attemptedSave && hasErrors)}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing?.id ? "Save changes" : "Create client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the client and all its contacts. Quotes and projects already linked
              will keep their saved client name but lose the live link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
