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
          content="Contact Maison Affluency by appointment in Singapore and Paris. Private concierge for bespoke inquiries, custom specifications, and designer collaborations."
        />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <h1 className="sr-only">Contact Maison Affluency</h1>

        <div className="pt-[var(--header-h)]">
          <ContactInquiry />
        </div>

        <Footer />
      </div>
    </>
  );
};

export default ContactPage;
