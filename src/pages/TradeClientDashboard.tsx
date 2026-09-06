import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";

/**
 * Fully isolated Trade client portal.
 * All styling is local to this file — no global CSS, no shared components.
 */

const NICKNAME_KEY = "ma:trade-portal-copilot-name";
const ONBOARDED_KEY = "ma:trade-portal-onboarded";

const INK = "#1B1B19";
const PAPER = "#FAF9F5";
const LINE = "rgba(27,27,25,0.12)";
const MUTED = "rgba(27,27,25,0.55)";
const JADE = "#1F3D36";

const serif = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

type Tab = "scanner" | "presentation" | "chat";

type ScanResult = {
  id: string;
  name: string;
  maker: string;
  material: string;
  lead: string;
  trade: string;
  rrp: string;
  tone: string;
};

const SCAN_RESULTS: ScanResult[] = [
  { id: "1", name: "Cinnamon Gardens Floor Lamp", maker: "Man of Parts", material: "Blackened brass · Mist ash", lead: "10–16 weeks", trade: "€4,554", rrp: "€4,950", tone: "#3A3733" },
  { id: "2", name: "Sengu Lounge Chair", maker: "Cassina", material: "Bouclé · Walnut frame", lead: "12 weeks", trade: "€5,244", rrp: "€5,700", tone: "#8C7B68" },
  { id: "3", name: "Alba Travertine Table", maker: "Alinea Design Objects", material: "Silver travertine", lead: "14–18 weeks", trade: "€7,268", rrp: "€7,900", tone: "#BFB3A2" },
  { id: "4", name: "Ondine Wall Sconce", maker: "Veronese", material: "Hand-blown glass", lead: "16 weeks", trade: "€2,806", rrp: "€3,050", tone: "#5C6B66" },
];

const SCAN_STEPS = [
  "Reading composition and palette…",
  "Analyzing textures and geometry…",
  "Matching against the Maison portfolio…",
];

/* ---------------------------------- UI bits --------------------------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: sans,
        fontSize: 9.5,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: MUTED,
      }}
    >
      {children}
    </span>
  );
}

function Onboarding({ onDone }: { onDone: (name: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 2) inputRef.current?.focus();
  }, [step]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(27,27,25,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 4,
          padding: "48px 40px",
          textAlign: "center",
          boxShadow: "0 40px 120px rgba(0,0,0,0.28)",
        }}
      >
        <Eyebrow>Maison Affluency · Trade Portal</Eyebrow>

        {step === 1 ? (
          <>
            <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.25, color: INK, margin: "20px 0 0", fontWeight: 400 }}>
              Welcome to the Maison.
            </h2>
            <p style={{ fontFamily: sans, fontSize: 13.5, lineHeight: 1.7, color: MUTED, margin: "14px auto 0", maxWidth: 380 }}>
              To help you manage your architectural projects, your digital concierge is ready.
            </p>
            <button
              onClick={() => setStep(2)}
              style={{
                marginTop: 32,
                padding: "13px 30px",
                background: INK,
                color: PAPER,
                border: "none",
                borderRadius: 2,
                fontFamily: sans,
                fontSize: 10.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Meet your copilot
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: serif, fontSize: 28, lineHeight: 1.3, color: INK, margin: "20px 0 0", fontWeight: 400 }}>
              Name your copilot.
            </h2>
            <p style={{ fontFamily: sans, fontSize: 13.5, lineHeight: 1.7, color: MUTED, margin: "14px auto 0", maxWidth: 400 }}>
              We call him Felix, but every great design studio operates differently. What would you like to call your AI
              curation copilot?
            </p>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onDone(value.trim() || "Felix")}
              placeholder="e.g., Felix, Pierre, Assistant"
              style={{
                marginTop: 26,
                width: "100%",
                padding: "13px 14px",
                background: "transparent",
                border: `1px solid ${LINE}`,
                borderRadius: 2,
                fontFamily: sans,
                fontSize: 13.5,
                color: INK,
                outline: "none",
                textAlign: "center",
              }}
            />
            <button
              onClick={() => onDone(value.trim() || "Felix")}
              style={{
                marginTop: 20,
                width: "100%",
                padding: "13px 30px",
                background: INK,
                color: PAPER,
                border: "none",
                borderRadius: 2,
                fontFamily: sans,
                fontSize: 10.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Initialize Copilot
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Modules --------------------------------- */

