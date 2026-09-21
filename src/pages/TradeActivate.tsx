import React, { useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hidden, frictionless activation route for pre-approved trade invitations.
 * `/trade/activate?token=<acquisition_lead_id>`
 *
 * Exchanges the invitation token for a live trade session, then hands the
 * studio straight to the AI Curatorial Guide.
 */
const TradeActivate: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = (params.get("token") || "").trim();
    if (!token) {
      navigate("/trade-program", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "activate-trade-invite",
          { body: { token } },
        );
        const payload = data as
          | { ok?: boolean; email?: string; token_hash?: string; founder_name?: string | null }
          | null;

        if (error || !payload?.ok || !payload.token_hash || !payload.email) {
          navigate("/trade-program", { replace: true });
          return;
        }

        const verified = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: payload.token_hash,
        });
        if (verified.error) {
          navigate("/trade-program", { replace: true });
          return;
        }

        try {
          // Force the introductory studio experience: clear any local
          // "already onboarded" flag so the welcome / name-your-copilot
          // overlay runs before the workspace grid is revealed.
          localStorage.removeItem("ma:copilot-onboarded");
          sessionStorage.setItem(
            "ma_activation_welcome",
            JSON.stringify({
              name: payload.founder_name || "",
              at: Date.now(),
            }),
          );
        } catch {
          /* storage optional */
        }

        navigate("/trade/dashboard", { replace: true });
      } catch {
        navigate("/trade-program", { replace: true });
      }
    })();
  }, [params, navigate]);

  return (
    <>
      <Helmet>
        <title>Activating your workspace — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: "#FAF9F6" }}
      >
        <div className="text-center max-w-md">
          <p
            className="text-[11px] uppercase tracking-[0.35em]"
            style={{ color: "#1A1A1A", opacity: 0.55 }}
          >
            Maison Affluency
          </p>
          <h1
            className="mt-8 font-serif text-2xl md:text-3xl leading-snug"
            style={{ color: "#1A1A1A" }}
          >
            Preparing your studio workspace
          </h1>
          <p
            className="mt-4 text-sm leading-relaxed"
            style={{ color: "#1A1A1A", opacity: 0.6 }}
          >
            Activating net trade pricing and tax-exempt invoicing.
          </p>
          <div className="mt-10 mx-auto h-px w-32 overflow-hidden" style={{ backgroundColor: "rgba(26,26,26,0.12)" }}>
            <div className="h-px w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite]" style={{ backgroundColor: "#1A1A1A" }} />
          </div>
        </div>
        <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
      </main>
    </>
  );
};

export default TradeActivate;
