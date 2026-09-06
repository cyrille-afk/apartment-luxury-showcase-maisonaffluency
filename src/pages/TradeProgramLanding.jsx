import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { cloudinaryUrl } from "@/lib/cloudinary";
import ShippingTermsExplainer from "@/components/trade/ShippingTermsExplainer";
import { loadHeroOverrides, getHeroCacheEntry } from "@/components/trade/SectionHero";
import heroImage from "@/assets/dining-room.jpg";
import projectFoldersImg from "@/assets/benefit-project-folders.jpg";

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

const studioBeforeFallback = "https://res.cloudinary.com/dif1oamtj/image/upload/v1773976063/Screen_Shot_2026-03-20_at_11.05.23_AM_fo0aaz.png";
const studioAfterFallback = "https://res.cloudinary.com/dif1oamtj/image/upload/v1773975478/Screen_Shot_2026-03-20_at_10.57.13_AM_yiqv4q.png";

const METRICS = [
  { value: "300+", label: "DESIGNERS & ATELIERS" },
  { value: "15+", label: "COUNTRIES SERVED" },
  { value: "100%", label: "INSURED SHIPPING" },
  { value: "24h", label: "QUOTE TURNAROUND" },
];

const BENEFITS = [
  {
    title: "Dedicated Client Advisor",
    description:
      "Maison Affluency nurture one-on-one relationships with its clients offering personalised and tailored advice on each project. From access to confidential sourcing, design collaborations and curation of artworks, our curating team offers a solid partnership.",
    image: cloudinaryUrl("v1773752378/Screen_Shot_2026-03-17_at_8.58.35_PM_mu5zwl", { width: 1400, quality: "auto:good", crop: "fill", gravity: "north" }),
  },
  {
    title: "Custom Requests",
    description:
      "Collaborating with an established network of manufacturers and specialist workshops, Maison Affluency Trade Program provides you with endless customisation possibilities and bespoke solutions specifically tailored to your creative needs.",
    image: cloudinaryUrl("v1774176831/Screen_Shot_2026-03-22_at_6.53.33_PM_ynpv0c", { width: 1400, quality: "auto:good", crop: "fill" }),
    position: "top",
  },
  {
    title: "Project Folders",
    description:
      "Maison Affluency Trade Program gives you access to smart professional tools — save your favourite items and easily organise them in project folders, with sharable links to colleagues and clients.",
    image: projectFoldersImg,
  },
  {
    title: "Trade Pricing & Bespoke Quotations",
    description:
      "View pricing instantly when you sign in with your trade account and save time with our bespoke quotations, a comprehensive multi-product document listing all prices at a glance.",
    image: cloudinaryUrl("v1773730098/Screen_Shot_2026-03-17_at_2.47.21_PM_lg1da3", { width: 1400, height: 1050, quality: "auto:good", crop: "fill", gravity: "north" }),
  },
  {
    title: "Samples & Swatches",
    description:
      "Every material speaks to authenticity and craftsmanship. Access the most comprehensive material library featuring a vast, curated selection of items or request the ones you truly desire.",
    image: cloudinaryUrl("v1773472978/combination-interior-material-samples-placed-dark-black-marble-table-including-wooden-ceramic-floor-tiles-luxury-marble-stones_1033579-186119_kmp53v", { width: 1400, quality: "auto:good", crop: "fill" }),
  },
  {
    title: "Consolidated Insured Shipping",
    description:
      "Let us help you navigate the many pitfalls of the freight world by recommending the most appropriate partners with full insurance coverage. Maximising time whilst minimising frictions.",
    image: cloudinaryUrl("v1773473193/quality-control_dvxvmb", { width: 1400, quality: "auto:good", crop: "fill" }),
  },
];

