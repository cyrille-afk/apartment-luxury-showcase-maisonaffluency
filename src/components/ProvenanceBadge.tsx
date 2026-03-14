import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, Clock, MapPin, Gem, TrendingUp, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProvenanceEvent {
  id: string;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  location: string | null;
  sort_order: number;
}

interface Certificate {
  id: string;
  designer_id: string;
  piece_title: string;
  edition_number: string | null;
  edition_total: string | null;
  year_created: number | null;
  certificate_number: string | null;
  authenticity_statement: string | null;
  estimated_value_range: string | null;
  appreciation_notes: string | null;
  comparable_references: string | null;
  is_published: boolean;
}

const EVENT_ICONS: Record<string, typeof Award> = {
  creation: Gem,
  exhibition: MapPin,
  acquisition: TrendingUp,
  publication: Award,
  museum: Award,
  award: Award,
  milestone: Clock,
};

interface ProvenanceBadgeProps {
  designerId: string;
  pieceTitle: string;
  className?: string;
}

/**
 * A small badge that indicates a piece has provenance/certificate data.
 * Expands into a full provenance card on click.
 */
export const ProvenanceBadge = ({ designerId, pieceTitle, className }: ProvenanceBadgeProps) => {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasData, setHasData] = useState<boolean | null>(null);

  // Check if certificate exists (lightweight query)
  useEffect(() => {
    supabase
      .from("provenance_certificates")
      .select("id")
      .eq("designer_id", designerId)
      .eq("piece_title", pieceTitle)
      .eq("is_published", true)
      .limit(1)
      .then(({ data }) => {
        setHasData(!!data?.length);
      });
  }, [designerId, pieceTitle]);

  const loadFull = async () => {
    if (loaded) { setExpanded(!expanded); return; }

    const { data: cert } = await supabase
      .from("provenance_certificates")
      .select("*")
      .eq("designer_id", designerId)
      .eq("piece_title", pieceTitle)
      .eq("is_published", true)
      .single();

    if (cert) {
      setCertificate(cert as Certificate);
      const { data: evts } = await supabase
        .from("provenance_events")
        .select("*")
        .eq("certificate_id", cert.id)
        .order("sort_order");
      setEvents((evts as ProvenanceEvent[]) || []);
    }
    setLoaded(true);
    setExpanded(true);
  };

  if (hasData === null || !hasData) return null;

  return (
    <div className={cn("mt-3", className)}>
      {/* Badge */}
      <button
        onClick={loadFull}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group"
      >
        <ShieldCheck className="h-3 w-3 text-primary" />
        <span className="font-body text-[10px] uppercase tracking-[0.1em] text-primary group-hover:text-primary/80">
          Certificate of Authenticity
        </span>
      </button>

      {/* Expanded Certificate */}
      {expanded && certificate && (
        <div className="mt-3 border border-primary/15 rounded-lg bg-background overflow-hidden animate-in slide-in-from-top-2 duration-300">
          {/* Header */}
          <div className="px-4 py-3 bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <span className="font-display text-xs text-foreground">Certificate of Authenticity</span>
            </div>
            {certificate.certificate_number && (
              <p className="font-body text-[10px] text-muted-foreground mt-0.5">No. {certificate.certificate_number}</p>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* Edition & Year */}
            <div className="flex gap-4 flex-wrap">
              {certificate.year_created && (
                <div>
                  <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">Year</span>
                  <p className="font-body text-sm text-foreground">{certificate.year_created}</p>
                </div>
              )}
              {certificate.edition_number && certificate.edition_total && (
                <div>
                  <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">Edition</span>
                  <p className="font-body text-sm text-foreground">{certificate.edition_number} / {certificate.edition_total}</p>
                </div>
              )}
              {certificate.estimated_value_range && (
                <div>
                  <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">Est. Value</span>
                  <p className="font-body text-sm text-primary font-medium">{certificate.estimated_value_range}</p>
                </div>
              )}
            </div>

            {/* Appreciation Notes */}
            {certificate.appreciation_notes && (
              <div className="bg-muted/30 rounded p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Investment Notes</span>
                </div>
                <p className="font-body text-xs text-foreground leading-relaxed">{certificate.appreciation_notes}</p>
                {certificate.comparable_references && (
                  <p className="font-body text-[10px] text-muted-foreground mt-2 italic">{certificate.comparable_references}</p>
                )}
              </div>
            )}

            {/* Timeline */}
            {events.length > 0 && (
              <div>
                <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">Provenance Timeline</span>
                <div className="relative pl-4 border-l border-primary/20 space-y-3">
                  {events.map(evt => {
                    const Icon = EVENT_ICONS[evt.event_type] || Clock;
                    return (
                      <div key={evt.id} className="relative">
                        <div className="absolute -left-[calc(1rem+4px)] top-0.5 w-2 h-2 rounded-full bg-primary/60 border border-background" />
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                          <span className="font-body text-[10px] text-muted-foreground">{evt.event_date}</span>
                          {evt.location && (
                            <span className="font-body text-[10px] text-muted-foreground/60">· {evt.location}</span>
                          )}
                        </div>
                        <p className="font-body text-xs text-foreground">{evt.title}</p>
                        {evt.description && (
                          <p className="font-body text-[10px] text-muted-foreground mt-0.5">{evt.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Authenticity Statement */}
            {certificate.authenticity_statement && (
              <div className="border-t border-border pt-3">
                <p className="font-body text-[10px] text-muted-foreground italic leading-relaxed">{certificate.authenticity_statement}</p>
                <p className="font-body text-[10px] text-primary mt-1.5 font-medium">— Maison Affluency</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvenanceBadge;
