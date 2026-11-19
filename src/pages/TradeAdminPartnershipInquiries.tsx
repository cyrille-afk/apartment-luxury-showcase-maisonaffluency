import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "@/lib/router-compat";
import { Inbox, Mail, Phone } from "lucide-react";

type PartnershipInquiryRow = {
  id: string;
  created_at: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  project: string;
  message: string;
  source: string;
};

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TradeAdminPartnershipInquiries() {
  const { isAdmin, rolesLoaded } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["partnership-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partnership_inquiries")
        .select("id, created_at, name, company, email, phone, project, message, source")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as PartnershipInquiryRow[];
    },
    enabled: isAdmin,
  });

  if (!rolesLoaded) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-muted-foreground" />
        <h1 className="font-display text-base text-foreground">
          Partnership Inquiries
        </h1>
        <span className="font-body text-[10px] text-muted-foreground">
          Developer-partnership messages from the pitch page
        </span>
      </div>

      {isLoading && (
        <p className="font-body text-[11px] text-muted-foreground">Loading…</p>
      )}
      {error && (
        <p className="font-body text-[11px] text-destructive">
          Partnership inquiries could not be loaded. Please reload the page.
        </p>
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <p className="font-body text-[11px] text-muted-foreground">
          No partnership inquiries yet.
        </p>
      )}

      {(data ?? []).map((row) => (
        <article
          key={row.id}
          className="rounded-lg border border-border p-4 space-y-2"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-sm text-foreground">
                {row.name}
              </span>
              {row.company && (
                <span className="font-body text-[10px] text-muted-foreground">
                  {row.company}
                </span>
              )}
            </div>
            <span className="font-body text-[10px] text-muted-foreground">
              {when(row.created_at)}
            </span>
          </header>

          <div className="flex flex-wrap gap-4 font-body text-[11px]">
            <a
              href={`mailto:${row.email}`}
              className="inline-flex items-center gap-1 text-foreground underline underline-offset-2"
            >
              <Mail className="h-3 w-3" />
              {row.email}
            </a>
            {row.phone && (
              <a
                href={`tel:${row.phone}`}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-3 w-3" />
                {row.phone}
              </a>
            )}
            {row.project && (
              <span className="text-muted-foreground">{row.project}</span>
            )}
          </div>

          <p className="font-body text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
            {row.message}
          </p>
        </article>
      ))}
    </div>
  );
}
