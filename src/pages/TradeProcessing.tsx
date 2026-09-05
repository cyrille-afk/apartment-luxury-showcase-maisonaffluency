import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";

const STATUS_MESSAGES = [
  "Receiving architectural credentials\u2026",
  "Verifying corporate registration data\u2026",
  "Cross-referencing studio portfolio\u2026",
];

type Phase = "processing" | "approved" | "review";

const TradeProcessing = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const applicationId = params.get("app");
  const [phase, setPhase] = useState<Phase>("processing");
  const [messageIndex, setMessageIndex] = useState(0);
  const startedAt = useMemo(() => Date.now(), []);
  const settled = useRef(false);

  // Rotate the status copy while the verification runs.
  useEffect(() => {
    if (phase !== "processing") return;
    const id = window.setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 3200);
    return () => window.clearInterval(id);
  }, [phase]);

  // Poll the application status in the background.
  useEffect(() => {
    if (!applicationId) {
      const t = window.setTimeout(() => setPhase("review"), 10000);
      return () => window.clearTimeout(t);
    }

    let cancelled = false;

    const check = async () => {
      const { data } = await supabase
        .from("trade_applications")
        .select("status")
        .eq("id", applicationId)
        .maybeSingle();

      if (cancelled || settled.current) return;
      const status = data?.status ?? null;

      if (status === "approved") {
        settled.current = true;
        setPhase("approved");
        await supabase.auth.refreshSession().catch(() => undefined);
        window.setTimeout(() => navigate("/trade/dashboard", { replace: true }), 2400);
        return;
      }

      if (Date.now() - startedAt > 10000) {
        settled.current = true;
        setPhase("review");
      }
    };

    void check();
    const id = window.setInterval(() => {
      if (settled.current) return;
      void check();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [applicationId, navigate, startedAt]);

  return (
    <div className="min-h-[100lvh] bg-background text-foreground flex items-center justify-center px-6">
      <Helmet>
        <title>Verifying Your Trade Application | Maison Affluency</title>
        <meta name="description" content="Your trade credentials are being verified by Maison Affluency." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <main className="w-full max-w-xl text-center">
        {phase === "processing" && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-12 h-px w-40 overflow-hidden bg-border">
              <div className="h-px w-1/3 bg-foreground/70 animate-[shimmer-line_1.8s_ease-in-out_infinite]" />
            </div>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight">
              Verifying your credentials
            </h1>
            <p className="mt-8 text-sm md:text-base text-muted-foreground transition-opacity duration-500">
              {STATUS_MESSAGES[messageIndex]}
            </p>
            <p className="mt-16 text-[11px] uppercase tracking-[0.28em] text-muted-foreground/70">
              Maison Affluency &middot; Global Trade Program
            </p>
          </div>
        )}

        {phase === "approved" && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-10 h-px w-40 bg-foreground/60" />
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight">
              Credentials Verified. Welcome to the Network.
            </h1>
            <p className="mt-6 text-sm text-muted-foreground">
              Opening your trade dashboard&hellip;
            </p>
          </div>
        )}

        {phase === "review" && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-10 h-px w-40 bg-border" />
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight">
              Application Under Review
            </h1>
            <p className="mx-auto mt-8 max-w-md text-sm md:text-base leading-relaxed text-muted-foreground">
              To maintain network exclusivity, our team is verifying your studio portfolio.
              Verification is typically finalized within an hour.
            </p>
            <Link
              to="/"
              className="mt-14 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              &larr; Return to Maison Affluency
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default TradeProcessing;
