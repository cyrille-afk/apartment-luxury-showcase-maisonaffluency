import { useState } from "react";
import { motion } from "framer-motion";

/* Extracted from TradeLanding — FAQ column shared by the /trade/apply page. */
const TradeFaq = ({ isUKVariant = false }: { isUKVariant?: boolean }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const FAQ_ITEMS = [
    { q: "Who is eligible to join the Trade Program?", a: "The program is designed for architects, interior designers, decorators, and luxury hospitality professionals. We review each application based on company credentials and professional background." },
    { q: "Is there a minimum order or annual spend requirement?", a: "No. There is no minimum purchase or annual commitment required. You can place orders of any size through your trade account." },
    { q: "How does trade pricing work?", a: "Once approved, you'll see exclusive trade pricing when signed in. You can also request bespoke multi-product quotations with all prices listed at a glance, including GST where applicable." },
    { q: "How does the quotation process work?", a: "You can build quotes directly from our product library. Once submitted, our team reviews and confirms pricing within 24 hours. Complex or multi-brand projects may take slightly longer as we coordinate with our ateliers." },
    { q: "Do you ship internationally?", a: "Yes. We arrange consolidated, fully insured shipping to most countries. Our logistics team will recommend the most appropriate freight partners for your project location." },
    { q: "Can I request custom or bespoke pieces?", a: "Absolutely. We work directly with specialist workshops and renowned designers worldwide to fulfil custom requirements — from material modifications to entirely bespoke commissions." },
    { q: "How long does the application review take?", a: "Get verified instantly. Our automated system reviews global design credentials in real time — you'll receive an email notification as soon as your account is approved." },
    { q: "Are prices shown ex-VAT or inclusive?", a: "All trade prices are quoted ex-VAT. Where the destination requires it (e.g. EU intra-community deliveries, UK VAT-registered businesses), VAT is itemised separately on the final quotation. Singapore GST is applied where applicable." },
    { q: "Where do shipments originate?", a: "The majority of our roster is based in France and Italy, with selected ateliers across Spain, the Netherlands, Switzerland and the UK. Goods consolidate at our European hubs before international dispatch — typically a short, well-trodden route for UK and EU clients." },
    { q: "How are post-Brexit duties handled for UK deliveries?", a: "We coordinate customs clearance into Great Britain and Northern Ireland on your behalf. Import VAT and any applicable duty are calculated against HMRC tariff codes for each piece and surfaced on the quote — no surprises on delivery." },
    { q: "Do you offer DDP or DAP shipping terms?", a: "Both. Delivered Duty Paid (DDP) bundles freight, customs, duty and import VAT into a single landed price — recommended for residential clients. Delivered At Place (DAP) is available where your studio or freight forwarder prefers to clear goods directly." },
    { q: "Can I use my own freight forwarder or logistics provider?", a: "Yes. While our automated portal provides instant DDP and DAP quotes through our consolidated white-glove partners, you can easily select 'Ex-Works' during checkout to have your preferred global logistics firm coordinate collection directly from our European ateliers." },
    { q: "Do you offer physical material swatches for project mood boards?", a: "Absolutely. Verified trade members can request physical samples, wood finishes, and textile swatches directly through their project folders dashboard. Most standard textile and leather swatches are dispatched internationally within 48 hours." },
  ];

  return (
    <div className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="mb-8 md:mb-10"
      >
        <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3 text-center">
          Frequently Asked Questions
        </h2>
        {isUKVariant && (
          <p className="font-body text-xs md:text-sm text-muted-foreground text-center mt-2 italic">
            UK studios — see VAT, Brexit duties and DDP/DAP shipping below.
          </p>
        )}
        <div className="border-t border-border mt-4" />
      </motion.div>

      <div className="space-y-0 divide-y divide-border">
        {FAQ_ITEMS.map((faq, i) => (
          <div key={i} className="py-4">
            <button
              type="button"
              className="w-full flex items-center justify-between text-left lg:pointer-events-none"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
            >
              <h3 className="font-display text-sm md:text-base text-foreground">{faq.q}</h3>
              <span className="lg:hidden ml-3 text-muted-foreground shrink-0 transition-transform duration-200" style={{ transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${openIndex === i ? 'max-h-40 mt-2' : 'max-h-0 lg:max-h-40 lg:mt-2'}`}>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TradeFaq;