const TESTIMONIALS = [
  {
    quote: "Working with Cyrille and Elsa on our recently completed 20,000 sq ft penthouse was a seamless experience. Maison Affluency did so without question. Their personalised approach helped to ensure that our design vision and curation was implemented meticulously. They are the partners you want on your most ambitious projects, and we look forward to many more collaborations ahead.",
    name: "Amelia W. and Antonio E.",
    title: "Co-founders, Wecraft Group",
    location: "Singapore",
  },
  {
    quote: "Access to exclusive collections and consolidated shipping has been invaluable. Maison Affluency truly understands the needs of design professionals working across borders.",
    name: "James T.",
    title: "Creative Director",
    location: "Hong Kong",
  },
  {
    quote: "Their material library is exceptional. Being able to request samples directly and receive a comprehensive quote within days has transformed how we specify for clients.",
    name: "Mei W.",
    title: "Interior Architect",
    location: "Kuala Lumpur",
  },
];

const UK_TESTIMONIAL = {
  quote:
    "Sourcing French and Italian ateliers from London used to mean weeks of phone calls and conflicting freight quotes. Maison Affluency consolidates everything — pricing, lead times, customs, delivery — into one clear quotation. It has genuinely changed how we specify on our UK projects.",
  name: "Studio Principal",
  title: "Interior Architecture Practice",
  location: "London, United Kingdom",
};

const STEPS = [
  { step: "01", title: "Apply Online", desc: "Complete a short application with your company credentials and professional background." },
  { step: "02", title: "Get Approved", desc: "Get verified instantly — our automated system reviews global design credentials in real time and activates your trade account." },
  { step: "03", title: "Start Sourcing", desc: "Access trade pricing, request bespoke quotations, and work directly with your dedicated advisor." },
];

