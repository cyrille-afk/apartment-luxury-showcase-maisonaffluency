import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  productId: string;
  productTitle: string;
  designerDisplay: string;
  /** True only for a vetted, approved trade member. Routes the request to Felix. */
  tradeApproved: boolean;
}

/**
 * "Request Customization" affordance shown below the product details.
 *
 * - Public guests: premium modal that writes a lead to public.custom_inquiries.
 *   No auth, no pricing, no Felix — the concierge is never mounted here.
 * - Approved trade members: skips the form and seeds the Felix composer with a
 *   structural customization brief for the piece in view.
 */
export default function CustomizationRequest({
  productId,
  productTitle,
  designerDisplay,
  tradeApproved,
}: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "",
    email: profile?.email || user?.email || "",
    company: profile?.company || "",
    requirements: "",
  });

  const askFelix = () => {
    window.dispatchEvent(
      new CustomEvent("concierge:stage", {
        detail: {
          openPanel: true,
          prefill: `Bespoke customization request — ${productTitle} by ${designerDisplay}.\n\nFelix, act as my curatorial guide on a made-to-order variation of this piece: bespoke dimensions, alternative finishes/materials, and any structural adaptation. Ask me what I need, then draft the atelier request with feasibility and indicative lead time.`,
        },
      })
    );
  };

  const handleClick = () => {
    if (tradeApproved) {
      askFelix();
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("custom_inquiries").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim() || null,
      requirements: form.requirements.trim(),
      product_id: productId,
      product_title: productTitle,
      designer_name: designerDisplay,
      page_url: typeof window !== "undefined" ? window.location.href : null,
      user_id: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast({
        title: "We couldn't send that",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    setSent(true);
  };

  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      {/* Crawlable statement — plain HTML so search engines index that this
          piece can be made to bespoke dimensions and finishes. */}
      <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed">
        Bespoke dimensions and finishes available upon request
      </p>
      <button
        type="button"
        onClick={handleClick}
        className="mt-2 inline-flex items-center gap-2 font-body text-[11px] md:text-xs uppercase tracking-[0.14em] text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground transition-colors"
      >
        <Wand2 size={13} strokeWidth={1.5} />
        Request Customization
      </button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSent(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Bespoke Customization Inquiry</DialogTitle>
            <DialogDescription className="font-body text-sm leading-relaxed">
              {sent
                ? "Thank you — our atelier team will be in touch shortly."
                : `${productTitle} by ${designerDisplay}. Tell us the dimensions or finishes you have in mind and our atelier team will revert with feasibility and timing.`}
            </DialogDescription>
          </DialogHeader>

          {!sent && (
            <form onSubmit={handleSubmit} className="space-y-3 mt-1">
              <Input
                required
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Textarea
                required
                rows={4}
                placeholder="Custom requests — dimensions, finishes, materials"
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-foreground text-background font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground/90 transition-colors disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Send Inquiry
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
