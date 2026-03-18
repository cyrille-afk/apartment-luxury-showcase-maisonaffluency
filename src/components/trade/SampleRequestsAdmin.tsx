import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Package, Clock, CheckCircle, Truck, RotateCcw, X,
  ChevronDown, ImagePlus, Link as LinkIcon, Loader2, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SampleRequest {
  id: string;
  user_id: string;
  product_name: string;
  brand_name: string;
  client_name: string;
  project_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_country: string;
  return_by: string | null;
  notes: string | null;
  admin_notes: string | null;
  tracking_number: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  profile?: { first_name: string; last_name: string; email: string } | null;
}

const STATUSES = ["requested", "approved", "shipped", "delivered", "returned", "cancelled"] as const;

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  requested: { label: "Requested", icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-200" },
  approved: { label: "Approved", icon: CheckCircle, color: "text-blue-600 bg-blue-50 border-blue-200" },
  shipped: { label: "Shipped", icon: Truck, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  delivered: { label: "Delivered", icon: Package, color: "text-green-600 bg-green-50 border-green-200" },
  returned: { label: "Returned", icon: RotateCcw, color: "text-muted-foreground bg-muted border-border" },
  cancelled: { label: "Cancelled", icon: X, color: "text-destructive bg-destructive/10 border-destructive/20" },
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function SampleRequestsAdmin() {
  const { isAdmin } = useAuth();
  const [requests, setRequests] = useState<SampleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAll = async () => {
    const { data } = await supabase
      .from("trade_sample_requests")
      .select("*")
      .order("created_at", { ascending: false });

    const items = (data as any[]) || [];
    const userIds = [...new Set(items.map((i) => i.user_id))];
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);
      if (profiles) profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
    }

    setRequests(items.map((i) => ({ ...i, profile: profileMap[i.user_id] || null })));
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchAll();
    const channel = supabase
      .channel("admin-sample-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_sample_requests" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground">Sample Requests</h2>
        <span className="font-body text-xs text-muted-foreground">{requests.length} total</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground py-6 text-center">No sample requests yet.</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {requests.map((req) => (
            <SampleAdminRow
              key={req.id}
              request={req}
              expanded={expandedId === req.id}
              onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
              onUpdate={fetchAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SampleAdminRow({
  request: req,
  expanded,
  onToggle,
  onUpdate,
}: {
  request: SampleRequest;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: () => void;
}) {
  const cfg = statusConfig[req.status] || statusConfig.requested;
  const StatusIcon = cfg.icon;

  const [status, setStatus] = useState(req.status);
  const [adminNotes, setAdminNotes] = useState(req.admin_notes || "");
  const [trackingNumber, setTrackingNumber] = useState(req.tracking_number || "");
  const [saving, setSaving] = useState(false);

  // Image management
  const [imageUrl, setImageUrl] = useState(req.image_url || "");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("trade_sample_requests")
      .update({
        status,
        admin_notes: adminNotes.trim() || null,
        tracking_number: trackingNumber.trim() || null,
        image_url: imageUrl || null,
      } as any)
      .eq("id", req.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Sample request updated");
      onUpdate();
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `samples/admin/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("assets").upload(path, file, { contentType: file.type });
    if (error) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
    setImageUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Photo uploaded");
  };

  const handleSetUrl = () => {
    if (imageUrlInput.trim()) {
      setImageUrl(imageUrlInput.trim());
      setImageUrlInput("");
      setShowUrlInput(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl("");
  };

  return (
    <div>
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-9 h-9 rounded object-cover border border-border shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded bg-muted/50 border border-border flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-body text-sm text-foreground truncate">{req.product_name}</p>
          <p className="font-body text-[10px] text-muted-foreground truncate">
            {req.brand_name}
            {req.profile && ` · ${req.profile.first_name} ${req.profile.last_name}`}
            {req.client_name && ` · ${req.client_name}`}
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0", cfg.color)}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </span>
        <span className="font-body text-[10px] text-muted-foreground shrink-0">{formatDate(req.created_at)}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 bg-muted/10 border-t border-border/50">
          {/* Request info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-body text-xs text-muted-foreground">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Product</span>
              {req.product_name}
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Brand</span>
              {req.brand_name}
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Client</span>
              {req.client_name || "—"}
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Project</span>
              {req.project_name || "—"}
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Shipping</span>
              {[req.shipping_address, req.shipping_city, req.shipping_country].filter(Boolean).join(", ") || "—"}
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Return By</span>
              {req.return_by ? formatDate(req.return_by) : "—"}
            </div>
            {req.profile && (
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Requester</span>
                <a href={`mailto:${req.profile.email}`} className="text-foreground hover:underline">
                  {req.profile.email}
                </a>
              </div>
            )}
          </div>

          {req.notes && (
            <div>
              <span className="block font-body text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">User Notes</span>
              <p className="font-body text-xs text-muted-foreground italic">"{req.notes}"</p>
            </div>
          )}

          {/* Photo management */}
          <div>
            <span className="block font-body text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Sample Photo</span>
            <div className="flex items-start gap-3">
              {imageUrl ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border shrink-0">
                  <img src={imageUrl} alt="Sample" className="w-full h-full object-cover" />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-foreground/70 text-background hover:bg-foreground transition-colors"
                    title="Remove photo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0">
                  <ImagePlus className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md font-body text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                  Upload Photo
                </button>
                <button
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md font-body text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <LinkIcon className="h-3 w-3" />
                  Paste URL
                </button>
                {showUrlInput && (
                  <div className="flex gap-1.5">
                    <Input
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="h-7 text-xs"
                    />
                    <button
                      onClick={handleSetUrl}
                      className="px-2 py-1 bg-foreground text-background rounded-md font-body text-[10px] hover:bg-foreground/90 shrink-0"
                    >
                      Set
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Admin controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="block font-body text-[10px] uppercase tracking-wider text-muted-foreground/60">Status</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="font-body text-xs capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <span className="block font-body text-[10px] uppercase tracking-wider text-muted-foreground/60">Tracking Number</span>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. SG1234567890"
                className="h-8 text-xs font-body"
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="block font-body text-[10px] uppercase tracking-wider text-muted-foreground/60">Admin Notes</span>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Internal notes about this request..."
              rows={2}
              className="text-xs font-body"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-foreground text-background rounded-md font-body text-xs uppercase tracking-[0.1em] hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
