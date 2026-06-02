import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import TradeRegistrationForm from "@/components/trade/TradeRegistrationForm";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { sharePageOnWhatsApp } from "@/lib/whatsapp-share";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";

/* ── Lightweight public signup form ─────────────────────────────── */
const PublicSignupForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast({ title: "Google Sign-In Failed", description: String(result.error), variant: "destructive" });
      } else if (!result.redirected) {
        navigate("/", { replace: true });
      }
    } catch (err) {
      toast({ title: "Google Sign-In Failed", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign Up Failed", description: error.message, variant: "destructive" });
      return;
    }
    // Send welcome email (fire-and-forget)
    if (signUpData?.user?.id) {
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'welcome-registration',
          recipientEmail: email,
          idempotencyKey: `welcome-reg-${signUpData.user.id}`,
          templateData: { firstName, recipientEmail: email },
        },
      }).catch(() => {});
    }
    toast({ title: "Check your email", description: "We've sent you a confirmation link. Please verify your email to continue." });
  };

  const inputClass = "w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]";

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="w-full py-3 border border-border rounded-full font-body text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {googleLoading ? "Connecting..." : "Sign up with Google"}
      </button>

      <div className="relative flex items-center gap-4">
        <div className="flex-1 border-t border-border" />
        <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">or</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-body text-xs text-muted-foreground">First name</label>
            <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground">Last name</label>
            <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="font-body text-xs text-muted-foreground">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} />
        </div>
        <div>
          <label className="font-body text-xs text-muted-foreground">Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
          <p className="font-body text-[10px] text-muted-foreground/60 mt-1">Minimum 6 characters</p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-foreground text-background font-body text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create Free Account"}
        </button>
      </form>

      <p className="font-body text-[10px] text-muted-foreground/60 text-center leading-relaxed">
        Are you an architect or interior designer?{" "}
        <Link to="/trade/register" className="underline underline-offset-2 hover:text-foreground transition-colors">
          Apply for trade access instead
        </Link>
      </p>
    </div>
  );
};

