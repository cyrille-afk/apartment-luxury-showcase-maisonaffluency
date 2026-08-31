import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  /** Product context appended to the inquiry body */
  productTitle?: string;
  designerName?: string;
  /** Called after a successful submission (closes the lightbox) */
  onDone: () => void;
  /** Returns to the Trade Exclusive Access card */
  onBack: () => void;
}

const inputCls =
  "h-11 w-full rounded-none border border-border/60 bg-background px-3 font-body text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground transition-colors";

const fieldLabel =
  "font-body text-[10px] uppercase tracking-widest text-muted-foreground";

/**
 * Elegant offline outreach form shown inside the Trade Exclusive Access
 * lightbox for visitors who prefer a manual enquiry over the trade tools.
 * Delivers through the same `send-inquiry` edge function as the main quote
 * dialog, with a mailto handoff to the concierge inbox.
 */
export default function ManualQuoteForm({ productTitle, designerName, onDone, onBack }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", company: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast({
        title: "Missing Information",
        description: "Name, email and message are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const contextLines = [
      productTitle ? `Product: ${productTitle}` : "",
      designerName ? `Designer: ${designerName}` : "",
      form.company ? `Company: ${form.company}` : "",
    ].filter(Boolean);

    // Fire-and-forget backend tracking (same pipeline as the quote dialog)
    supabase.functions
      .invoke("send-inquiry", {
        body: {
          name: form.name,
          email: form.email,
          firm: form.company,
          message: [...contextLines, "", form.message].join("\n"),
          source: "trade-exclusive-manual",
        },
      })
      .catch(() => {});

    // Manual outreach handoff — opens the visitor's mail client prefilled.
    const subject = encodeURIComponent(
      `Quote Request${productTitle ? ` – ${productTitle}` : ""}${designerName ? ` by ${designerName}` : ""}`
    );
    const mailBody = encodeURIComponent(
      [
        `Name: ${form.name}`,
        form.company ? `Company: ${form.company}` : "",
        `Email: ${form.email}`,
        ...contextLines,
        "",
        form.message,
      ]
        .filter(Boolean)
        .join("\n")
    );
    window.location.href = `mailto:concierge@myaffluency.com?subject=${subject}&body=${mailBody}`;

    toast({
      title: "Enquiry Sent",
      description: "Our team will get back to you within a day.",
    });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in">
      <h3 className="font-body text-xs uppercase tracking-[0.22em] text-foreground text-center">
        Request a Quote
      </h3>
      <p className="mt-2 font-body text-xs font-light leading-relaxed text-muted-foreground text-center">
        Prefer standard outreach? Leave your details and our concierge will
        respond within a day.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="manual-name" className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
            Name
          </label>
          <input
            id="manual-name"
            type="text"
            value={form.name}
            onChange={update("name")}
            autoComplete="name"
            className={cn(inputCls, "mt-1.5")}
            placeholder="Full name"
          />
        </div>
        <div>
          <label htmlFor="manual-company" className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
            Company
          </label>
          <input
            id="manual-company"
            type="text"
            value={form.company}
            onChange={update("company")}
            autoComplete="organization"
            className={cn(inputCls, "mt-1")}
            placeholder="Studio / firm (optional)"
          />
        </div>
        <div>
          <label htmlFor="manual-email" className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
            Email
          </label>
          <input
            id="manual-email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            className={cn(inputCls, "mt-1")}
            placeholder="you@studio.com"
          />
        </div>
        <div>
          <label htmlFor="manual-message" className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
            Message
          </label>
          <textarea
            id="manual-message"
            rows={4}
            value={form.message}
            onChange={update("message")}
            className="mt-1 w-full rounded-none border border-border/60 bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground transition-colors resize-none"
            placeholder="Tell us about the piece, the room, or the project…"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-none bg-foreground text-background font-body text-xs uppercase tracking-widest hover:bg-foreground/85 disabled:opacity-60 transition-colors"
      >
        Send Enquiry
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full text-center font-body text-xs tracking-wider uppercase text-muted-foreground underline underline-offset-4 decoration-border hover:text-foreground hover:decoration-foreground transition-colors"
      >
        Back to Trade Access
      </button>
    </form>
  );
}