function MoodboardScanner({
  onAdd,
  added,
}: {
  onAdd: (r: ScanResult) => void;
  added: string[];
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const run = useCallback((name: string) => {
    setFileName(name);
    setState("loading");
    setStepIdx(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      if (i >= SCAN_STEPS.length) {
        window.clearInterval(t);
        setState("done");
      } else setStepIdx(i);
    }, 1100);
  }, []);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          run(e.dataTransfer.files?.[0]?.name ?? "moodboard.jpg");
        }}
        style={{
          border: `1px dashed ${dragging ? INK : LINE}`,
          background: dragging ? "rgba(27,27,25,0.03)" : "transparent",
          borderRadius: 3,
          padding: "56px 24px",
          textAlign: "center",
          transition: "border-color .2s, background .2s",
        }}
      >
        <Eyebrow>Moodboard Scanner</Eyebrow>
        <p style={{ fontFamily: serif, fontSize: 22, color: INK, margin: "12px 0 6px" }}>
          {state === "loading" ? SCAN_STEPS[stepIdx] : "Drop a moodboard to source it."}
        </p>
        <p style={{ fontFamily: sans, fontSize: 12, color: MUTED, margin: 0 }}>
          {fileName ? fileName : "Drag an image anywhere in this frame — JPG, PNG or PDF."}
        </p>

        {state === "loading" && (
          <div style={{ margin: "24px auto 0", width: 180, height: 1, background: LINE, overflow: "hidden" }}>
            <div
              style={{
                width: "40%",
                height: "100%",
                background: INK,
                animation: "ma-portal-shimmer 1.4s ease-in-out infinite",
              }}
            />
          </div>
        )}

        {state === "idle" && (
          <button
            onClick={() => run("studio-moodboard.jpg")}
            style={{
              marginTop: 22,
              padding: "10px 22px",
              background: "transparent",
              border: `1px solid ${LINE}`,
              borderRadius: 2,
              fontFamily: sans,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: INK,
              cursor: "pointer",
            }}
          >
            Use a sample board
          </button>
        )}
      </div>

      {state === "done" && (
        <div style={{ marginTop: 28 }}>
          <Eyebrow>4 matches · Trade pricing applied</Eyebrow>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            }}
          >
            {SCAN_RESULTS.map((r) => (
              <div key={r.id} style={{ border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden", background: "#fff" }}>
                <div style={{ height: 120, background: r.tone }} />
                <div style={{ padding: 14 }}>
                  <Eyebrow>{r.maker}</Eyebrow>
                  <p style={{ fontFamily: serif, fontSize: 17, color: INK, margin: "6px 0 4px", lineHeight: 1.3 }}>{r.name}</p>
                  <p style={{ fontFamily: sans, fontSize: 11, color: MUTED, margin: 0 }}>{r.material}</p>
                  <p style={{ fontFamily: sans, fontSize: 11, color: MUTED, margin: "4px 0 10px" }}>Lead time {r.lead}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: sans, fontSize: 13, color: INK, fontWeight: 500 }}>{r.trade}</span>
                    <span style={{ fontFamily: sans, fontSize: 11, color: MUTED, textDecoration: "line-through" }}>{r.rrp}</span>
                  </div>
                  <button
                    onClick={() => onAdd(r)}
                    disabled={added.includes(r.id)}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      padding: "9px 0",
                      background: added.includes(r.id) ? "transparent" : INK,
                      color: added.includes(r.id) ? MUTED : PAPER,
                      border: added.includes(r.id) ? `1px solid ${LINE}` : "none",
                      borderRadius: 2,
                      fontFamily: sans,
                      fontSize: 9.5,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: added.includes(r.id) ? "default" : "pointer",
                    }}
                  >
                    {added.includes(r.id) ? "In project" : "Add to project"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Presentation({ items, name }: { items: ScanResult[]; name: string }) {
  const [state, setState] = useState<"idle" | "building" | "ready">("idle");

  const compile = () => {
    setState("building");
    window.setTimeout(() => setState("ready"), 1800);
  };

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 3, padding: "40px 32px" }}>
      <Eyebrow>Bespoke Presentation</Eyebrow>
      <p style={{ fontFamily: serif, fontSize: 24, color: INK, margin: "10px 0 6px" }}>
        Compile your active project into a client-ready document.
      </p>
      <p style={{ fontFamily: sans, fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.7 }}>
        {items.length
          ? `${items.length} piece${items.length > 1 ? "s" : ""} selected — ${name} will lay out tearsheets, finishes and trade pricing.`
          : `No pieces yet. Scan a moodboard and ${name} will assemble the presentation for you.`}
      </p>

      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 0" }}>
          {items.map((i) => (
            <li
              key={i.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                padding: "11px 0",
                borderTop: `1px solid ${LINE}`,
                fontFamily: sans,
                fontSize: 12.5,
                color: INK,
              }}
            >
              <span>
                {i.name} <span style={{ color: MUTED }}>· {i.maker}</span>
              </span>
              <span>{i.trade}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={compile}
        disabled={!items.length || state === "building"}
        style={{
          marginTop: 26,
          padding: "13px 30px",
          background: items.length ? INK : "transparent",
          color: items.length ? PAPER : MUTED,
          border: items.length ? "none" : `1px solid ${LINE}`,
          borderRadius: 2,
          fontFamily: sans,
          fontSize: 10.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          cursor: items.length && state !== "building" ? "pointer" : "default",
        }}
      >
        {state === "building" ? "Compiling…" : state === "ready" ? "Regenerate presentation" : "Compile presentation"}
      </button>

      {state === "ready" && (
        <p style={{ fontFamily: sans, fontSize: 12, color: JADE, margin: "16px 0 0" }}>
          Presentation ready — {items.length} tearsheets, cover page and FF&amp;E summary.
        </p>
      )}
    </div>
  );
}

function DirectChat({ name }: { name: string }) {
  const [messages, setMessages] = useState<{ role: "you" | "ai"; text: string }[]>([
    { role: "ai", text: `Good day. I'm ${name}. Tell me about the room you're specifying and I'll source it.` },
  ]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "you", text }]);
    setDraft("");
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: `Noted. I'd propose a hand-blown glass sconce paired with a travertine console — both within a 14-week lead time and at your trade tier. Shall I add them to the project and draft the tearsheets?`,
        },
      ]);
    }, 1400);
  };

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 3, display: "flex", flexDirection: "column", height: 460 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${LINE}` }}>
        <Eyebrow>Direct Chat · {name}</Eyebrow>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "you" ? "flex-end" : "flex-start", marginBottom: 14 }}>
            <div
              style={{
                maxWidth: "72%",
                padding: "11px 14px",
                borderRadius: 3,
                background: m.role === "you" ? INK : "rgba(27,27,25,0.04)",
                color: m.role === "you" ? PAPER : INK,
                fontFamily: sans,
                fontSize: 13,
                lineHeight: 1.65,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <p style={{ fontFamily: sans, fontSize: 11.5, color: MUTED, margin: 0 }}>{name} is composing…</p>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 10, padding: 16, borderTop: `1px solid ${LINE}` }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Ask ${name} for a specification…`}
          style={{
            flex: 1,
            padding: "11px 13px",
            border: `1px solid ${LINE}`,
            borderRadius: 2,
            background: "transparent",
            fontFamily: sans,
            fontSize: 13,
            color: INK,
            outline: "none",
          }}
        />
        <button
          onClick={send}
          style={{
            padding: "0 22px",
            background: INK,
            color: PAPER,
            border: "none",
            borderRadius: 2,
            fontFamily: sans,
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- Page ----------------------------------- */

export default function TradeClientDashboard() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("scanner");
  const [project, setProject] = useState<ScanResult[]>([]);

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDED_KEY) === "1";
      const saved = localStorage.getItem(NICKNAME_KEY);
      if (done && saved) setNickname(saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const initialize = (name: string) => {
    setNickname(name);
    try {
      localStorage.setItem(NICKNAME_KEY, name);
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const displayName = nickname ?? "Felix";

  const tabs: { id: Tab; label: string }[] = [
    { id: "scanner", label: "Moodboard Scanner" },
    { id: "presentation", label: "Bespoke Presentation" },
    { id: "chat", label: "Direct Chat" },
  ];

  return (
    <div style={{ minHeight: "100lvh", background: PAPER, color: INK }}>
      <Helmet>
        <title>Trade Portal | Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <style>{`@keyframes ma-portal-shimmer{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}`}</style>

      {ready && !nickname && <Onboarding onDone={initialize} />}

      <header style={{ borderBottom: `1px solid ${LINE}`, padding: "22px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Eyebrow>Maison Affluency</Eyebrow>
          <p style={{ fontFamily: serif, fontSize: 19, margin: "4px 0 0" }}>Trade Portal</p>
        </div>
        <Eyebrow>Verified Studio Account</Eyebrow>
      </header>

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "56px 32px 96px" }}>
        <Eyebrow>Your AI Curation Copilot</Eyebrow>
        <h1 style={{ fontFamily: serif, fontSize: 42, fontWeight: 400, lineHeight: 1.15, margin: "12px 0 8px" }}>
          {displayName} is ready.
        </h1>
        <p style={{ fontFamily: sans, fontSize: 13.5, color: MUTED, maxWidth: 560, lineHeight: 1.75, margin: 0 }}>
          Scan a moodboard, compile a client presentation, or brief {displayName} directly. Trade pricing is applied to
          everything you see here.
        </p>

        <nav style={{ display: "flex", gap: 28, margin: "44px 0 28px", borderBottom: `1px solid ${LINE}` }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "none",
                border: "none",
                padding: "0 0 12px",
                cursor: "pointer",
                fontFamily: sans,
                fontSize: 10.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: tab === t.id ? INK : MUTED,
                borderBottom: `1px solid ${tab === t.id ? INK : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "scanner" && (
          <MoodboardScanner
            added={project.map((p) => p.id)}
            onAdd={(r) => setProject((p) => (p.some((x) => x.id === r.id) ? p : [...p, r]))}
          />
        )}
        {tab === "presentation" && <Presentation items={project} name={displayName} />}
        {tab === "chat" && <DirectChat name={displayName} />}
      </main>
    </div>
  );
}
