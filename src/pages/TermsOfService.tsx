import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Service | Maison Affluency</title>
        <meta name="description" content="Terms of Service for Maison Affluency — the terms governing use of our website and trade portal." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <h1 className="font-display text-3xl md:text-4xl mb-2">Terms of Service</h1>
          <p className="text-muted-foreground text-sm mb-12">Last updated: 17 March 2026</p>

          <div className="space-y-8 font-body text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-display text-lg text-foreground mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the Maison Affluency website (maisonaffluency.com) and trade portal, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">2. Description of Services</h2>
              <p>
                Maison Affluency provides a curated showcase of luxury interior design and furnishings, along with a trade portal for qualified design professionals. The trade portal offers access to product catalogues, trade pricing, quotation tools, and design resources.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">3. Trade Portal Access</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access to the trade portal requires registration and approval.</li>
                <li>You must provide accurate and complete information during registration.</li>
                <li>We reserve the right to approve, deny, or revoke trade access at our discretion.</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">4. Trade Pricing & Quotations</h2>
              <p>
                Trade pricing displayed on the portal is confidential and intended solely for approved trade professionals. Prices are indicative and subject to change. Quotations are not binding until formally confirmed by Maison Affluency.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">5. Intellectual Property</h2>
              <p>
                All content on this website — including images, text, logos, designs, and layouts — is the property of Maison Affluency or its licensors and is protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without written permission.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">6. User Conduct</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Share trade pricing or confidential information with unauthorised parties</li>
                <li>Use the website for any unlawful purpose</li>
                <li>Attempt to gain unauthorised access to any part of the website</li>
                <li>Interfere with the website's functionality or security</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">7. Limitation of Liability</h2>
              <p>
                Maison Affluency provides this website and its services on an "as is" basis. We make no warranties, express or implied, regarding the accuracy, completeness, or reliability of any content. To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of the website.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">8. Third-Party Services</h2>
              <p>
                Our website integrates with third-party services, including Google for authentication. Your use of these services is subject to their respective terms and policies.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">9. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the Republic of Singapore, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">10. Changes to These Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated revision date. Continued use of the website constitutes acceptance of any changes.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg text-foreground mb-3">11. Contact Us</h2>
              <p>
                For questions regarding these Terms, please contact us at:{" "}
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

export default TermsOfService;