export default function TradeProgramLanding() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isUKVariant, setIsUKVariant] = useState(false);
  const [studioBeforeImg, setStudioBeforeImg] = useState(studioBeforeFallback);
  const [studioAfterImg, setStudioAfterImg] = useState(studioAfterFallback);
  const [showAllTestimonials, setShowAllTestimonials] = useState(false);

  // Mobile benefits carousel
  const scrollRef = useRef(null);
  const [activeBenefit, setActiveBenefit] = useState(0);
  const handleBenefitScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setActiveBenefit(Math.round(el.scrollLeft / (el.offsetWidth * 0.85)));
  }, []);

  useEffect(() => {
    loadHeroOverrides().then(() => {
      const before = getHeroCacheEntry("landing-3d-before");
      const after = getHeroCacheEntry("landing-3d-after");
      if (before) setStudioBeforeImg(before.image_url);
      if (after) setStudioAfterImg(after.image_url);
    });
  }, []);

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
  const testimonials = isUKVariant ? [UK_TESTIMONIAL, ...TESTIMONIALS] : TESTIMONIALS;

  return (
    <div className="ma-tpl-wrap">
      <Helmet>
        <title>Trade Program — Maison Affluency</title>
        <meta
          name="description"
          content="Trade Program for architects & interior designers — exclusive pricing, dedicated advisors, custom sourcing, and consolidated insured shipping."
        />
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
        .ma-tpl-back:hover { color: ${GOLD}; }
        .ma-tpl-back svg { width: 15px; height: 15px; display: block; }
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
        .ma-tpl-region-btn + .ma-tpl-region-btn { border-left: 1px solid ${LINE}; }
        .ma-tpl-region-btn:hover { color: ${INK}; }
        .ma-tpl-region-btn.active { background: ${INK}; color: ${PAPER}; }

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
        .ma-tpl-right { position: relative; min-height: 100%; overflow: hidden; }
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
          font-size: 15px;
          line-height: 1.7;
          color: ${BODY_CHARCOAL};
          margin: 28px 0 0 0;
          max-width: 440px;
        }
        .ma-tpl-form { margin-top: 38px; display: flex; gap: 0; }
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
        .ma-tpl-input::placeholder { color: rgba(27, 27, 25, 0.35); }
        .ma-tpl-input:focus { border-color: rgba(27, 27, 25, 0.35); }
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
          cursor: pointer;
          border-radius: 0;
          transition: opacity 0.2s ease;
        }
        .ma-tpl-button:hover { opacity: 0.92; }
        .ma-tpl-error { color: #a94442; font-size: 11.5px; margin: 10px 0 0 0; }
        .ma-tpl-sub { margin-top: 18px; font-size: 12px; color: ${MUTED}; }
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
        .ma-tpl-link:hover { color: ${GOLD}; }

        /* ─── Provenance strip ─── */
        .ma-tpl-provenance {
          border-bottom: 1px solid ${LINE};
          text-align: center;
          padding: 11px 24px;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${MUTED};
        }

        /* ─── Metrics strip ─── */
        .ma-tpl-bar {
          border-bottom: 1px solid ${LINE};
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        .ma-tpl-stat { text-align: center; padding: 34px 16px; border-right: 1px solid ${LINE}; }
        .ma-tpl-stat:last-child { border-right: none; }
        .ma-tpl-stat-num {
          font-family: ${serif};
          font-size: clamp(28px, 3vw, 42px);
          color: ${INK};
          line-height: 1;
          margin: 0 0 10px 0;
        }
        .ma-tpl-stat-label {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${MUTED};
          margin: 0;
        }

        /* ─── Overview copy ─── */
        .ma-tpl-overview { padding: clamp(72px, 10vw, 140px) clamp(24px, 6vw, 80px); }
        .ma-tpl-overview-inner { max-width: 920px; margin: 0 auto; }
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
          font-size: clamp(14px, 1.2vw, 16px);
          line-height: 1.85;
          font-weight: 300;
          color: ${CHARCOAL};
          margin: 0;
        }
        .ma-tpl-overview-copy + .ma-tpl-overview-copy { margin-top: clamp(22px, 3vw, 34px); }

        /* ─── Shared section shells ─── */
        .ma-tpl-band {
          border-top: 1px solid ${LINE};
          border-bottom: 1px solid ${LINE};
          background: rgba(27, 27, 25, 0.025);
        }
        .ma-tpl-section { max-width: 1152px; margin: 0 auto; padding: clamp(56px, 8vw, 96px) clamp(24px, 5vw, 48px); }
        .ma-tpl-kicker {
          font-size: 11px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: ${GOLD};
          margin: 0 0 16px 0;
        }
        .ma-tpl-h2 {
          font-family: ${serif};
          font-weight: 400;
          font-size: clamp(24px, 2.8vw, 36px);
          line-height: 1.2;
          color: ${INK};
          margin: 0 0 14px 0;
        }
        .ma-tpl-center { text-align: center; }
        .ma-tpl-lede {
          font-size: 14px;
          line-height: 1.8;
          font-weight: 300;
          color: ${CHARCOAL};
          max-width: 520px;
          margin: 0 auto;
        }

        /* ─── What You Unlock / Felix ─── */
        .ma-tpl-unlock { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(32px, 5vw, 64px); align-items: center; }
        .ma-tpl-felix-card {
          border: 1px solid ${LINE};
          background: rgba(255, 255, 255, 0.6);
          padding: clamp(24px, 3vw, 36px);
        }
        .ma-tpl-felix-tag {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }
        .ma-tpl-felix-dot {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(197, 168, 110, 0.12);
          color: ${GOLD};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: ${serif};
          font-size: 18px;
          font-style: italic;
        }
        .ma-tpl-felix-tag p {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${GOLD};
          margin: 0;
        }
        .ma-tpl-h3 { font-family: ${serif}; font-weight: 400; font-size: 20px; color: ${INK}; margin: 0 0 12px 0; }
        .ma-tpl-p { font-size: 14px; line-height: 1.8; font-weight: 300; color: ${CHARCOAL}; margin: 0; }
        .ma-tpl-p + .ma-tpl-p { margin-top: 12px; }

        /* ─── Benefits: desktop alternating / mobile carousel ─── */
        .ma-tpl-benefits-desktop { display: block; max-width: 1152px; margin: 0 auto; padding: 32px clamp(24px, 5vw, 48px); }
        .ma-tpl-benefit { display: flex; margin-bottom: 48px; }
        .ma-tpl-benefit:last-child { margin-bottom: 0; }
        .ma-tpl-benefit.flip { flex-direction: row-reverse; }
        .ma-tpl-benefit-img { width: 50%; aspect-ratio: 4 / 3; overflow: hidden; }
        .ma-tpl-benefit-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ma-tpl-benefit-copy {
          width: 50%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 48px clamp(32px, 4vw, 64px);
        }
        .ma-tpl-benefit-copy .ma-tpl-kicker { margin-bottom: 24px; }

        .ma-tpl-benefits-mobile { display: none; }

        /* ─── Designers banner ─── */
        .ma-tpl-banner-link { display: block; text-decoration: none; }
        .ma-tpl-banner { position: relative; overflow: hidden; aspect-ratio: 3 / 1; }
        .ma-tpl-banner img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          transition: transform 0.7s ease;
        }
        .ma-tpl-banner-link:hover .ma-tpl-banner img { transform: scale(1.02); }
        .ma-tpl-banner::after {
          content: "";
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(27,27,25,0.5), rgba(27,27,25,0.15), transparent);
        }
        .ma-tpl-banner-overlay {
          position: absolute; inset: 0; z-index: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 0 16px;
        }
        .ma-tpl-banner-counts { display: flex; align-items: center; gap: clamp(16px, 4vw, 32px); margin-bottom: 16px; }
        .ma-tpl-banner-num { font-family: ${serif}; font-size: clamp(30px, 4vw, 48px); color: #fff; margin: 0; }
        .ma-tpl-banner-lbl { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.8); margin: 4px 0 0 0; }
        .ma-tpl-banner-divider { width: 1px; height: clamp(40px, 5vw, 56px); background: rgba(255,255,255,0.3); }
        .ma-tpl-banner-cta {
          display: inline-flex; align-items: center;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,0.3);
          color: #fff;
          padding: 10px 20px;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          border-radius: 999px;
        }

        /* ─── 3D studio showcase ─── */
        .ma-tpl-studio { position: relative; overflow: hidden; }
        .ma-tpl-studio-bg { position: absolute; inset: 0; }
        .ma-tpl-studio-bg img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ma-tpl-studio-bg::after { content: ""; position: absolute; inset: 0; background: rgba(27,27,25,0.2); }
        .ma-tpl-studio-inner { position: relative; max-width: 1152px; margin: 0 auto; padding: clamp(64px, 8vw, 110px) clamp(24px, 5vw, 48px); }
        .ma-tpl-studio-card {
          border: 1px solid rgba(197, 168, 110, 0.3);
          background: rgba(27, 27, 25, 0.2);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: clamp(32px, 5vw, 64px);
        }
        .ma-tpl-studio-kicker {
          font-size: 14px; letter-spacing: 0.3em; text-transform: uppercase;
          color: ${GOLD}; font-weight: 700; text-align: center; margin: 0 0 24px 0;
        }
        .ma-tpl-studio-title {
          font-family: ${serif}; font-weight: 400;
          font-size: clamp(26px, 3.5vw, 44px);
          color: #fff; text-align: center; margin: 0 0 18px 0;
        }
        .ma-tpl-studio-lede {
          font-size: 14px; line-height: 1.8; font-weight: 300;
          color: rgba(255,255,255,0.7); text-align: center;
          max-width: 640px; margin: 0 auto clamp(36px, 5vw, 56px);
        }
        .ma-tpl-studio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(16px, 3vw, 32px); align-items: center; }
        .ma-tpl-studio-cap { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #fff; margin: 0 0 12px 0; }
        .ma-tpl-studio-frame { aspect-ratio: 4 / 3; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
        .ma-tpl-studio-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ma-tpl-studio-feats {
          display: flex; flex-wrap: wrap; justify-content: center;
          gap: clamp(20px, 4vw, 56px);
          margin-top: clamp(32px, 5vw, 56px);
          font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #fff;
        }

        /* ─── Testimonials ─── */
        .ma-tpl-quotes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
        .ma-tpl-quote {
          background: ${PAPER};
          border: 1px solid ${LINE};
          padding: 32px;
          display: flex;
          flex-direction: column;
        }
        .ma-tpl-quote-mark { font-family: ${serif}; font-size: 34px; line-height: 1; color: rgba(197,168,110,0.6); margin: 0 0 14px 0; }
        .ma-tpl-quote-text { font-size: 14px; line-height: 1.8; font-weight: 300; color: ${CHARCOAL}; flex: 1; margin: 0; }
        .ma-tpl-quote-meta { margin-top: 24px; padding-top: 16px; border-top: 1px solid ${LINE}; }
        .ma-tpl-quote-name { font-family: ${serif}; font-size: 15px; color: ${INK}; margin: 0; }
        .ma-tpl-quote-role { font-size: 12px; color: ${MUTED}; margin: 4px 0 0 0; }
        .ma-tpl-quote-toggle {
          display: none;
          width: 100%;
          margin-top: 16px;
          padding: 12px 0;
          background: none;
          border: 1px solid rgba(197,168,110,0.35);
          color: ${GOLD};
          font-family: ${sans};
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
        }

        /* ─── How it works ─── */
        .ma-tpl-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(24px, 4vw, 48px); max-width: 960px; margin: 0 auto; }
        .ma-tpl-step { text-align: center; }
        .ma-tpl-step-num { font-family: ${serif}; font-size: clamp(30px, 3vw, 40px); color: rgba(197,168,110,0.45); letter-spacing: 0.05em; }
        .ma-tpl-step-title { font-family: ${serif}; font-weight: 400; font-size: 18px; color: ${INK}; margin: 12px 0 8px 0; }

        /* ─── Final CTA ─── */
        .ma-tpl-final { position: relative; overflow: hidden; }
        .ma-tpl-final-bg {
          position: absolute; inset: 0;
          background-image: url('https://res.cloudinary.com/dif1oamtj/image/upload/w_1600,q_auto,f_auto,c_fill,g_auto/v1773968016/ImgWeb_S25_PDW_Newsletter001_Article_03_1120x600_image002_Factory-_C2_A9GregSevaz_0_m5hi1i');
          background-size: cover;
          background-position: center;
        }
        .ma-tpl-final-bg::after { content: ""; position: absolute; inset: 0; background: rgba(27,27,25,0.2); }
        .ma-tpl-final-inner {
          position: relative; z-index: 1;
          max-width: 768px; margin: 0 auto;
          padding: clamp(64px, 9vw, 110px) 24px;
          text-align: center;
        }
        .ma-tpl-final-title { font-family: ${serif}; font-weight: 400; font-size: clamp(24px, 3vw, 34px); color: #fff; margin: 0 0 16px 0; }
        .ma-tpl-final-copy { font-size: 15px; line-height: 1.75; color: #fff; max-width: 560px; margin: 0 auto 40px; }
        .ma-tpl-final-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 20px; }
        .ma-tpl-final-btn {
          appearance: none;
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 160px;
          padding: 14px 32px;
          background: ${GOLD};
          border: 1px solid ${GOLD};
          color: #fff;
          font-family: ${sans};
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .ma-tpl-final-btn:hover { opacity: 0.92; }
        .ma-tpl-final-sub { font-size: 14px; color: #fff; margin: 0; }
        .ma-tpl-final-sub a { color: #fff; font-weight: 700; text-decoration: underline; text-underline-offset: 4px; }

        @media (max-width: 900px) {
          .ma-tpl-grid { grid-template-columns: 1fr; min-height: 0; }
          .ma-tpl-left { padding: clamp(56px, 14vw, 100px) clamp(24px, 6vw, 48px); max-width: none; margin-left: 0; }
          .ma-tpl-right { height: 45vh; min-height: 320px; order: -1; }
          .ma-tpl-image { position: static; height: 100%; }
          .ma-tpl-form { flex-direction: column; }
          .ma-tpl-input { border-right: 1px solid ${LINE}; border-bottom: none; }
          .ma-tpl-button { padding: 16px 0; }
          .ma-tpl-bar { grid-template-columns: repeat(2, 1fr); }
          .ma-tpl-stat:nth-child(2) { border-right: none; }
          .ma-tpl-stat:nth-child(n + 3) { border-top: 1px solid ${LINE}; }
          .ma-tpl-back span { display: none; }
          .ma-tpl-unlock { grid-template-columns: 1fr; }
          .ma-tpl-benefits-desktop { display: none; }
          .ma-tpl-benefits-mobile { display: block; padding-bottom: 32px; }
          .ma-tpl-benefit-track {
            display: flex; gap: 16px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            padding: 0 20px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .ma-tpl-benefit-track::-webkit-scrollbar { display: none; }
          .ma-tpl-benefit-card {
            scroll-snap-align: center;
            flex-shrink: 0;
            width: 85%;
            border: 1px solid ${LINE};
            background: ${PAPER};
            overflow: hidden;
          }
          .ma-tpl-benefit-card .ma-tpl-benefit-img { width: 100%; }
          .ma-tpl-benefit-card-copy { padding: 16px; }
          .ma-tpl-benefit-card-copy .ma-tpl-kicker { font-size: 9px; margin-bottom: 8px; }
          .ma-tpl-benefit-card-copy h3 { font-family: ${serif}; font-weight: 400; font-size: 15px; color: ${INK}; margin: 0 0 6px 0; }
          .ma-tpl-benefit-card-copy p { font-size: 12px; line-height: 1.7; font-weight: 300; color: ${CHARCOAL}; margin: 0; }
          .ma-tpl-dots { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
          .ma-tpl-dot { width: 6px; height: 6px; border-radius: 50%; background: ${LINE}; transition: background 0.2s ease; }
          .ma-tpl-dot.active { background: ${GOLD}; }
          .ma-tpl-banner { aspect-ratio: 21 / 9; }
          .ma-tpl-studio-grid { grid-template-columns: 1fr; }
          .ma-tpl-quotes { grid-template-columns: 1fr; gap: 16px; }
          .ma-tpl-quote.extra { display: ${"none"}; }
          .ma-tpl-quotes.expanded .ma-tpl-quote.extra { display: flex; }
          .ma-tpl-quote-toggle { display: block; }
          .ma-tpl-steps { grid-template-columns: 1fr; gap: 32px; }
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

      {/* ─── Provenance strip ─── */}
      <p className="ma-tpl-provenance">
        {isUKVariant
          ? "Shipping to the UK from European ateliers — France, Italy & beyond"
          : "Shipping worldwide from European ateliers — France, Italy & beyond"}
      </p>

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

      {/* ─── What You Unlock / Felix ─── */}
      <section className="ma-tpl-band">
        <div className="ma-tpl-section">
          <div className="ma-tpl-unlock">
            <div>
              <p className="ma-tpl-kicker">What You Unlock</p>
              <h2 className="ma-tpl-h2">Elevate your studio workflow.</h2>
              <p className="ma-tpl-p">
                Joining the Maison Affluency Trade Program gives you exclusive pricing, dedicated logistical support, and immediate access to Felix.
              </p>
            </div>
            <div className="ma-tpl-felix-card">
              <div className="ma-tpl-felix-tag">
                <span className="ma-tpl-felix-dot">F</span>
                <p>Felix · AI Curatorial Guide</p>
              </div>
              <h3 className="ma-tpl-h3">Meet Felix: Your Digital Studio Assistant</h3>
              <p className="ma-tpl-p">
                Felix is our proprietary AI curation copilot built natively into your trade dashboard. Upload a mood board, and Felix will instantly cross-reference our global inventory to source matching masterworks, calculate trade margins, and generate bespoke PDF client presentations in seconds.
              </p>
              <p className="ma-tpl-p">
                Tailor your studio experience: Felix can be renamed to whatever suits your firm's culture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Benefits: desktop alternating splits ─── */}
      <div className="ma-tpl-benefits-desktop">
        {BENEFITS.map((benefit, index) => (
          <div key={benefit.title} className={`ma-tpl-benefit${index % 2 === 1 ? " flip" : ""}`}>
            <div className="ma-tpl-benefit-img">
              <img
                src={benefit.image}
                alt={benefit.title}
                loading="lazy"
                decoding="async"
                style={benefit.position ? { objectPosition: benefit.position } : undefined}
              />
            </div>
            <div className="ma-tpl-benefit-copy">
              <p className="ma-tpl-kicker">Trade Program Benefits</p>
              <h2 className="ma-tpl-h2" style={{ fontSize: "clamp(20px, 2vw, 26px)" }}>{benefit.title}</h2>
              <p className="ma-tpl-p">{benefit.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Benefits: mobile carousel ─── */}
      <div className="ma-tpl-benefits-mobile">
        <div ref={scrollRef} onScroll={handleBenefitScroll} className="ma-tpl-benefit-track">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="ma-tpl-benefit-card">
              <div className="ma-tpl-benefit-img">
                <img src={benefit.image} alt={benefit.title} loading="lazy" />
              </div>
              <div className="ma-tpl-benefit-card-copy">
                <p className="ma-tpl-kicker">Trade Program Benefits</p>
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="ma-tpl-dots">
          {BENEFITS.map((_, i) => (
            <span key={i} className={`ma-tpl-dot${i === activeBenefit ? " active" : ""}`} />
          ))}
        </div>
      </div>

      {/* ─── Designers & Ateliers banner ─── */}
      <section className="ma-tpl-band">
        <div className="ma-tpl-section">
          <div className="ma-tpl-center" style={{ marginBottom: "clamp(32px, 4vw, 44px)" }}>
            <p className="ma-tpl-kicker">Our Curated Network</p>
            <h2 className="ma-tpl-h2">Designers & Ateliers Library</h2>
            <p className="ma-tpl-lede">
              Browse our curated directory of exceptional designers and specialist workshops from around the world.
            </p>
          </div>
          <Link to="/trade/designers" className="ma-tpl-banner-link">
            <div className="ma-tpl-banner">
              <img
                src={cloudinaryUrl("v1773838925/1_6Jp3vJWe7VFlFHZ9WhSJng_u6ai93", { width: 1600, height: 600, quality: "auto:good", crop: "fill", gravity: "auto" })}
                alt="Designers & Ateliers Library"
                loading="lazy"
              />
              <div className="ma-tpl-banner-overlay">
                <div className="ma-tpl-banner-counts">
                  <div>
                    <p className="ma-tpl-banner-num">32</p>
                    <p className="ma-tpl-banner-lbl">Ateliers</p>
                  </div>
                  <div className="ma-tpl-banner-divider" />
                  <div>
                    <p className="ma-tpl-banner-num">274</p>
                    <p className="ma-tpl-banner-lbl">Designers</p>
                  </div>
                </div>
                <span className="ma-tpl-banner-cta">Explore the Library</span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ─── 3D Studio showcase ─── */}
      <section className="ma-tpl-studio">
        <div className="ma-tpl-studio-bg">
          <img src={studioAfterImg} alt="" loading="lazy" />
        </div>
        <div className="ma-tpl-studio-inner">
          <div className="ma-tpl-studio-card">
            <p className="ma-tpl-studio-kicker">Exclusive Tool</p>
            <h2 className="ma-tpl-studio-title">From Floor Plan to Furnished</h2>
            <p className="ma-tpl-studio-lede">
              Upload your architectural drawings and watch them transform into fully furnished 3D visualisations,
              featuring products from our curated portfolio. A first-of-its-kind tool for design professionals.
            </p>
            <div className="ma-tpl-studio-grid">
              <div>
                <p className="ma-tpl-studio-cap">Your Drawing</p>
                <div className="ma-tpl-studio-frame">
                  <img src={studioBeforeImg} alt="Architectural floor plan sketch" loading="lazy" />
                </div>
              </div>
              <div>
                <p className="ma-tpl-studio-cap">3D Studio Result</p>
                <div className="ma-tpl-studio-frame">
                  <img src={studioAfterImg} alt="3D furnished room visualization" loading="lazy" />
                </div>
              </div>
            </div>
            <div className="ma-tpl-studio-feats">
              <span>AI-Powered Rendering</span>
              <span>Up to 10 Products</span>
              <span>Before / After Comparison</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="ma-tpl-band">
        <div className="ma-tpl-section">
          <div className="ma-tpl-center" style={{ marginBottom: "clamp(36px, 5vw, 56px)" }}>
            <h2 className="ma-tpl-h2">Trusted by Design Professionals</h2>
            <p className="ma-tpl-lede">
              Hear from architects and interior designers who rely on our trade program for their projects.
            </p>
          </div>
          <div className={`ma-tpl-quotes${showAllTestimonials ? " expanded" : ""}`}>
            {testimonials.map((t, i) => (
              <div key={`${t.name}-${i}`} className={`ma-tpl-quote${i > 0 ? " extra" : ""}`}>
                <p className="ma-tpl-quote-mark">"</p>
                <p className="ma-tpl-quote-text">"{t.quote}"</p>
                <div className="ma-tpl-quote-meta">
                  <p className="ma-tpl-quote-name">{t.name}</p>
                  <p className="ma-tpl-quote-role">{t.title} · {t.location}</p>
                </div>
              </div>
            ))}
          </div>
          {testimonials.length > 1 && (
            <button
              type="button"
              className="ma-tpl-quote-toggle"
              onClick={() => setShowAllTestimonials((v) => !v)}
            >
              {showAllTestimonials ? "Show less" : `Show ${testimonials.length - 1} more reviews`}
            </button>
          )}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section>
        <div className="ma-tpl-section">
          <div className="ma-tpl-center" style={{ marginBottom: "clamp(36px, 5vw, 56px)" }}>
            <h2 className="ma-tpl-h2">How It Works</h2>
            <p className="ma-tpl-lede">Getting started takes less than five minutes.</p>
          </div>
          <div className="ma-tpl-steps">
            {STEPS.map((item) => (
              <div key={item.step} className="ma-tpl-step">
                <span className="ma-tpl-step-num">{item.step}</span>
                <h3 className="ma-tpl-step-title">{item.title}</h3>
                <p className="ma-tpl-p">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Shipping terms ─── */}
      <ShippingTermsExplainer />

      {/* ─── Final CTA ─── */}
      <section className="ma-tpl-final">
        <div className="ma-tpl-final-bg" />
        <div className="ma-tpl-final-inner">
          <h2 className="ma-tpl-final-title">Ready to Get Started?</h2>
          <p className="ma-tpl-final-copy">
            Join a community of architects and interior designers who trust Maison Affluency for their most ambitious projects.
          </p>
          <div className="ma-tpl-final-row">
            <button type="button" onClick={() => navigate("/trade/apply")} className="ma-tpl-final-btn">
              Apply Now
            </button>
            <p className="ma-tpl-final-sub">
              Already a member? <Link to="/trade/login">Sign in</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
