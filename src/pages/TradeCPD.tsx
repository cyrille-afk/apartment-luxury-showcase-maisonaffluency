import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, GraduationCap, Calendar, Clock, MapPin, Video, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

export default function TradeCPD() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["cpd-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpd_events")
        .select("*")
        .eq("is_published", true)
        .order("date", { ascending: false });
      return data || [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["cpd-attendance", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpd_attendance")
        .select("event_id, attended")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const registerMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("cpd_attendance")
        .insert({ event_id: eventId, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpd-attendance"] });
      toast.success("Registered successfully");
    },
    onError: () => toast.error("Already registered or error occurred"),
  });

  const attendedIds = new Set(attendance.map((a: any) => a.event_id));

  return (
    <>
      <Helmet><title>CPD & Education — Trade Portal</title></Helmet>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">CPD & Continuing Education</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Designer webinars, material workshops, and brand presentations with attendance tracking.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No events published yet. Check back soon for upcoming workshops and webinars.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event: any) => {
              const isRegistered = attendedIds.has(event.id);
              const isPast = event.date && new Date(event.date) < new Date();
              return (
                <div key={event.id} className="border border-border rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row">
                    {event.thumbnail_url && (
                      <div className="w-full sm:w-48 h-32 sm:h-auto bg-muted shrink-0">
                        <img src={event.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded-full bg-muted text-[9px] font-body uppercase tracking-wider text-muted-foreground mb-2">
                            {event.event_type}
                          </span>
                          <h3 className="font-display text-sm text-foreground">{event.title}</h3>
                          {event.presenter && <p className="font-body text-xs text-muted-foreground mt-0.5">by {event.presenter}</p>}
                        </div>
                        <div>
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-[10px] font-medium">
                              <Check className="h-3 w-3" />Registered
                            </span>
                          ) : !isPast ? (
                            <Button size="sm" variant="outline" onClick={() => registerMutation.mutate(event.id)} disabled={registerMutation.isPending}>
                              Register
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {event.description && <p className="font-body text-xs text-muted-foreground mt-2 line-clamp-2">{event.description}</p>}
                      <div className="flex flex-wrap gap-4 mt-3">
                        {event.date && (
                          <span className="flex items-center gap-1 font-body text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />{format(new Date(event.date), "dd MMM yyyy, HH:mm")}
                          </span>
                        )}
                        {event.duration_minutes && (
                          <span className="flex items-center gap-1 font-body text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />{event.duration_minutes} min
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1 font-body text-[10px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />{event.location}
                          </span>
                        )}
                        {event.video_url && (
                          <a href={event.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-body text-[10px] text-primary hover:underline">
                            <Video className="h-3 w-3" />Watch recording
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
