/**
 * Custom / bespoke product request modal — opened from any TradeProductPage.
 * Captures dimension changes, COM/COL fabric (free-text), finish notes,
 * target lead time, and budget. Persists to trade_custom_requests.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Loader2, Wand2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onClose: () => void;
  product: {
    id?: string | null;
    product_name: string;
    brand_name?: string | null;
  };
};

export default function CustomRequestModal({ open, onClose, product }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [dimensionChanges, setDimensionChanges] = useState("");
  const [finishNotes, setFinishNotes] = useState("");
  const [comColFabric, setComColFabric] = useState("");
  const [yardage, setYardage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [targetLead, setTargetLead] = useState("");
  const [budgetNotes, setBudgetNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Please sign in", description: "Trade login required to submit custom requests.", variant: "destructive" });
      return;
    }
    if (!dimensionChanges && !finishNotes && !comColFabric && !notes) {
      toast({ title: "Add at least one detail", description: "Describe the customisation you need.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("trade_custom_requests").insert({
      user_id: user.id,
      product_id: product.id || null,
      product_name: product.product_name,
      brand_name: product.brand_name || null,
      dimension_changes: dimensionChanges || null,
      finish_notes: finishNotes || null,
      com_col_fabric: comColFabric || null,
      com_yardage_meters: yardage ? Number(yardage) : null,
      quantity: quantity || 1,
      target_lead_weeks: targetLead ? parseInt(targetLead, 10) : null,
      budget_notes: budgetNotes || null,
      notes: notes || null,
      status: "new",
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
      return;
    }
    setSubmitted(true);
    toast({ title: "Custom request sent", description: "Our concierge team will follow up within one business day." });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-lg w-full max-w-2xl my-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 md:p-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Wand2 className="h-4 w-4 text-foreground" />
              <span className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Bespoke Request
              </span>
            </div>
            <h2 className="font-display text-xl md:text-2xl text-foreground tracking-wide">
              Customise {product.product_name}
            </h2>
            {product.brand_name && (
              <p className="font-body text-xs text-muted-foreground mt-1">{product.brand_name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 md:p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 mx-auto flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="font-display text-lg text-foreground tracking-wide mb-2">Request received</h3>
            <p className="font-body text-sm text-muted-foreground max-w-md mx-auto">
              Our concierge will respond within one business day with feasibility, lead time and pricing for your customisation.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => navigate("/trade/custom-requests")}
                className="px-4 py-2 border border-border rounded-md font-body text-xs uppercase tracking-[0.12em] hover:bg-muted transition-colors"
              >
                View all requests
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-foreground text-background rounded-md font-body text-xs uppercase tracking-[0.12em] hover:bg-foreground/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-5">
            <Field label="Dimension changes" hint='e.g. "Make sofa 20cm longer, increase seat depth to 60cm"'>
              <textarea
                value={dimensionChanges}
                onChange={(e) => setDimensionChanges(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:border-foreground/50 outline-none resize-y"
                placeholder="Describe the dimension or proportion changes you need…"
              />
            </Field>

            <Field label="Finish / material" hint='e.g. "Brushed brass legs instead of polished, walnut frame"'>
              <textarea
                value={finishNotes}
                onChange={(e) => setFinishNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:border-foreground/50 outline-none resize-y"
                placeholder="Describe finish or material substitutions…"
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="COM / COL fabric" hint="Mill, collection, ref, colour" wide>
                <input
                  type="text"
                  value={comColFabric}
                  onChange={(e) => setComColFabric(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:border-foreground/50 outline-none"
                  placeholder="e.g. Dedar Karakorum 014"
                />
              </Field>
              <Field label="COM yardage (m)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={yardage}
                  onChange={(e) => setYardage(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:border-foreground/50 outline-none"
                  placeholder="—"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Quantity">
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value || "1", 10))}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:border-foreground/50 outline-none"
                />
              </Field>
              <Field label="Target lead (wks)">
                <input
                  type="number"
                  min={0}
                  value={targetLead}
                  onChange={(e) => setTargetLead(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:border-foreground/50 outline-none"
                  placeholder="—"
                />
              </Field>
              <Field label="Budget notes">
                <input
                  type="text"
                  value={budgetNotes}
                  onChange={(e) => setBudgetNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:border-foreground/50 outline-none"
                  placeholder="—"
                />
              </Field>
            </div>

            <Field label="Additional notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:border-foreground/50 outline-none resize-y"
                placeholder="Project context, deadlines, anything else our concierge should know…"
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-body text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-md font-body text-xs uppercase tracking-[0.12em] hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Submit Request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? "md:col-span-2" : ""}`}>
      <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="font-body text-[11px] text-muted-foreground/70">{hint}</span>}
    </label>
  );
}
