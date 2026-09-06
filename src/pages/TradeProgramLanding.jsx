import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import heroImage from "@/assets/dining-room.jpg";

/**
 * Trade Program landing page — fully self-contained.
 * Every style is declared locally inside this file; no global CSS or shared
 * design-system classes are used, so the rest of the application stays pristine.
 */

const GOLD = "#C5A86E";
const PAPER = "#FAF9F5";
const INK = "#1B1B19";
const CHARCOAL = "#232323";
const BODY_CHARCOAL = "#333332";
const LINE = "#E2DED6";
const MUTED = "rgba(27, 27, 25, 0.5)";

const serif = "'Instrument Serif', 'Cormorant Garamond', Georgia, serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const METRICS = [
  { value: "300+", label: "DESIGNERS & ATELIERS" },
  { value: "15+", label: "COUNTRIES SERVED" },
  { value: "100%", label: "INSURED SHIPPING" },
  { value: "24h", label: "QUOTE TURNAROUND" },
];

export default function TradeProgramLanding() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isUKVariant, setIsUKVariant] = useState(false);

  const handleJoin = (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid work email.");
      return;
    }
    setError("");
    navigate(`/trade-dashboard?email=${encodeURIComponent(trimmed)}`, { replace: false });
  };

  const goToSignIn = () => navigate("/trade/login");

  return (
    <div className="ma-tpl-wrap">
      <Helmet>
        <title>Maison Affluency Trade Program</title>
        <meta name="robots" content="noindex, nofollow" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
        />
      </Helmet>

      <style>{`
        .ma-tpl-wrap {
          min-height: 100lvh;
          background: ${PAPER};
          color: ${INK};
          display: flex;
          flex-direction: column;
          font-family: ${sans};
          -webkit-font-smoothing: antialiased;
        }

        /* ─── Global header ─── */
        .ma-tpl-header {
          width: 100%;
          border-bottom: 1px solid ${LINE};
          background: rgba(250, 249, 245, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .ma-tpl-header-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .ma-tpl-back {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${INK};
          text-decoration: none;
          transition: color 0.2s ease;
          white-space: nowrap;
        }

        .ma-tpl-back:hover {
          color: ${GOLD};
        }

        .ma-tpl-back svg {
          width: 15px;
          height: 15px;
          display: block;
        }

        .ma-tpl-region {
          display: inline-flex;
          align-items: center;
          border: 1px solid ${LINE};
          border-radius: 999px;
          overflow: hidden;
          background: ${PAPER};
        }

        .ma-tpl-region-btn {
          appearance: none;
          border: none;
          background: transparent;
          padding: 6px 14px;
          font-family: ${sans};
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: ${MUTED};
          cursor: pointer;
          transition: color 0.2s ease, background 0.2s ease;
        }

        .ma-tpl-region-btn + .ma-tpl-region-btn {
          border-left: 1px solid ${LINE};
        }

        .ma-tpl-region-btn:hover {
          color: ${INK};
        }

        .ma-tpl-region-btn.active {
          background: ${INK};
          color: ${PAPER};
        }

        /* ─── Asymmetrical split hero ─── */
        .ma-tpl-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: stretch;
          min-height: 78vh;
        }

        .ma-tpl-left {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(48px, 7vw, 120px) clamp(32px, 6vw, 100px);
          max-width: 620px;
          margin-left: auto;
        }

        .ma-tpl-right {
          position: relative;
          min-height: 100%;
          overflow: hidden;
        }

        .ma-tpl-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .ma-tpl-eyebrow {
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: ${GOLD};
          font-weight: 500;
          margin: 0 0 26px 0;
        }

        .ma-tpl-title {
          font-family: ${serif};
          font-size: clamp(46px, 5.2vw, 78px);
          line-height: 1.04;
          color: ${INK};
          margin: 0;
          font-weight: 400;
        }

        .ma-tpl-title-italic {
          font-family: ${serif};
          font-style: italic;
          font-weight: 300;
          display: block;
        }

        .ma-tpl-body {
          font-family: ${sans};
          font-size: 15px;
          line-height: 1.7;
          color: ${BODY_CHARCOAL};
          font-weight: 400;
          margin: 28px 0 0 0;
          max-width: 440px;
        }

        .ma-tpl-form {
          margin-top: 38px;
          display: flex;
          gap: 0;
        }

        .ma-tpl-input {
          flex: 1;
          appearance: none;
          border: 1px solid ${LINE};
          border-right: none;
          background: transparent;
          padding: 16px 18px;
          font-family: ${sans};
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${INK};
          outline: none;
          border-radius: 0;
        }

        .ma-tpl-input::placeholder {
          color: rgba(27, 27, 25, 0.35);
        }

        .ma-tpl-input:focus {
          border-color: rgba(27, 27, 25, 0.35);
        }

        .ma-tpl-button {
          appearance: none;
          border: 1px solid ${GOLD};
          background: ${GOLD};
          color: #ffffff;
          padding: 0 34px;
          font-family: ${sans};
          font-size: 10.5px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 400;
          cursor: pointer;
          border-radius: 0;
          transition: opacity 0.2s ease;
        }

        .ma-tpl-button:hover {
          opacity: 0.92;
        }

        .ma-tpl-error {
          color: #a94442;
          font-size: 11.5px;
          margin: 10px 0 0 0;
          font-family: ${sans};
        }

        .ma-tpl-sub {
          margin-top: 18px;
          font-size: 12px;
          color: ${MUTED};
          font-family: ${sans};
        }

        .ma-tpl-link {
          color: ${INK};
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          font-size: inherit;
          font-family: inherit;
        }

        .ma-tpl-link:hover {
          color: ${GOLD};
        }

        /* ─── Metrics strip ─── */
        .ma-tpl-bar {
          border-top: 1px solid ${LINE};
          border-bottom: 1px solid ${LINE};
          background: ${PAPER};
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .ma-tpl-stat {
          text-align: center;
          padding: 34px 16px;
          border-right: 1px solid ${LINE};
        }

        .ma-tpl-stat:last-child {
          border-right: none;
        }

        .ma-tpl-stat-num {
          font-family: ${serif};
          font-size: clamp(28px, 3vw, 42px);
          color: ${INK};
          font-weight: 400;
          line-height: 1;
          margin: 0 0 10px 0;
        }

        .ma-tpl-stat-label {
          font-family: ${sans};
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${MUTED};
          margin: 0;
        }

        /* ─── Benefits & overview copy ─── */
        .ma-tpl-overview {
          padding: clamp(72px, 10vw, 140px) clamp(24px, 6vw, 80px);
        }

        .ma-tpl-overview-inner {
          max-width: 920px;
          margin: 0 auto;
        }

        .ma-tpl-overview-title {
          font-family: ${serif};
          font-size: clamp(26px, 3vw, 40px);
          font-weight: 400;
          line-height: 1.25;
          color: ${CHARCOAL};
          text-align: center;
          margin: 0 0 clamp(32px, 4vw, 52px) 0;
        }

        .ma-tpl-overview-copy {
          font-family: ${sans};
          font-size: clamp(14px, 1.2vw, 16px);
          line-height: 1.85;
          font-weight: 300;
          color: ${CHARCOAL};
          margin: 0;
        }

        .ma-tpl-overview-copy + .ma-tpl-overview-copy {
          margin-top: clamp(22px, 3vw, 34px);
        }

        @media (max-width: 900px) {
          .ma-tpl-grid {
            grid-template-columns: 1fr;
            min-height: 0;
          }

          .ma-tpl-left {
            padding: clamp(56px, 14vw, 100px) clamp(24px, 6vw, 48px);
            max-width: none;
            margin-left: 0;
          }

          .ma-tpl-right {
            height: 45vh;
            min-height: 320px;
            order: -1;
          }

          .ma-tpl-image {
            position: static;
            height: 100%;
          }

          .ma-tpl-form {
            flex-direction: column;
          }

          .ma-tpl-input {
            border-right: 1px solid ${LINE};
            border-bottom: none;
          }

          .ma-tpl-button {
            padding: 16px 0;
          }

          .ma-tpl-bar {
            grid-template-columns: repeat(2, 1fr);
          }

          .ma-tpl-stat:nth-child(2) {
            border-right: none;
          }

          .ma-tpl-stat:nth-child(n + 3) {
            border-top: 1px solid ${LINE};
          }

          .ma-tpl-back span {
            display: none;
          }
        }
      `}</style>

      {/* ─── 1. Global header ─── */}
      <header className="ma-tpl-header">
        <div className="ma-tpl-header-inner">
          <Link to="/" className="ma-tpl-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            <span>Back to Maison Affluency</span>
          </Link>
          <div className="ma-tpl-region" role="group" aria-label="Choose region">
            <button
              type="button"
              onClick={() => setIsUKVariant(false)}
              aria-pressed={!isUKVariant}
              className={`ma-tpl-region-btn${!isUKVariant ? " active" : ""}`}
            >
              Worldwide
            </button>
            <button
              type="button"
              onClick={() => setIsUKVariant(true)}
              aria-pressed={isUKVariant}
              className={`ma-tpl-region-btn${isUKVariant ? " active" : ""}`}
            >
              UK
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. Asymmetrical split hero ─── */}
      <main className="ma-tpl-grid">
        <section className="ma-tpl-left">
          <h2 className="ma-tpl-eyebrow">EXCLUSIVELY FOR PROFESSIONALS</h2>
          <h1 className="ma-tpl-title">
            Maison Affluency
            <span className="ma-tpl-title-italic">Trade Program</span>
          </h1>
          <p className="ma-tpl-body">
            {isUKVariant
              ? "White-glove procurement, preferred trade pricing, and priority access to collectible design for architects and interior designers across the United Kingdom."
              : "White-glove procurement, preferred trade pricing, and priority access to collectible design for architects and interior designers worldwide."}
          </p>

          <form className="ma-tpl-form" onSubmit={handleJoin} noValidate>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="YOUR WORK EMAIL"
              className="ma-tpl-input"
              aria-label="Your work email"
            />
            <button type="submit" className="ma-tpl-button">
              JOIN NOW
            </button>
          </form>
          {error && <p className="ma-tpl-error">{error}</p>}

          <p className="ma-tpl-sub">
            Already registered?{" "}
            <button type="button" className="ma-tpl-link" onClick={goToSignIn}>
              Sign in
            </button>
          </p>
        </section>

        <div className="ma-tpl-right">
          <img
            src={heroImage}
            alt="Refined interior dining scene with sculptural furniture and natural light"
            className="ma-tpl-image"
          />
        </div>
      </main>

      {/* ─── 3. Metrics strip ─── */}
      <section className="ma-tpl-bar" aria-label="Programme metrics">
        {METRICS.map((stat) => (
          <div key={stat.label} className="ma-tpl-stat">
            <p className="ma-tpl-stat-num">{stat.value}</p>
            <p className="ma-tpl-stat-label">{stat.label}</p>
          </div>
        ))}
      </section>

      {/* ─── 4. Benefits & overview copy ─── */}
      <section className="ma-tpl-overview">
        <div className="ma-tpl-overview-inner">
          <h2 className="ma-tpl-overview-title">
            Discover Your Exclusive Trade Benefits and Bespoke Services
          </h2>
          <p className="ma-tpl-overview-copy">
            Channeling the essence of high-end European craftsmanship and design, Maison Affluency is proud to work with leading design professionals, including architects, interior designers, and real estate developers across the Middle East and Asia Pacific regions.
          </p>
          <p className="ma-tpl-overview-copy">
            Tailored for a community of professionals who value time, quality, and commitment, Maison Affluency Trade Program unlocks a suite of exclusive benefits, specifically conceived to meet design professionals' needs and bring your creative visions to life. Whether it is creating a one-off bespoke piece or supporting you on larger-scale projects, Maison Affluency dedicated Trade Team provides customised support to deliver seamless luxury residential projects, from first contact to post-sale assistance.
          </p>
        </div>
      </section>
    </div>
  );
}
