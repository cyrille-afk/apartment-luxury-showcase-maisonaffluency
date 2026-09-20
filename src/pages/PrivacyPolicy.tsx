import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy & Cookie Policy | Maison Affluency</title>
        <meta name="description" content="Privacy and Cookie Policy for Maison Affluency — how we collect, use, and protect your personal and corporate data." />
        <meta property="og:title" content="Privacy & Cookie Policy — Maison Affluency" />
        <meta property="og:description" content="How Maison Affluency collects, uses and protects your personal and corporate data." />
        <meta property="og:url" content="https://maisonaffluency.com/privacy" />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <h1 className="font-display text-3xl md:text-4xl mb-2">Maison Affluency — Privacy & Cookie Policy</h1>
          <div className="text-muted-foreground text-sm mb-12 space-y-1">
            <p><span className="font-medium text-foreground">Last Updated:</span> 20 September 2026</p>
            <p><span className="font-medium text-foreground">Effective Date:</span> 20 September 2026</p>
            <p><span className="font-medium text-foreground">Data Controller:</span> Maison Affluency Private Limited (Singapore UEN: 201717288Z)</p>
            <p><span className="font-medium text-foreground">Contact:</span>{" "}
              <a href="mailto:privacy@maisonaffluency.com" className="text-primary hover:underline">privacy@maisonaffluency.com</a>
            </p>
          </div>

          <div className="space-y-10 font-body text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-display text-lg text-foreground mb-3">1. Overview & Data Architecture</h2>
              <p className="mb-3">
                At Maison Affluency, we are committed to handling your personal and corporate data with complete transparency. This policy outlines how we collect, process, and protect your information across our public website, our premium PWA standalone applications, and our dedicated <code className="px-1.5 py-0.5 bg-muted rounded text-xs">/trade/*</code> business workspaces.
              </p>
              <p>
                As a Singapore-headquartered entity serving a global clientele, we operate under a strict <strong className="text-foreground">Zero-Pre-Consent model</strong>. No non-essential tracking pixels, analytics, or third-party behavioral scripts will fire within your browser or device until you grant explicit, affirmative consent via our preference management center.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">2. Granular Cookie & Tracking Infrastructure</h2>
              <p className="mb-4">
                We classify our automated data collection tokens into four distinct tiers. You can modify or withdraw your preferences at any time by clicking the permanent <strong className="text-foreground">Privacy Shield Icon</strong> in the bottom-left corner of your screen.
              </p>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 font-display text-foreground font-medium">Cookie Category</th>
                      <th className="px-4 py-3 font-display text-foreground font-medium">Function & Description</th>
                      <th className="px-4 py-3 font-display text-foreground font-medium">Default Status</th>
                      <th className="px-4 py-3 font-display text-foreground font-medium">Processors Involved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-4 py-3 align-top font-medium text-foreground">Strictly Necessary</td>
                      <td className="px-4 py-3 align-top">Essential for core platform security, secure user authentication, and shopping cart persistence.</td>
                      <td className="px-4 py-3 align-top font-medium text-foreground">Always Active</td>
                      <td className="px-4 py-3 align-top">Supabase Auth, Stripe (Advanced Fraud Telemetry)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 align-top font-medium text-foreground">Functional</td>
                      <td className="px-4 py-3 align-top">Remembers local display currencies, localization selections, and basic UI system preferences.</td>
                      <td className="px-4 py-3 align-top italic">Disabled until consented</td>
                      <td className="px-4 py-3 align-top">Local Storage Framework</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 align-top font-medium text-foreground">Analytics</td>
                      <td className="px-4 py-3 align-top">Measures traffic volume, customer navigation journeys, and page speed diagnostics to improve our user experience.</td>
                      <td className="px-4 py-3 align-top italic">Disabled until consented</td>
                      <td className="px-4 py-3 align-top">Google Analytics 4, Hotjar</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 align-top font-medium text-foreground">Marketing & Targeting</td>
                      <td className="px-4 py-3 align-top">Tracks campaign performance and controls the delivery of curated product updates and messaging.</td>
                      <td className="px-4 py-3 align-top italic">Disabled until consented</td>
                      <td className="px-4 py-3 align-top">Resend Tracking, Twilio, Meta Pixel</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-4 italic">
                Note: In compliance with EU GDPR Article 7(1), every modification of your tracking preferences is securely logged in an immutable, server-side ledger with an encrypted device fingerprint, timestamp, and policy version code to serve as our legally binding audit trail.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">3. Trade Registration & Anti-Fraud Gating</h2>
              <p className="mb-3">
                When a corporate entity applies for wholesale access via our <strong className="text-foreground">Trade Registration Form</strong>, we enforce stringent server-side verification protocols to protect our platform integrity:
              </p>
              <ul className="list-disc pl-6 space-y-3">
                <li>
                  <strong className="text-foreground">Data Collected:</strong> Registered Corporate Name, Legal Operating Address, UK/EU VAT numbers, local tax registrations (e.g., Singapore UEN), and identity verification documents (e.g., passports, trade licences).
                </li>
                <li>
                  <strong className="text-foreground">Automated Screening & Human Verification:</strong> Uploaded files undergo binary signature verification and cryptographic SHA-256 fingerprinting to detect duplicate or altered records. An AI sub-routine screens metadata for manipulation flags; however, <strong className="text-foreground">no automated decision-making occurs</strong>. All accounts are securely held in a <code className="px-1.5 py-0.5 bg-muted rounded text-xs">Pending_Human_Review</code> queue until approved by an administrator.
                </li>
                <li>
                  <strong className="text-foreground">Strict Deletion Windows:</strong> If a trade application is rejected by our compliance team, all uploaded verification documents (passports, licences) are <strong className="text-foreground">permanently and automatically deleted from our cloud storage arrays after exactly 14 days</strong>. Only an anonymised historical decision record is retained.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">4. International Cross-Border Transfers & Taxation</h2>
              <p className="mb-3">
                Because Maison Affluency manages logistics from its Singapore hub using a <strong className="text-foreground">Delivered Duty Paid (DDP) clearance model</strong>, your transaction and address data are handled under specific operational guardrails:
              </p>
              <ul className="list-disc pl-6 space-y-3">
                <li>
                  <strong className="text-foreground">Third-Party Processing:</strong> To calculate decimal-accurate localized checkout taxes, your input VAT or corporate tax numbers are verified in real-time using secure aggregators accessing the <strong className="text-foreground">EU VIES</strong> and <strong className="text-foreground">UK HMRC API</strong> networks.
                </li>
                <li>
                  <strong className="text-foreground">Landed Cost Data:</strong> Line-item descriptions and matched <strong className="text-foreground">HS6 Customs Codes</strong> are securely transmitted to our partner carriers (including DHL Express, FedEx, and UPS) to process cross-border clearance and statutory customs manifests on your behalf.
                </li>
                <li>
                  <strong className="text-foreground">Data Hosting:</strong> Our database architecture utilizes secure global nodes. Transfers of European citizen data to non-EU cloud environments are protected via Standard Contractual Clauses (SCCs) embedded within our service level contracts.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">5. Data Retention & Your Legal Rights</h2>
              <ul className="list-disc pl-6 space-y-3">
                <li>
                  <strong className="text-foreground">Retention Limits:</strong> Marketing funnel tokens and abandoned cart tracking records are retained for a maximum of <strong className="text-foreground">180 days</strong> before automatic expiration. Confirmed transactional invoice data is retained for a mandatory <strong className="text-foreground">7-year period</strong> to satisfy Singapore corporate accounting and tax law regulations.
                </li>
                <li>
                  <strong className="text-foreground">Your Rights:</strong> Regardless of your geographic location, Maison Affluency extends fundamental privacy rights to all users. You have the right to request a <strong className="text-foreground">complete export of your data profile</strong>, ask for the <strong className="text-foreground">rectification of inaccurate information</strong>, or invoke your <strong className="text-foreground">right to erasure ("Right to be Forgotten")</strong> for non-tax records.
                </li>
              </ul>
              <p className="mt-3">
                You can submit a formal request below, or write to{" "}
                <a href="mailto:privacy@maisonaffluency.com" className="text-primary hover:underline">privacy@maisonaffluency.com</a>. Every request is logged with a statutory 30-day deadline and answered by our compliance desk.
              </p>
              <DataRightsRequest />
            </section>
          </div>

          {/* Internal links — link equity + navigation */}
          <nav aria-label="Site links" className="mt-16 pt-10 border-t border-border">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Explore Maison Affluency</p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <li><Link to="/" className="text-foreground hover:underline">Home</Link></li>
              <li><Link to="/designers" className="text-foreground hover:underline">Designers</Link></li>
              <li><Link to="/collectibles" className="text-foreground hover:underline">Collectibles</Link></li>
              <li><Link to="/new-in" className="text-foreground hover:underline">New arrivals</Link></li>
              <li><Link to="/gallery" className="text-foreground hover:underline">Gallery</Link></li>
              <li><Link to="/journal" className="text-foreground hover:underline">Journal</Link></li>
              <li><Link to="/studios" className="text-foreground hover:underline">Studios directory</Link></li>
              <li><Link to="/trade-program" className="text-foreground hover:underline">Trade programme</Link></li>
              <li><Link to="/contact" className="text-foreground hover:underline">Contact</Link></li>
              <li><Link to="/terms" className="text-foreground hover:underline">Terms of service</Link></li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
