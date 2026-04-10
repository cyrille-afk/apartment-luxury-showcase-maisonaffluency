import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ContactInquiry from "@/components/ContactInquiry";

const ContactPage = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  return (
    <>
      <Helmet>
        <title>Contact — Maison Affluency</title>
        <meta
          name="description"
          content="Visit Maison Affluency by appointment at 1 Grange Garden, Singapore 249631. Contact our concierge team for professional inquiries, custom specifications, and collaborative opportunities."
        />
        <link rel="canonical" href="https://www.maisonaffluency.com/contact" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta property="og:url" content="https://www.maisonaffluency.com/contact" />
        <meta property="og:title" content="Contact — Maison Affluency" />
        <meta property="og:description" content="Visit Maison Affluency by appointment at 1 Grange Garden, Singapore 249631. Professional inquiries for architects, interior designers, and design connoisseurs." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Contact — Maison Affluency" />
        <meta name="twitter:description" content="Visit Maison Affluency by appointment at 1 Grange Garden, Singapore 249631." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="pt-28">
          <ContactInquiry />
        </div>

        <Footer />
      </div>
    </>
  );
};

export default ContactPage;
