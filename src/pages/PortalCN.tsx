import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  readPortalSession,
  writePortalSession,
  clearPortalSession,
  type PortalSession,
} from "@/hooks/usePortalSession";

const schema = z.object({
  corporateId: z
    .string()
    .trim()
    .min(2, "请填写有效的机构 ID")
    .max(120, "机构 ID 过长"),
  code: z
    .string()
    .trim()
    .min(4, "邀请码无效")
    .max(64, "邀请码过长"),
});

type Stage = "gate" | "verifying" | "welcome";

export default function PortalCN() {
  const navigate = useNavigate();
  const existing = readPortalSession();
  const [stage, setStage] = useState<Stage>(existing ? "welcome" : "gate");
  const [session, setSession] = useState<PortalSession | null>(existing);
  const [corporateId, setCorporateId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mountedAt] = useState(() => Date.now());

  // Fade-in on mount
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ corporateId, code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "输入无效");
      return;
    }
    // Honeypot: submissions faster than 600ms are rejected.
    if (Date.now() - mountedAt < 600) {
      setError("请稍候再试");
      return;
    }
    setStage("verifying");

    const { data, error: rpcError } = await supabase.rpc("redeem_portal_invite", {
      _code: parsed.data.code,
      _corporate_id: parsed.data.corporateId,
      _user_agent: navigator.userAgent.slice(0, 500),
    });

    if (rpcError || !data) {
      setStage("gate");
      setError("邀请码无效或已过期。请联系您的 Maison Affluency 专属顾问。");
      return;
    }

    const payload = data as any;
    const s: PortalSession = {
      token: payload.token,
      expiresAt: payload.expires_at,
      corporateId: parsed.data.corporateId,
      invitedName: payload.invited_name ?? null,
      invitedCompany: payload.invited_company ?? null,
    };
    writePortalSession(s);
    setSession(s);
    setStage("welcome");
  }

  function handleExit() {
    clearPortalSession();
    setSession(null);
    setStage("gate");
    setCorporateId("");
    setCode("");
  }

  function enterConcierge() {
    navigate("/concierge?lang=zh&auto=1");
  }

  return (
    <div
      className="min-h-[100lvh] w-full bg-[#0a0a0a] text-[#e8e2d5] overflow-hidden relative"
      style={{
        backgroundImage:
          "radial-gradient(1200px 700px at 20% 10%, rgba(31,58,50,0.35), transparent 60%), radial-gradient(900px 600px at 80% 90%, rgba(120,88,46,0.18), transparent 60%)",
      }}
    >
      <Helmet>
        <title>Maison Affluency · 中国精品邀请门户</title>
        <meta name="description" content="Maison Affluency invitation-only portal for elite mainland Chinese interior designers and UHNW collectors." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div
        className={`relative z-10 mx-auto flex min-h-[100lvh] max-w-6xl flex-col items-center justify-center px-6 py-16 transition-opacity duration-700 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Wordmark */}
        <div className="mb-16 text-center">
          <div className="font-serif text-[11px] uppercase tracking-[0.42em] text-[#c9b98a]/80">
            Maison Affluency
          </div>
          <div className="mt-3 h-px w-16 mx-auto bg-[#c9b98a]/40" />
        </div>

        {stage === "gate" && (
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-8"
            autoComplete="off"
          >
            <div className="text-center space-y-3">
              <h1 className="font-serif text-3xl md:text-4xl leading-tight text-[#f4ecd8]">
                私享入口
              </h1>
              <p className="text-sm text-[#e8e2d5]/60 leading-relaxed">
                Invitation only. 仅供受邀设计工作室与私人藏家。
              </p>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.32em] text-[#c9b98a]/70 mb-2">
                  企业 · WeChat Work ID
                </span>
                <input
                  type="text"
                  value={corporateId}
                  onChange={(e) => setCorporateId(e.target.value)}
                  className="w-full bg-transparent border-b border-[#c9b98a]/30 px-0 py-2 text-[#f4ecd8] placeholder:text-[#e8e2d5]/25 focus:outline-none focus:border-[#c9b98a] transition-colors"
                  placeholder="e.g. Studio-Shanghai / wxwork-…"
                  maxLength={120}
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.32em] text-[#c9b98a]/70 mb-2">
                  邀请码 · Invitation Code
                </span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full bg-transparent border-b border-[#c9b98a]/30 px-0 py-2 text-[#f4ecd8] placeholder:text-[#e8e2d5]/25 focus:outline-none focus:border-[#c9b98a] transition-colors tracking-[0.2em]"
                  placeholder="XXXX-XXXX"
                  maxLength={64}
                />
              </label>
            </div>

            {error && (
              <p className="text-xs text-[#d97757] text-center leading-relaxed">{error}</p>
            )}

            <button
              type="submit"
              className="w-full border border-[#c9b98a]/60 hover:border-[#c9b98a] text-[#f4ecd8] hover:text-[#0a0a0a] hover:bg-[#c9b98a] transition-all duration-500 py-3.5 text-[11px] uppercase tracking-[0.42em]"
            >
              进入 · Enter
            </button>

            <p className="text-center text-[10px] text-[#e8e2d5]/35 tracking-wider">
              尚无邀请？请通过您的建筑事务所或家族办公室联系我们。
            </p>
          </form>
        )}

        {stage === "verifying" && (
          <div className="text-center space-y-6">
            <div className="mx-auto h-8 w-8 border-2 border-[#c9b98a]/30 border-t-[#c9b98a] rounded-full animate-spin" />
            <p className="text-xs uppercase tracking-[0.32em] text-[#c9b98a]/70">
              正在核验凭证 · Verifying
            </p>
          </div>
        )}

        {stage === "welcome" && session && (
          <div className="w-full max-w-2xl text-center space-y-10 animate-in fade-in duration-700">
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.42em] text-[#c9b98a]/70">
                Verified Access · 已核验
              </p>
              <h1 className="font-serif text-4xl md:text-5xl leading-tight text-[#f4ecd8]">
                欢迎来到 Maison Affluency
              </h1>
              <p className="font-serif text-lg text-[#e8e2d5]/70 italic">
                Welcome to Maison Affluency
              </p>
              {(session.invitedName || session.invitedCompany) && (
                <p className="text-sm text-[#c9b98a]/80 pt-2">
                  {session.invitedName}
                  {session.invitedName && session.invitedCompany ? " · " : ""}
                  {session.invitedCompany}
                </p>
              )}
            </div>

            <div className="h-px w-24 mx-auto bg-[#c9b98a]/30" />

            <p className="text-sm md:text-base text-[#e8e2d5]/70 leading-loose max-w-xl mx-auto">
              您的私人策展顾问已就绪。请以中文自由描述您的项目、空间或所寻之作，
              <br className="hidden md:block" />
              系统将为您匹配 300+ 位受邀设计师的臻选作品。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <button
                onClick={enterConcierge}
                className="border border-[#c9b98a] bg-[#c9b98a] text-[#0a0a0a] hover:bg-[#d9c99a] transition-all duration-500 px-10 py-3.5 text-[11px] uppercase tracking-[0.42em]"
              >
                开始对话 · Begin
              </button>
              <button
                onClick={() => navigate("/designers")}
                className="border border-[#c9b98a]/40 hover:border-[#c9b98a] text-[#f4ecd8] transition-all duration-500 px-10 py-3.5 text-[11px] uppercase tracking-[0.42em]"
              >
                浏览设计师 · Browse
              </button>
            </div>

            <button
              onClick={handleExit}
              className="text-[10px] uppercase tracking-[0.32em] text-[#e8e2d5]/35 hover:text-[#e8e2d5]/70 transition-colors pt-8"
            >
              退出 · Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
