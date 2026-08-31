import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACCEPT = ".pdf,.dwg,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const MAX_FILES = 5;
const MAX_MB = 12;

const inputCls =
  "h-12 w-full rounded-none border border-border/60 bg-background px-4 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground transition-colors";
const labelCls =
  "font-body text-[10px] uppercase tracking-widest text-muted-foreground";

const FEATURES = [
  {
    title: "AI Curatorial Co-Pilot",
    description:
      "Instantly draft multi-room client quotes, compile tailored spec sheets, and navigate our extensive design database.",
  },
  {
    title: "Studio Axonometric Service",
    description:
      "Upload your design briefs or floor plans directly to unlock professional architectural layouts and renders prepared for your presentations.",
  },
  {
    title: "Trade Logistics",
    description:
      "Secure exclusive contract margins, check live logistics metrics, and manage live project procurement pipelines.",
  },
];

const MEMBER_TIER_LABEL: Record<string, string> = {
  standard: "Verified Trade Account",
  silver: "Verified Silver Trade Account",
  gold: "Verified Gold Trade Account",
  platinum: "Verified Premium Trade Account",
};


const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

interface Props {
  productTitle?: string;
  designerName?: string;
  redirectTo?: string;
  /** Called after a successful submission (closes the lightbox) */
  onDone: () => void;
}

/**
 * Frictionless lead-gen intake shown inside the quote / customisation
 * lightbox. Collects a work email, a project brief and optional plan files,
 * and — when the email already belongs to a trade account — offers an inline
 * sign-in or one-time-code path instead of a cold submission.
 */
