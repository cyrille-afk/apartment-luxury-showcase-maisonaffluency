import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const DISCIPLINES = [
  { value: "architecture", label: "Architecture" },
  { value: "interior_design", label: "Interior Design" },
  { value: "landscape", label: "Landscape" },
  { value: "lighting_design", label: "Lighting Design" },
  { value: "bespoke_joinery", label: "Bespoke Joinery" },
];

const PROJECT_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "hospitality", label: "Hospitality" },
  { value: "retail", label: "Retail" },
  { value: "yacht", label: "Yacht" },
  { value: "office", label: "Office" },
];

const submissionSchema = z.object({
  studio_name: z.string().trim().min(2, "Studio name is required").max(120),
  contact_name: z.string().trim().min(2, "Your name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(255)
    .url("Enter a valid URL (https://...)")
    .optional()
    .or(z.literal("")),
  instagram: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  portfolio_url: z
    .string()
    .trim()
    .max(255)
    .url("Enter a valid URL (https://...)")
    .optional()
    .or(z.literal("")),
  about: z.string().trim().max(1500).optional().or(z.literal("")),
  notable_projects: z.string().trim().max(1500).optional().or(z.literal("")),
});

type FormState = z.infer<typeof submissionSchema>;

const initial: FormState = {
  studio_name: "",
  contact_name: "",
  email: "",
  phone: "",
  website: "",
  instagram: "",
  location: "",
  country: "",
  portfolio_url: "",
  about: "",
  notable_projects: "",
};

export default function StudioSubmit() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initial);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggle = (list: string[], setList: (v: string[]) => void, val: string) =>
    setList(list.includes(val) ? list.filter((v) => v !== val) : [...list, val]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = submissionSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }
    if (disciplines.length === 0) {
      setErrors({ disciplines: "Select at least one discipline" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        studio_name: parsed.data.studio_name,
        contact_name: parsed.data.contact_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        website: parsed.data.website || null,
        instagram: parsed.data.instagram || null,
        location: parsed.data.location || null,
        country: parsed.data.country || null,
        portfolio_url: parsed.data.portfolio_url || null,
        about: parsed.data.about || null,
        notable_projects: parsed.data.notable_projects || null,
        disciplines,
        project_types: projectTypes,
        user_id: userData.user?.id ?? null,
        user_agent: navigator.userAgent.slice(0, 255),
        referrer: document.referrer ? document.referrer.slice(0, 255) : null,
      };

      const { error } = await supabase.from("studio_submissions").insert(payload);
      if (error) throw error;

      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Could not submit",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="min-h-screen bg-background">
        <Helmet>
          <title>Submission Received | Maison Affluency</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <section className="mx-auto max-w-2xl px-6 py-24 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-foreground" />
          <h1 className="mt-6 font-display text-4xl text-foreground">Thank you</h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Your studio submission has been received. Our editorial team reviews
            new entries within 5–10 working days and will reach out by email if
            we'd like to feature your practice in the directory.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate("/studios")}>Back to Studios</Button>
            <Button variant="outline" onClick={() => navigate("/")}>Home</Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>Submit Your Studio | Maison Affluency Directory</title>
        <meta
          name="description"
          content="Apply to be featured in the Maison Affluency directory of architecture and interior design studios. Tell us about your practice and projects."
        />
        <link rel="canonical" href="https://www.maisonaffluency.com/studios/submit" />
      </Helmet>

      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
          <Link
            to="/studios"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Studios
          </Link>
          <p className="mt-6 text-xs uppercase tracking-[0.25em] text-muted-foreground">
            The Directory
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-foreground leading-tight">
            Submit Your Studio
          </h1>
          <p className="mt-5 max-w-2xl text-muted-foreground leading-relaxed">
            We curate a small directory of architecture and interior design
            practices. Share a few details about your studio — our editorial
            team will be in touch if it's a fit.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <form onSubmit={onSubmit} className="space-y-10">
          <Fieldset title="Studio">
            <Field label="Studio name *" error={errors.studio_name}>
              <Input value={form.studio_name} onChange={set("studio_name")} maxLength={120} required />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="City" error={errors.location}>
                <Input value={form.location} onChange={set("location")} maxLength={120} />
              </Field>
              <Field label="Country" error={errors.country}>
                <Input value={form.country} onChange={set("country")} maxLength={80} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Website" error={errors.website}>
                <Input
                  value={form.website}
                  onChange={set("website")}
                  placeholder="https://"
                  inputMode="url"
                  maxLength={255}
                />
              </Field>
              <Field label="Instagram" error={errors.instagram}>
                <Input value={form.instagram} onChange={set("instagram")} placeholder="@handle" maxLength={120} />
              </Field>
            </div>
            <Field label="Portfolio link (PDF or page)" error={errors.portfolio_url}>
              <Input
                value={form.portfolio_url}
                onChange={set("portfolio_url")}
                placeholder="https://"
                inputMode="url"
                maxLength={255}
              />
            </Field>
          </Fieldset>

          <Fieldset title="Disciplines & project types">
            <CheckGroup
              label="Disciplines *"
              options={DISCIPLINES}
              selected={disciplines}
              onToggle={(v) => toggle(disciplines, setDisciplines, v)}
              error={errors.disciplines}
            />
            <CheckGroup
              label="Project types"
              options={PROJECT_TYPES}
              selected={projectTypes}
              onToggle={(v) => toggle(projectTypes, setProjectTypes, v)}
            />
          </Fieldset>

          <Fieldset title="About your practice">
            <Field label="Short bio (1–2 paragraphs)" error={errors.about}>
              <Textarea
                value={form.about}
                onChange={set("about")}
                rows={5}
                maxLength={1500}
                placeholder="Tell us about your studio's philosophy, materials and signature approach."
              />
            </Field>
            <Field label="Notable projects" error={errors.notable_projects}>
              <Textarea
                value={form.notable_projects}
                onChange={set("notable_projects")}
                rows={4}
                maxLength={1500}
                placeholder="A few recent projects (name, location, year)."
              />
            </Field>
          </Fieldset>

          <Fieldset title="Contact">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Your name *" error={errors.contact_name}>
                <Input value={form.contact_name} onChange={set("contact_name")} maxLength={120} required />
              </Field>
              <Field label="Email *" error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  maxLength={255}
                  required
                />
              </Field>
            </div>
            <Field label="Phone (optional)" error={errors.phone}>
              <Input value={form.phone} onChange={set("phone")} inputMode="tel" maxLength={40} />
            </Field>
          </Fieldset>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit studio"}
            </Button>
            <p className="text-xs text-muted-foreground">
              By submitting, you agree we may contact you about your application.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 className="font-display text-xl text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CheckGroup({
  label,
  options,
  selected,
  onToggle,
  error,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <label
              key={o.value}
              className={`flex items-center gap-2 px-3 py-2 border cursor-pointer transition-colors text-sm ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-foreground hover:border-foreground"
              }`}
            >
              <Checkbox
                checked={active}
                onCheckedChange={() => onToggle(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
