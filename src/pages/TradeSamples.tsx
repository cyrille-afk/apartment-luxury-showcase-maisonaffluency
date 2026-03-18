import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Package, Plus, Clock, Truck, CheckCircle, RotateCcw, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

interface SampleRequest {
  id: string;
  product_name: string;
  brand_name: string;
  client_name: string;
  project_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_country: string;
  return_by: string | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  tracking_number: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

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

const TradeSamples = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<SampleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Singapore");
  const [returnBy, setReturnBy] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill from URL params (e.g. from curator picks "Request Sample" button)
  useEffect(() => {
    const product = searchParams.get("product");
    const brand = searchParams.get("brand");
    const image = searchParams.get("image");
    if (product || brand) {
      if (product) setProductName(product);
      if (brand) setBrandName(brand);
      if (image) setImagePreview(image);
      setShowForm(true);
      // Clean URL params after reading
      setSearchParams({}, { replace: true });
    }
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("trade_sample_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests((data as unknown as SampleRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel("sample-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_sample_requests" }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const resetForm = () => {
    setProductName(""); setBrandName(""); setClientName(""); setProjectName("");
    setAddress(""); setCity(""); setCountry("Singapore"); setReturnBy(undefined); setNotes("");
    setImageFile(null); setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !productName.trim() || !brandName.trim()) return;
    setSubmitting(true);

    let imageUrl: string | null = null;

    // Upload image if a file was selected, otherwise use pre-filled URL
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `samples/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("assets")
        .upload(path, imageFile, { contentType: imageFile.type });
      if (uploadErr) {
        toast.error("Failed to upload image");
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    } else if (imagePreview && !imageFile) {
      // Pre-filled image URL from curator picks
      imageUrl = imagePreview;
    }

    const { error } = await supabase.from("trade_sample_requests").insert({
      user_id: user.id,
      product_name: productName.trim(),
      brand_name: brandName.trim(),
      client_name: clientName.trim(),
      project_name: projectName.trim(),
      shipping_address: address.trim(),
      shipping_city: city.trim(),
      shipping_country: country.trim(),
      return_by: returnBy ? format(returnBy, "yyyy-MM-dd") : null,
      notes: notes.trim() || null,
      image_url: imageUrl,
    } as any);

    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit request");
      return;
    }
    toast.success("Sample request submitted");
    resetForm();
    setShowForm(false);
  };

  const activeRequests = requests.filter(r => !["returned", "cancelled"].includes(r.status));
  const pastRequests = requests.filter(r => ["returned", "cancelled"].includes(r.status));

  return (
    <>
      <Helmet><title>Samples — Trade Portal — Maison Affluency</title></Helmet>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="font-display text-xl md:text-2xl lg:text-3xl text-foreground">Sample Requests</h1>
            <p className="font-body text-xs md:text-sm text-muted-foreground mt-1">
              Request product samples for your projects
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? "outline" : "default"}
            size="sm"
            className="gap-1.5"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? "Cancel" : "New Request"}
          </Button>
        </div>

        {/* New Request Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="border border-border rounded-lg p-5 md:p-6 mb-8 space-y-4">
            <h2 className="font-display text-base text-foreground mb-1">New Sample Request</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Product Name *</Label>
                <Input value={productName} onChange={e => setProductName(e.target.value)} required placeholder="e.g. Alchemy Side Table" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Brand *</Label>
                <Input value={brandName} onChange={e => setBrandName(e.target.value)} required placeholder="e.g. Elan Atelier" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Client Name</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="End client or firm name" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Project Name</Label>
                <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Sentosa Cove Villa" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Shipping Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-body text-xs">City</Label>
                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Singapore" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Country</Label>
                <Input value={country} onChange={e => setCountry(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Return By</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full md:w-[240px] justify-start text-left font-normal font-body text-sm", !returnBy && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {returnBy ? format(returnBy, "PPP") : "Select return date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={returnBy}
                    onSelect={setReturnBy}
                    disabled={(d) => d < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Reference Photo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("Image must be under 10 MB");
                      return;
                    }
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                }}
              />
              {imagePreview ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-foreground/70 text-background hover:bg-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors font-body text-xs"
                >
                  <ImagePlus className="h-4 w-4" />
                  Attach a photo
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Finish, colour, size preferences or special instructions" rows={3} />
            </div>

            <Button type="submit" disabled={submitting || !productName.trim() || !brandName.trim()} className="w-full md:w-auto">
              {submitting ? "Submitting…" : "Submit Request"}
            </Button>
          </form>
        )}

        {/* Active Requests */}
        {loading ? (
          <div className="border border-border rounded-lg divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 && !showForm ? (
          <div className="border border-dashed border-border rounded-lg p-10 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-body text-sm text-muted-foreground mb-4">No sample requests yet</p>
            <Button onClick={() => setShowForm(true)} variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Request a Sample
            </Button>
          </div>
        ) : (
          <>
            {activeRequests.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-base text-foreground mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Active ({activeRequests.length})
                </h2>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {activeRequests.map(req => <SampleRow key={req.id} request={req} />)}
                </div>
              </div>
            )}

            {pastRequests.length > 0 && (
              <div>
                <h2 className="font-display text-base text-foreground mb-3 text-muted-foreground">
                  Past Requests ({pastRequests.length})
                </h2>
                <div className="border border-border rounded-lg divide-y divide-border opacity-70">
                  {pastRequests.map(req => <SampleRow key={req.id} request={req} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

function SampleRow({ request: req }: { request: SampleRequest }) {
  const cfg = statusConfig[req.status] || statusConfig.requested;
  const StatusIcon = cfg.icon;

  return (
    <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      {req.image_url && (
        <img src={req.image_url} alt={req.product_name} className="w-10 h-10 rounded object-cover border border-border shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-foreground truncate">{req.product_name}</p>
        <p className="font-body text-[10px] text-muted-foreground">
          {req.brand_name}
          {req.client_name && ` · ${req.client_name}`}
          {req.project_name && ` · ${req.project_name}`}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {req.return_by && (
          <span className="font-body text-[10px] text-muted-foreground">
            Return by {formatDate(req.return_by)}
          </span>
        )}
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium", cfg.color)}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </span>
        <span className="font-body text-[10px] text-muted-foreground">
          {formatDate(req.created_at)}
        </span>
      </div>
      {req.tracking_number && (
        <p className="font-body text-[10px] text-muted-foreground">Tracking: {req.tracking_number}</p>
      )}
    </div>
  );
}

export default TradeSamples;