/* ── Main page ────────────────────────────────────────────────────── */
const TradeRegister = () => {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";
  const isPublicSignup = searchParams.get("type") === "public";
  const [prefill, setPrefill] = useState({
    email: prefillEmail,
    firstName: searchParams.get("first_name") || "",
    lastName: searchParams.get("last_name") || "",
    company: searchParams.get("company") || "",
    phone: searchParams.get("phone") || "",
  });

  useEffect(() => {
    // Hydrate from the active session's user metadata / profile when available
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const meta = (user.user_metadata || {}) as Record<string, string>;
      let profile: Record<string, string> | null = null;
      const { data } = await supabase
        .from("profiles")
        .select("first_name,last_name,company,phone,email")
        .eq("id", user.id)
        .maybeSingle();
      profile = (data as any) || null;
      setPrefill((p) => ({
        email: p.email || profile?.email || user.email || "",
        firstName: p.firstName || profile?.first_name || meta.first_name || "",
        lastName: p.lastName || profile?.last_name || meta.last_name || "",
        company: p.company || profile?.company || meta.company || meta.company_name || "",
        phone: p.phone || profile?.phone || meta.phone || "",
      }));
    })();
  }, []);


  return (
    <>
      <Helmet>
        <title>{isPublicSignup ? "Create Account — Maison Affluency" : "Apply — Trade Program — Maison Affluency"}</title>
        <meta name="description" content={isPublicSignup ? "Create a free account on Maison Affluency. Browse curators' picks, save favourites, download spec sheets, and request quotes." : "Register and apply for the Maison Affluency Trade Program. Exclusive access for architects, interior designers, and luxury hospitality professionals."} />
        <link rel="canonical" href="https://maisonaffluency.com/trade/register" />
        <meta property="og:title" content={isPublicSignup ? "Create Account — Maison Affluency" : "Apply — Trade Program — Maison Affluency"} />
        <meta property="og:description" content={isPublicSignup ? "Browse curators' picks, save favourites, and download spec sheets." : "Register for exclusive trade pricing and dedicated support for design professionals."} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://maisonaffluency.com/trade/register" />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <div className="min-h-screen bg-background px-4 py-6 md:py-12">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between mb-6">
          <Link to="/" className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Maison Affluency
          </Link>
          <Link
            to="/trade/login"
            className="px-5 py-2 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
        </div>

        <div className="w-full max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <Link to="/" className="inline-block">
              <h1 className="font-display text-xl md:text-2xl text-foreground tracking-wide">Maison Affluency</h1>
            </Link>
            {isPublicSignup ? (
              <>
                <p className="font-body text-xs text-muted-foreground mt-1">Create Your Free Account</p>
                <p className="font-body text-[11px] text-muted-foreground/60 mt-2 max-w-sm mx-auto leading-relaxed">
                  Save your favourite pieces, download spec sheets, and request quotes — all in one place.
                </p>
              </>
            ) : (
              <>
                <p className="font-body text-xs text-muted-foreground mt-1">Trade Account Application</p>
                <div className="mt-2">
                  <WhatsAppShareButton
                    onClick={(e) => {
                      e.preventDefault();
                      sharePageOnWhatsApp("/trade/register", "Apply to Trade Program — Maison Affluency", "Exclusive access for design professionals");
                    }}
                    label="Share trade registration on WhatsApp"
                    size="sm"
                    variant="prominent"
                    className="md:!text-sm md:!px-4 md:!py-2"
                  />
                </div>
              </>
            )}
          </div>

          {isPublicSignup ? (
            <div className="max-w-md mx-auto">
              <PublicSignupForm />
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-2 gap-2">
                {[
                  { title: "Dedicated Advisor", desc: "Personalised guidance on every project" },
                  { title: "Custom Requests", desc: "Access to specialist workshops worldwide" },
                  { title: "Samples & Swatches", desc: "Comprehensive curated material library" },
                  { title: "Insured Shipping", desc: "Consolidated freight with full coverage" },
                ].map((b) => (
                  <div key={b.title} className="border border-border rounded-sm px-3 py-2">
                    <p className="font-display text-xs text-foreground">{b.title}</p>
                    <p className="font-body text-[11px] text-muted-foreground mt-0.5 leading-tight">{b.desc}</p>
                  </div>
                ))}
              </div>
              <TradeRegistrationForm
                prefillEmail={prefill.email}
                prefillFirstName={prefill.firstName}
                prefillLastName={prefill.lastName}
                prefillCompany={prefill.company}
                prefillPhone={prefill.phone}
              />
            </>
          )}
        </div>

        {/* Editorial / SEO content — explains the Trade Program and free account */}
        <section className="w-full max-w-2xl mx-auto mt-16 pt-10 border-t border-border">
          <h2 className="font-display text-lg text-foreground mb-4">
            {isPublicSignup ? "About a Maison Affluency Account" : "About the Trade Program"}
          </h2>
          <div className="space-y-4 font-body text-sm leading-relaxed text-muted-foreground">
            {isPublicSignup ? (
              <>
                <p>
                  A free Maison Affluency account is the easiest way to keep
                  track of the collectible furniture, lighting, rugs and
                  decorative objects you fall in love with as you browse our
                  curated rooms and designer profiles. Save favourites into
                  folders by project or by room, share moodboards with your
                  architect, and request pricing or availability whenever you
                  are ready — without re-entering your details each time.
                </p>
                <p>
                  You will be able to download editorial spec sheets, follow
                  designers and ateliers you are interested in, and receive a
                  quiet monthly digest of new arrivals from Pouénat, Pierre
                  Frey, Collection Particulière, Apparatus Studio, Theoreme
                  Éditions, cc-tapis, Saint-Louis, Veronese and other houses we
                  represent. We never share your email, never sell data, and you
                  can unsubscribe with one click. If you later begin a project
                  with a designer or architect, your favourites travel with you.
                </p>
              </>
            ) : (
              <>
                <p>
                  The Maison Affluency Trade Program is reserved for design
                  professionals — architecture and interior design studios,
                  hospitality groups, yacht designers, art consultants and
                  procurement specialists. Approved members receive confidential
                  trade pricing across our full European catalogue, a dedicated
                  advisor who knows the makers personally, and access to
                  workshops that rarely list publicly — from Parisian bronziers
                  and Florentine lacquer ateliers to Milanese rug-makers and
                  Murano glass studios.
                </p>
                <p>
                  Membership unlocks the full toolkit: white-labeled tearsheets
                  and PDF presentations for your clients, multi-currency landed
                  cost estimators, mood boards, CAD and 3D downloads, sample
                  ordering, order timelines, and consolidated insured freight
                  from multiple workshops into a single delivery. Custom
                  commissions — non-standard dimensions, bespoke finishes,
                  client COM upholstery — are handled quietly through your
                  advisor.
                </p>
                <p>
                  Applications are reviewed within two working days. We ask for
                  a few details about your studio and current projects so we can
                  match you with the right advisor and the right level of
                  pricing tier. There is no membership fee, no minimum order,
                  and no obligation to commit before you have seen samples and
                  a full landed-cost estimate.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default TradeRegister;
