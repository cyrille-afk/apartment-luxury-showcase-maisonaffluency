import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | Maison Affluency</title>
        <meta name="description" content="Privacy Policy for Maison Affluency — how we collect, use, and protect your personal data." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <h1 className="font-display text-3xl md:text-4xl mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mb-12">Last updated: 17 March 2026</p>

          <div className="space-y-8 font-body text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-display text-lg text-foreground mb-3">1. Introduction</h2>
              <p>
                Maison Affluency ("we", "our", or "us") operates the website maisonaffluency.com. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our trade portal services.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">2. Information We Collect</h2>
              <p className="mb-3">We may collect the following types of information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-foreground">Personal Information:</strong> Name, email address, phone number, company name, job title, and other details you provide when registering for our trade portal or contacting us.</li>
                <li><strong className="text-foreground">Account Information:</strong> Login credentials and profile information associated with your trade account.</li>
                <li><strong className="text-foreground">Usage Data:</strong> Information about how you interact with our website, including pages visited, time spent, and navigation patterns.</li>
                <li><strong className="text-foreground">Device Information:</strong> Browser type, operating system, IP address, and device identifiers.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>To provide and maintain our services, including the trade portal</li>
                <li>To process trade applications and manage your account</li>
                <li>To send you relevant communications about products, pricing, and services</li>
                <li>To improve our website and user experience</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">4. Information Sharing</h2>
              <p>
                We do not sell your personal information. We may share your data with trusted third-party service providers who assist us in operating our website and conducting our business, subject to confidentiality agreements. These include authentication providers (such as Google for sign-in), hosting services, and email delivery services.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">5. Data Security</h2>
              <p>
                We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">6. Cookies</h2>
              <p>
                We use essential cookies to maintain your session and authentication state. We do not use third-party tracking or advertising cookies.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">7. Your Rights</h2>
              <p>
                Depending on your jurisdiction, you may have the right to access, correct, delete, or restrict the processing of your personal data. To exercise these rights, please contact us at the email address below.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">8. Third-Party Services</h2>
              <p>
                Our website may use third-party services, including Google OAuth for authentication. When you sign in with Google, their privacy policy applies to the data they collect. We encourage you to review their policies.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">10. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact us at:{" "}
                <a href="mailto:hello@maisonaffluency.com" className="text-primary hover:underline">
                  hello@maisonaffluency.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
