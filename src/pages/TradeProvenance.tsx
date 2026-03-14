import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff, Award, Clock, MapPin, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import SectionHero from "@/components/trade/SectionHero";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProvenanceEvent {
  id?: string;
  event_date: string;
  event_type: string;
  title: string;
  description: string;
  location: string;
  sort_order: number;
}

interface Certificate {
  id: string;
  designer_id: string;
  piece_title: string;
  edition_number: string;
  edition_total: string;
  year_created: number | null;
  certificate_number: string;
  authenticity_statement: string;
  estimated_value_range: string;
  appreciation_notes: string;
  comparable_references: string;
  is_published: boolean;
  created_at: string;
  events?: ProvenanceEvent[];
}

const EVENT_TYPES = ["creation", "exhibition", "acquisition", "publication", "museum", "award", "milestone"];

const TradeProvenance = () => {
  const { isAdmin, loading, user } = useAuth();
  const { toast } = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<Certificate | null>(null);
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) fetchCertificates();
  }, [isAdmin]);

  const fetchCertificates = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("provenance_certificates")
      .select("*")
      .order("created_at", { ascending: false });
    
    setCertificates((data as Certificate[]) || []);
    setFetching(false);
  };

  const fetchEvents = async (certId: string) => {
    const { data } = await supabase
      .from("provenance_events")
      .select("*")
      .eq("certificate_id", certId)
      .order("sort_order", { ascending: true });
    return (data as ProvenanceEvent[]) || [];
  };

  const startNew = () => {
    setEditing({
      id: "",
      designer_id: "",
      piece_title: "",
      edition_number: "",
      edition_total: "",
      year_created: null,
      certificate_number: "",
      authenticity_statement: "This certificate confirms the authenticity and provenance of this collectible design piece, verified by Maison Affluency.",
      estimated_value_range: "",
      appreciation_notes: "",
      comparable_references: "",
      is_published: false,
      created_at: "",
    });
    setEvents([]);
  };

  const startEdit = async (cert: Certificate) => {
    const evts = await fetchEvents(cert.id);
    setEditing(cert);
    setEvents(evts);
  };

  const addEvent = () => {
    setEvents(prev => [...prev, {
      event_date: "",
      event_type: "milestone",
      title: "",
      description: "",
      location: "",
      sort_order: prev.length,
    }]);
  };

  const updateEvent = (index: number, field: keyof ProvenanceEvent, value: string | number) => {
    setEvents(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const removeEvent = (index: number) => {
    setEvents(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!editing || !editing.designer_id || !editing.piece_title) {
      toast({ title: "Designer ID and piece title are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        designer_id: editing.designer_id,
        piece_title: editing.piece_title,
        edition_number: editing.edition_number || null,
        edition_total: editing.edition_total || null,
        year_created: editing.year_created,
        certificate_number: editing.certificate_number || null,
        authenticity_statement: editing.authenticity_statement,
        estimated_value_range: editing.estimated_value_range || null,
        appreciation_notes: editing.appreciation_notes || null,
        comparable_references: editing.comparable_references || null,
        is_published: editing.is_published,
        created_by: user?.id,
      };

      let certId: string;

      if (editing.id) {
        await supabase.from("provenance_certificates").update(payload).eq("id", editing.id);
        certId = editing.id;

        // Delete existing events and re-insert
        await supabase.from("provenance_events").delete().eq("certificate_id", certId);
      } else {
        const { data, error } = await supabase.from("provenance_certificates").insert(payload).select("id").single();
        if (error) throw error;
        certId = data.id;
      }

      // Insert events
      if (events.length > 0) {
        const eventsPayload = events.map((e, i) => ({
          certificate_id: certId,
          event_date: e.event_date,
          event_type: e.event_type,
          title: e.title,
          description: e.description || null,
          location: e.location || null,
          sort_order: i,
        }));
        await supabase.from("provenance_events").insert(eventsPayload);
      }

      toast({ title: `Certificate ${editing.id ? "updated" : "created"}` });
      setEditing(null);
      setEvents([]);
      fetchCertificates();
    } catch (err: any) {
      toast({ title: "Error saving certificate", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("provenance_certificates").delete().eq("id", id);
    toast({ title: "Certificate deleted" });
    setDeleteConfirm(null);
    fetchCertificates();
  };

  const togglePublish = async (cert: Certificate) => {
    await supabase.from("provenance_certificates").update({ is_published: !cert.is_published }).eq("id", cert.id);
    fetchCertificates();
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  // Editor view
  if (editing) {
    return (
      <>
        <Helmet><title>{editing.id ? "Edit" : "New"} Certificate — Admin — Maison Affluency</title></Helmet>
        <div className="max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-2xl text-foreground">{editing.id ? "Edit" : "New"} Certificate</h1>
            <button onClick={() => { setEditing(null); setEvents([]); }} className="p-2 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Piece Identification */}
            <section className="border border-border rounded-lg p-5 space-y-4">
              <h2 className="font-display text-base text-foreground">Piece Identification</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Designer ID *</label>
                  <input
                    value={editing.designer_id}
                    onChange={e => setEditing({ ...editing, designer_id: e.target.value })}
                    placeholder="e.g. atelier-demichelis"
                    className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground"
                  />
                  <p className="font-body text-[10px] text-muted-foreground/60 mt-1">Must match the designer's id in the codebase</p>
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Piece Title *</label>
                  <input
                    value={editing.piece_title}
                    onChange={e => setEditing({ ...editing, piece_title: e.target.value })}
                    placeholder="e.g. Babel Table Lamp"
                    className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Year Created</label>
                  <input
                    type="number"
                    value={editing.year_created || ""}
                    onChange={e => setEditing({ ...editing, year_created: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Edition Number</label>
                  <input
                    value={editing.edition_number}
                    onChange={e => setEditing({ ...editing, edition_number: e.target.value })}
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Edition Total</label>
                  <input
                    value={editing.edition_total}
                    onChange={e => setEditing({ ...editing, edition_total: e.target.value })}
                    placeholder="e.g. 20"
                    className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">Certificate Number</label>
                <input
                  value={editing.certificate_number}
                  onChange={e => setEditing({ ...editing, certificate_number: e.target.value })}
                  placeholder="e.g. MA-2026-0001"
                  className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground"
                />
              </div>
            </section>

            {/* Investment Data */}
            <section className="border border-border rounded-lg p-5 space-y-4">
              <h2 className="font-display text-base text-foreground">Investment Data</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Estimated Value Range</label>
                  <input
                    value={editing.estimated_value_range}
                    onChange={e => setEditing({ ...editing, estimated_value_range: e.target.value })}
                    placeholder="e.g. SGD 15,000 – 25,000"
                    className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Comparable References</label>
                  <input
                    value={editing.comparable_references}
                    onChange={e => setEditing({ ...editing, comparable_references: e.target.value })}
                    placeholder="e.g. Similar edition sold at Phillips 2025"
                    className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">Appreciation Notes</label>
                <textarea
                  value={editing.appreciation_notes}
                  onChange={e => setEditing({ ...editing, appreciation_notes: e.target.value })}
                  rows={3}
                  placeholder="Market appreciation context, designer trajectory, scarcity factors..."
                  className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground resize-y"
                />
              </div>
            </section>

            {/* Authenticity Statement */}
            <section className="border border-border rounded-lg p-5 space-y-4">
              <h2 className="font-display text-base text-foreground">Authenticity Statement</h2>
              <textarea
                value={editing.authenticity_statement}
                onChange={e => setEditing({ ...editing, authenticity_statement: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded font-body text-sm text-foreground resize-y"
              />
            </section>

            {/* Provenance Timeline */}
            <section className="border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base text-foreground">Provenance Timeline</h2>
                <button onClick={addEvent} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded font-body text-xs text-foreground hover:bg-muted transition-colors">
                  <Plus className="h-3 w-3" /> Add Event
                </button>
              </div>

              {events.length === 0 && (
                <p className="font-body text-xs text-muted-foreground text-center py-4">No timeline events yet. Add events to document the piece's provenance.</p>
              )}

              {events.map((evt, i) => (
                <div key={i} className="border border-border/50 rounded p-4 space-y-3 relative">
                  <button onClick={() => removeEvent(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-body text-[10px] text-muted-foreground block mb-1">Date</label>
                      <input
                        value={evt.event_date}
                        onChange={e => updateEvent(i, "event_date", e.target.value)}
                        placeholder="e.g. 2024 or March 2025"
                        className="w-full px-2 py-1.5 bg-background border border-border rounded font-body text-xs text-foreground"
                      />
                    </div>
                    <div>
                      <label className="font-body text-[10px] text-muted-foreground block mb-1">Type</label>
                      <select
                        value={evt.event_type}
                        onChange={e => updateEvent(i, "event_type", e.target.value)}
                        className="w-full px-2 py-1.5 bg-background border border-border rounded font-body text-xs text-foreground"
                      >
                        {EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="font-body text-[10px] text-muted-foreground block mb-1">Location</label>
                      <input
                        value={evt.location}
                        onChange={e => updateEvent(i, "location", e.target.value)}
                        placeholder="e.g. Paris, France"
                        className="w-full px-2 py-1.5 bg-background border border-border rounded font-body text-xs text-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-body text-[10px] text-muted-foreground block mb-1">Title</label>
                    <input
                      value={evt.title}
                      onChange={e => updateEvent(i, "title", e.target.value)}
                      placeholder="e.g. Exhibited at Maison & Objet"
                      className="w-full px-2 py-1.5 bg-background border border-border rounded font-body text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[10px] text-muted-foreground block mb-1">Description</label>
                    <input
                      value={evt.description}
                      onChange={e => updateEvent(i, "description", e.target.value)}
                      placeholder="Optional details..."
                      className="w-full px-2 py-1.5 bg-background border border-border rounded font-body text-xs text-foreground"
                    />
                  </div>
                </div>
              ))}
            </section>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_published}
                  onChange={e => setEditing({ ...editing, is_published: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="font-body text-xs text-foreground">Publish immediately</span>
              </label>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(null); setEvents([]); }} className="px-4 py-2 border border-border rounded font-body text-xs text-muted-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 bg-foreground text-background rounded font-body text-xs hover:opacity-90 transition-opacity disabled:opacity-50">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save Certificate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // List view
  return (
    <>
      <Helmet><title>Provenance & Certificates — Admin — Maison Affluency</title></Helmet>
      <div className="max-w-4xl">
        <SectionHero
          section="provenance"
          title="Provenance & Certificates"
          subtitle="Manage certificates of authenticity and provenance timelines for collectible pieces."
        />

        <div className="flex justify-end mb-6">
          <button onClick={startNew} className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-full font-body text-xs hover:opacity-90 transition-opacity">
            <Plus className="h-3.5 w-3.5" /> New Certificate
          </button>
        </div>

        {fetching ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-16">
            <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-body text-sm text-muted-foreground">No certificates yet.</p>
            <p className="font-body text-xs text-muted-foreground/60 mt-1">Create your first certificate of authenticity for a collectible piece.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {certificates.map(cert => (
              <div key={cert.id} className="border border-border rounded-lg overflow-hidden">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-display text-sm text-foreground truncate">{cert.piece_title}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${
                        cert.is_published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                      }`}>
                        {cert.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {cert.is_published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="font-body text-xs text-muted-foreground">
                      {cert.designer_id}
                      {cert.certificate_number && ` · ${cert.certificate_number}`}
                      {cert.year_created && ` · ${cert.year_created}`}
                      {cert.estimated_value_range && ` · ${cert.estimated_value_range}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => togglePublish(cert)} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title={cert.is_published ? "Unpublish" : "Publish"}>
                      {cert.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button onClick={() => startEdit(cert)} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(cert.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setExpandedId(expandedId === cert.id ? null : cert.id)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                      {expandedId === cert.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {expandedId === cert.id && (
                  <ExpandedPreview certId={cert.id} cert={cert} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete Certificate</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Are you sure? This will permanently delete this certificate and all its timeline events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction className="font-body text-xs bg-destructive text-destructive-foreground" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Expanded preview that lazy-loads events
const ExpandedPreview = ({ certId, cert }: { certId: string; cert: Certificate }) => {
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("provenance_events")
      .select("*")
      .eq("certificate_id", certId)
      .order("sort_order")
      .then(({ data }) => {
        setEvents((data as ProvenanceEvent[]) || []);
        setLoading(false);
      });
  }, [certId]);

  return (
    <div className="border-t border-border bg-muted/20 p-4 space-y-3">
      {cert.authenticity_statement && (
        <p className="font-body text-xs text-muted-foreground italic">"{cert.authenticity_statement}"</p>
      )}
      {cert.appreciation_notes && (
        <div>
          <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Investment Notes</span>
          <p className="font-body text-xs text-foreground mt-1">{cert.appreciation_notes}</p>
        </div>
      )}
      <div>
        <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Timeline ({events.length} events)</span>
        {loading ? (
          <div className="h-8 bg-muted/30 rounded animate-pulse mt-2" />
        ) : events.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground/60 mt-1">No timeline events.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {events.map(evt => (
              <div key={evt.id} className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <span className="font-body text-[10px] text-muted-foreground">{evt.event_date}</span>
                  <p className="font-body text-xs text-foreground">{evt.title}</p>
                  {evt.location && <p className="font-body text-[10px] text-muted-foreground">{evt.location}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeProvenance;
