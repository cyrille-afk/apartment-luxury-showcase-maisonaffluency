import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PARTNERSHIP_HONEYPOT_FIELD,
  PARTNERSHIP_INQUIRY_EMAIL,
  validatePartnershipInquiry,
} from "@/lib/partnershipInquiry";

const EMPTY = {
  name: "",
  company: "",
  email: "",
  phone: "",
  project: "",
  message: "",
  [PARTNERSHIP_HONEYPOT_FIELD]: "",
};

type Status = "idle" | "sending" | "sent" | "failed";

export function PartnershipInquiryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [notice, setNotice] = useState("");

  const set =
    (key: string) =>
    (event: { target: { value: string } }) => {
      setValues((current) => ({ ...current, [key]: event.target.value }));
      setErrors((current) => ({ ...current, [key]: "" }));
    };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === "sending") return;

    const result = validatePartnershipInquiry(values);
    if (!result.ok) {
      // A filled trap field is an automated submission: acknowledge and stop.
      if (result.spam) {
        setStatus("sent");
        return;
      }
      setErrors(result.errors);
      setStatus("failed");
      setNotice("Please check the highlighted fields.");
      return;
    }

    setStatus("sending");
    setNotice("");
    try {
      const response = await fetch("/api/public/partnership-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setStatus("failed");
        setNotice(
          payload.error || "Your inquiry could not be sent. Please try again.",
        );
        return;
      }
      setStatus("sent");
      setValues(EMPTY);
      setErrors({});
    } catch {
      setStatus("failed");
      setNotice("Your inquiry could not be sent. Please try again.");
    }
  };

  const mailto = `mailto:${PARTNERSHIP_INQUIRY_EMAIL}?subject=${encodeURIComponent(
    "Developer partnership enquiry",
  )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pitch-dialog">
        <DialogHeader>
          <DialogTitle className="pitch-dialog-title">
            Partnership inquiry
          </DialogTitle>
          <DialogDescription className="pitch-dialog-subtitle">
            Tell us about the development and we will prepare a tailored
            proposal.
          </DialogDescription>
        </DialogHeader>

        {status === "sent" ? (
          <div className="pitch-dialog-sent" role="status">
            <p className="pitch-dialog-sent-heading">Thank you.</p>
            <p>
              Your inquiry has been sent to Maison Affluency — Developer
              Partnerships.
            </p>
            <p>
              Prefer email? Write to{" "}
              <a className="pitch-dialog-link" href={mailto}>
                {PARTNERSHIP_INQUIRY_EMAIL}
              </a>
              .
            </p>
            <button
              type="button"
              className="pitch-dialog-close-button"
              onClick={() => onOpenChange(false)}
            >
              Close
            </button>
          </div>
        ) : (
          <form className="pitch-form" onSubmit={submit} noValidate>
            <div className="pitch-field">
              <Label htmlFor="partnership-name" className="pitch-label">
                Name
              </Label>
              <Input
                id="partnership-name"
                className="pitch-input"
                value={values.name}
                onChange={set("name")}
                autoComplete="name"
                maxLength={100}
              />
              <p className="pitch-field-error" aria-live="polite">
                {errors.name || "\u00A0"}
              </p>
            </div>

            <div className="pitch-field">
              <Label htmlFor="partnership-company" className="pitch-label">
                Developer / firm
              </Label>
              <Input
                id="partnership-company"
                className="pitch-input"
                value={values.company}
                onChange={set("company")}
                autoComplete="organization"
                maxLength={120}
              />
              <p className="pitch-field-error" aria-live="polite">
                {errors.company || "\u00A0"}
              </p>
            </div>

            <div className="pitch-field-row">
              <div className="pitch-field">
                <Label htmlFor="partnership-email" className="pitch-label">
                  Email
                </Label>
                <Input
                  id="partnership-email"
                  type="email"
                  className="pitch-input"
                  value={values.email}
                  onChange={set("email")}
                  autoComplete="email"
                  maxLength={255}
                />
                <p className="pitch-field-error" aria-live="polite">
                  {errors.email || "\u00A0"}
                </p>
              </div>
              <div className="pitch-field">
                <Label htmlFor="partnership-phone" className="pitch-label">
                  Phone
                </Label>
                <Input
                  id="partnership-phone"
                  className="pitch-input"
                  value={values.phone}
                  onChange={set("phone")}
                  autoComplete="tel"
                  maxLength={30}
                />
                <p className="pitch-field-error" aria-live="polite">
                  {errors.phone || "\u00A0"}
                </p>
              </div>
            </div>

            <div className="pitch-field">
              <Label htmlFor="partnership-project" className="pitch-label">
                Residence or project
              </Label>
              <Input
                id="partnership-project"
                className="pitch-input"
                value={values.project}
                onChange={set("project")}
                maxLength={160}
              />
              <p className="pitch-field-error" aria-live="polite">
                {errors.project || "\u00A0"}
              </p>
            </div>

            <div className="pitch-field">
              <Label htmlFor="partnership-message" className="pitch-label">
                Message
              </Label>
              <Textarea
                id="partnership-message"
                className="pitch-input pitch-textarea"
                value={values.message}
                onChange={set("message")}
                maxLength={2000}
                rows={4}
              />
              <p className="pitch-field-error" aria-live="polite">
                {errors.message || "\u00A0"}
              </p>
            </div>

            {/* Bot trap: hidden from people, filled by automated form fillers. */}
            <div aria-hidden="true" className="pitch-honeypot">
              <label htmlFor="partnership-website">Website</label>
              <Input
                id="partnership-website"
                tabIndex={-1}
                autoComplete="off"
                value={values[PARTNERSHIP_HONEYPOT_FIELD]}
                onChange={set(PARTNERSHIP_HONEYPOT_FIELD)}
              />
            </div>

            {notice && (
              <p className="pitch-form-notice" role="alert">
                {notice}
              </p>
            )}

            <button
              type="submit"
              className="pitch-submit"
              disabled={status === "sending"}
            >
              {status === "sending" ? <Loader2 className="animate-spin" /> : null}
              {status === "sending" ? "Sending…" : "Send inquiry"}
            </button>

            <p className="pitch-form-foot">
              Or write to{" "}
              <a className="pitch-dialog-link" href={mailto}>
                {PARTNERSHIP_INQUIRY_EMAIL}
              </a>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