export default function QuoteBriefIntake({
  productTitle,
  designerName,
  redirectTo,
  onDone,
}: Props) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [accountFound, setAccountFound] = useState(false);
  const [memberFirstName, setMemberFirstName] = useState("");
  const [memberTier, setMemberTier] = useState<string>("standard");
  const [checking, setChecking] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  /** Prefer the typed full name, fall back to the account's stored first name. */
  const typedFirst = fullName.trim().split(/\s+/)[0] ?? "";
  const greetingName = typedFirst
    ? typedFirst.charAt(0).toUpperCase() + typedFirst.slice(1).toLowerCase()
    : memberFirstName;

  const q = new URLSearchParams();
  if (redirectTo) q.set("redirect", redirectTo);
  const loginHref = `/trade/login${q.toString() ? `?${q.toString()}` : ""}`;

  /* ---- Returning-user detection (debounced + onBlur) ---- */
  const runCheck = useCallback(async (value: string) => {
    if (!EMAIL_RE.test(value)) {
      setAccountFound(false);
      setCodeSent(false);
      return;
    }
    setChecking(true);
    try {
      const { data } = await supabase.functions.invoke("quote-brief-intake", {
        body: { action: "check_email", email: value },
      });
      setAccountFound(Boolean(data?.exists));
      const rawName = String(data?.firstName ?? "").trim();
      setMemberFirstName(rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : "");
      setMemberTier(String(data?.tier ?? "standard"));
    } catch {
      setAccountFound(false);
      setMemberFirstName("");
      setMemberTier("standard");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setAccountFound(false);
      setCodeSent(false);
      return;
    }
    const t = window.setTimeout(() => void runCheck(value), 550);
    return () => window.clearTimeout(t);
  }, [email, runCheck]);


  const addFiles = useCallback(
    (incoming: FileList | File[] | null) => {
      if (!incoming) return;
      const next: File[] = [];
      for (const f of Array.from(incoming)) {
        if (f.size > MAX_MB * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${f.name} exceeds ${MAX_MB} MB.`,
            variant: "destructive",
          });
          continue;
        }
        next.push(f);
      }
      setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
    },
    [toast],
  );

  const sendCode = async () => {
    setSendingCode(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setCodeSent(true);
      toast({ title: "Code sent", description: "Check your inbox for the verification code." });
    } catch (e: any) {
      toast({
        title: "Could not send code",
        description: e?.message ?? "Please try signing in with your password.",
        variant: "destructive",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCode = async () => {
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      toast({ title: "Signed in", description: "This project is now linked to your workspace." });
      onDone();
    } catch (e: any) {
      toast({
        title: "Invalid code",
        description: e?.message ?? "Please check the code and try again.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      toast({
        title: "Work email required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const payloadFiles = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          type: f.type || "application/octet-stream",
          dataUrl: await fileToDataUrl(f),
        })),
      );
      const { data, error } = await supabase.functions.invoke("quote-brief-intake", {
        body: {
          action: "submit",
          email: value,
          fullName: fullName.trim() || undefined,
          brief,
          files: payloadFiles,
          productName: productTitle,
          designerName,
          pageUrl: window.location.href,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Brief received",
        description: "Our concierge will revert with your quotation shortly.",
      });
      onDone();
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err?.message ?? "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 md:items-stretch">
      {/* ── Column 1 — intake form ── */}
      <div className="p-5 pb-10 md:p-8 md:pb-10 md:border-r md:border-neutral-200">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 md:justify-start">
        <Lock className="h-3 w-3 text-[hsl(var(--gold))]" aria-hidden="true" />
        <span className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Request a Quote or Customisation
        </span>
      </div>
      <p className="mx-auto mt-4 max-w-md text-center font-body text-xs md:mx-0 md:text-left md:text-sm font-light leading-relaxed text-muted-foreground">
        Share your project brief and any floor plans. Our concierge will return a
        tailored quotation — no account required.
      </p>

      {/* Intake form */}
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">

        <div>
          <label htmlFor="brief-fullname" className={labelCls}>
            Full Name (Optional)
          </label>
          <input
            id="brief-fullname"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className={cn(inputCls, "mt-2")}
          />
        </div>

        <div>
          <label htmlFor="brief-email" className={labelCls}>
            Work Email Address
          </label>
          <input
            id="brief-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => void runCheck(e.target.value.trim().toLowerCase())}
            placeholder="you@studio.com"
            className={cn(inputCls, "mt-2")}
          />

          {/* Returning-user split logic */}
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
              accountFound ? "grid-rows-[1fr] opacity-100 mt-3 mb-7" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <div className="rounded-none border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-body text-xs font-light leading-relaxed text-neutral-700">
                  An active trade account is linked to this email address.
                </p>

                {!codeSent ? (
                  <>
                    <button
                      type="button"
                      onClick={sendCode}
                      disabled={sendingCode}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-none bg-foreground px-4 font-body text-[10px] uppercase tracking-widest text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
                    >
                      {sendingCode && <Loader2 className="h-3 w-3 animate-spin" />}
                      Verify via 4-digit secure passcode
                    </button>
                    <Link
                      to={loginHref}
                      className="mt-3 inline-block font-body text-[11px] font-light text-neutral-500 underline underline-offset-4 decoration-[0.5px] decoration-neutral-300 transition-colors hover:text-foreground hover:decoration-foreground"
                    >
                      Or sign in using your account password
                    </Link>
                  </>
                ) : (
                  <div className="mt-4 flex flex-col items-center gap-3">
                    <p className="font-body text-[10px] uppercase tracking-widest text-neutral-500">
                      Enter the passcode sent to {email.trim().toLowerCase()}
                    </p>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      inputMode="numeric"
                      autoFocus
                      placeholder="0000"
                      aria-label="Secure passcode"
                      className="h-12 w-44 rounded-none border border-neutral-300 bg-background text-center font-body text-lg tracking-[0.4em] text-foreground focus:outline-none focus:border-foreground"
                    />
                    <button
                      type="button"
                      onClick={verifyCode}
                      disabled={verifying || code.length < 4}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-none bg-foreground px-4 font-body text-[10px] uppercase tracking-widest text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
                    >
                      {verifying && <Loader2 className="h-3 w-3 animate-spin" />}
                      Sign in &amp; attach brief
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCodeSent(false);
                        setCode("");
                      }}
                      className="font-body text-[11px] font-light text-neutral-500 underline underline-offset-4 decoration-[0.5px] decoration-neutral-300 transition-colors hover:text-foreground"
                    >
                      Back to project brief
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>


        {!codeSent && (
        <>
        <div>
          <label htmlFor="brief-description" className={labelCls}>
            Project Brief Description
          </label>
          <textarea
            id="brief-description"
            rows={4}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Rooms, quantities, finishes, timeline, or customisation required…"
            className="mt-2 w-full resize-none rounded-none border border-border/60 bg-background px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground transition-colors"
          />
        </div>

        <div>
          <span className={labelCls}>Floor Plans / Brief Files</span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            className={cn(
              "mt-2 flex cursor-pointer flex-col items-center justify-center rounded-none border border-dashed px-6 py-8 text-center transition-colors",
              dragging ? "border-foreground bg-muted/50" : "border-border/70 hover:border-foreground/40",
            )}
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" strokeWidth={1.25} />
            <p className="mt-3 font-body text-[11px] uppercase tracking-widest text-muted-foreground">
              Drag &amp; drop or browse
            </p>
            <p className="mt-1 font-body text-[10px] font-light tracking-wide text-muted-foreground/70">
              PDF, DWG, PNG — up to {MAX_FILES} files, {MAX_MB} MB each
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-3 border border-border/50 px-3 py-2"
                >
                  <span className="truncate font-body text-[11px] text-muted-foreground">{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.25} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-13 min-h-[3.25rem] w-full items-center justify-center rounded-none bg-foreground px-4 text-center font-body text-xs uppercase tracking-widest text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
        >
          {submitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {submitting ? "Submitting…" : "Submit Project Brief for Quotation"}
        </button>
        </>
        )}

      </form>
      </div>

      {/* ── Column 2 — dynamic trade info board ── */}
      <aside
        aria-label="Trade information"
        className="border-t border-neutral-200 bg-neutral-50 p-6 pb-10 md:border-t-0 md:p-8 md:pb-12"
      >
        {accountFound ? (
          <div aria-label="Member profile recognized">
            <p className="font-body text-xs font-medium uppercase tracking-widest text-neutral-900">
              Member Profile Recognized
            </p>
            <p className="mt-5 font-body text-xs font-light leading-loose text-neutral-500">
              Welcome back{greetingName ? `, ${greetingName}` : ""}. Upon
              verification or signing in, this project brief and its
              accompanying floor plans will automatically attach to your live
              Maison Affluency Trade Dashboard for immediate procurement staging.
            </p>
            <p className="mt-8 font-body text-[11px] font-light uppercase tracking-widest text-neutral-400">
              Current Tier: {MEMBER_TIER_LABEL[memberTier] ?? MEMBER_TIER_LABEL.standard}
            </p>
          </div>
        ) : (
          <div aria-label="Trade member tools">
            <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Included with a trade account
            </p>
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex flex-col gap-2 border-t border-neutral-200 py-5 first-of-type:mt-5 first-of-type:border-t-0 first-of-type:pt-0">
                <p className="font-body text-[11px] uppercase tracking-widest font-medium text-foreground">
                  {feature.title}
                </p>
                <p className="font-body text-[11px] font-light leading-loose text-neutral-500">
                  {feature.description}
                </p>
              </div>
            ))}
            <Link
              to={loginHref}
              className="mt-4 inline-block font-body text-[10px] uppercase tracking-widest text-muted-foreground underline underline-offset-[6px] decoration-[0.5px] decoration-border transition-colors hover:text-foreground hover:decoration-foreground"
            >
              Already a member? Sign in
            </Link>
          </div>
        )}
      </aside>
    </div>

  );
}
