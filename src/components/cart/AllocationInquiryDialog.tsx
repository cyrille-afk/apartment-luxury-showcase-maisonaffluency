import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { AllocationBreach } from "@/config/tradeGuardrails";

export interface AllocationInquiryLine extends AllocationBreach {
  designerName?: string | null;
  finishLabel?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breaches: AllocationInquiryLine[];
  destinationCountry?: string | null;
  defaultEmail?: string | null;
  defaultName?: string | null;
}

/**
 * Allocation Inquiry Request.
 *
 * Restricted pieces cannot be swept through instant checkout; this form routes
 * the request to an advisor who confirms availability and releases quantity.
 */
export function AllocationInquiryDialog({
  open,
  onOpenChange,
  breaches,
  destinationCountry,
  defaultEmail,
  defaultName,
}: Props) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [fullName, setFullName] = useState(defaultName || "");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      toast.error("Please add an email address so an advisor can reply.");
      return;
    }
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const rows = breaches.map((b) => ({
        user_id: auth?.user?.id ?? null,
        email: email.trim(),
        full_name: fullName.trim() || null,
        company: company.trim() || null,
        phone: phone.trim() || null,
        pick_id: b.pickId,
        product_title: b.title,
        designer_name: b.designerName ?? null,
        finish_label: b.finishLabel ?? null,
        requested_quantity: b.requested,
        allocation_cap: b.allowed,
        destination_country: destinationCountry || null,
        intended_use: intendedUse.trim() || null,
        message: message.trim() || null,
      }));
      const { error } = await supabase.from("allocation_inquiries").insert(rows);
      if (error) throw error;
      setSent(true);
      toast.success("Allocation inquiry sent. An advisor will confirm availability.");
    } catch (e: any) {
      toast.error(e?.message || "We couldn't send your inquiry. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal">Allocation Inquiry</DialogTitle>
          <DialogDescription>
            These pieces are produced in strictly limited numbers, so larger quantities are
            released by an advisor rather than at checkout.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
          {breaches.map((b) => (
            <li key={`${b.pickId}-${b.requested}`} className="flex justify-between gap-3">
              <span className="truncate">{b.title}</span>
              <span className="shrink-0 text-muted-foreground">
                {b.requested} requested · {b.allowed} available instantly
              </span>
            </li>
          ))}
        </ul>

        {sent ? (
          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
            <p>
              Thank you — your request is with our allocation desk. You may continue checkout with
              the quantities available instantly in the meantime.
            </p>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="alloc-name">Name</Label>
                <Input id="alloc-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alloc-email">Email</Label>
                <Input
                  id="alloc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alloc-company">Company or studio</Label>
                <Input id="alloc-company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alloc-phone">Phone</Label>
                <Input id="alloc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alloc-use">Project or intended use</Label>
              <Input
                id="alloc-use"
                value={intendedUse}
                onChange={(e) => setIntendedUse(e.target.value)}
                placeholder="Private residence, hospitality project, showroom…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alloc-message">Notes</Label>
              <Textarea
                id="alloc-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Delivery window, finishes, anything the atelier should know."
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={sending}>
              {sending ? "Sending…" : "Request allocation"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
