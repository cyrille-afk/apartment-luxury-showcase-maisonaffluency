import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const KEY = "ma_activation_welcome";

/**
 * Temporary sitewide welcome banner shown once, right after a pre-approved
 * studio activates through /trade/activate. Also opens the AI Curatorial
 * Guide when the activation redirect carries ?guide=1.
 */
export const ActivationWelcome: React.FC = () => {
  const [params] = useSearchParams();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(KEY);
      if (raw) sessionStorage.removeItem(KEY);
    } catch {
      /* storage optional */
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { name?: string };
      setName((parsed.name || "").trim() || "there");
    } catch {
      setName("there");
    }
    const t = setTimeout(() => setName(null), 12000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (params.get("guide") !== "1") return;
    const t = setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="Open AI Concierge"]')
        ?.click();
    }, 900);
    return () => clearTimeout(t);
  }, [params]);

  if (!name) return null;

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[60] px-4 py-3 text-center"
      style={{ backgroundColor: "#FAF9F6", borderBottom: "1px solid rgba(26,26,26,0.12)" }}
    >
      <p
        className="text-[12px] md:text-[13px] tracking-wide"
        style={{ color: "#1A1A1A" }}
      >
        ✓ Hello {name}. Your pre-approved studio profile is fully active. Net trade pricing is now live.
      </p>
    </div>
  );
};

export default ActivationWelcome;
