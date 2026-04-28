import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Truck, FileCheck2 } from "lucide-react";
import { inferSupportedCountry } from "@/lib/inferCountry";

/**
 * Lightweight, self-contained explainer that contrasts DDP (Delivered Duty Paid)
 * vs DAP (Delivered At Place) and tailors the copy to the visitor's destination.
 *
 * Lives on the Trade Landing page; it does NOT submit anything — it's an
 * education widget that helps UK / EU / APAC visitors understand which Incoterm
 * they should request before booking a quote.
 */

type RegionKey = "uk" | "eu" | "us" | "apac" | "other";

const DESTINATIONS: { country: string; region: RegionKey; vatNote: string }[] = [
  { country: "United Kingdom",   region: "uk",   vatNote: "20% UK VAT + duty per HMRC tariff" },
  { country: "France",           region: "eu",   vatNote: "Intra-EU — 0% if VAT-registered (reverse charge)" },
  { country: "Germany",          region: "eu",   vatNote: "Intra-EU — 0% if VAT-registered (reverse charge)" },
  { country: "Italy",            region: "eu",   vatNote: "Intra-EU — 0% if VAT-registered (reverse charge)" },
  { country: "Spain",            region: "eu",   vatNote: "Intra-EU — 0% if VAT-registered (reverse charge)" },
  { country: "Netherlands",      region: "eu",   vatNote: "Intra-EU — 0% if VAT-registered (reverse charge)" },
  { country: "Switzerland",      region: "other",vatNote: "Swiss VAT (8.1%) + duty on import" },
  { country: "United States",    region: "us",   vatNote: "No VAT — duty per HTSUS classification" },
  { country: "Canada",           region: "us",   vatNote: "GST/HST + duty on import" },
  { country: "United Arab Emirates", region: "other", vatNote: "5% UAE VAT + duty on import" },
  { country: "Singapore",        region: "apac", vatNote: "9% GST on landed value" },
  { country: "Hong Kong",        region: "apac", vatNote: "No VAT/GST; minimal duty" },
  { country: "Australia",        region: "apac", vatNote: "10% GST + duty on import" },
  { country: "Japan",            region: "apac", vatNote: "10% consumption tax + duty" },
  { country: "Other",            region: "other",vatNote: "We'll itemise local taxes & duty on the quote" },
];

const REGION_COPY: Record<RegionKey, { ddp: string; dap: string }> = {
  uk: {
    ddp: "We handle UK customs clearance, import VAT (20%) and duty against HMRC tariff codes. You receive a single landed price — ideal for residential clients who don't want surprise bills at the door.",
    dap: "Goods arrive at your nominated UK port or warehouse. Your studio (or your appointed forwarder) clears customs, pays import VAT and any duty directly to HMRC. Often preferred when you can reclaim input VAT.",
  },
  eu: {
    ddp: "EU intra-community shipments — DDP is rarely needed. We arrange door delivery and, if you're VAT-registered, the reverse-charge mechanism means 0% VAT is applied on the invoice.",
    dap: "Standard for EU deliveries to non-VAT-registered residential clients. We deliver to the door; the local carrier handles any modest formalities for cross-border movements.",
  },
  us: {
    ddp: "We act as Importer of Record, clearing through US Customs, paying duty per HTSUS classification and brokerage. Final price includes everything to your jobsite door.",
    dap: "We deliver to a US port of entry (typically Newark, LA or Miami). Your client's broker files entry, pays duty and arranges last-mile freight.",
  },
  apac: {
    ddp: "We coordinate with our APAC freight partners to clear customs, pay GST/duty and deliver to the project address. Recommended for residential and hospitality projects.",
    dap: "Goods land at the destination port duty-unpaid. Your appointed broker clears the shipment and arranges onward delivery — common for studios with established freight relationships.",
  },
  other: {
    ddp: "Where local infrastructure permits, we'll arrange full landed delivery — taxes, duty and last-mile included. Available on request.",
    dap: "Goods are delivered to the nearest serviceable port or hub; local clearance and onward transport handled by your appointed agent.",
  },
};

const ShippingTermsExplainer = () => {
  const supportedCountries = useMemo(() => DESTINATIONS.map((d) => d.country), []);
  const inferredDefault = useMemo(
    () => inferSupportedCountry(supportedCountries, "United Kingdom"),
    [supportedCountries],
  );
  const [country, setCountry] = useState<string>(inferredDefault);

  const destination = useMemo(
    () => DESTINATIONS.find((d) => d.country === country) ?? DESTINATIONS[0],
    [country],
  );
  const copy = REGION_COPY[destination.region];

  return (
    <section
      aria-labelledby="shipping-terms-explainer-title"
      className="w-full bg-background border-y border-border"
    >
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 md:mb-10"
        >
          <h2
            id="shipping-terms-explainer-title"
            className="font-display text-2xl md:text-3xl text-foreground mb-3"
          >
            Shipping Terms — DDP or DAP?
          </h2>
          <p className="font-body text-sm text-muted-foreground max-w-2xl mx-auto">
            Choose your destination to see how each Incoterm applies to your project.
          </p>
        </motion.div>

        {/* Destination selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 mb-8 md:mb-10">
          <label
            htmlFor="shipping-explainer-country"
            className="font-body text-xs uppercase tracking-[0.18em] text-muted-foreground text-center sm:text-left"
          >
            Destination
          </label>
          <div className="relative">
            <select
              id="shipping-explainer-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="appearance-none bg-background border border-border rounded-full px-5 py-2 pr-10 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-border/60 min-w-[220px]"
            >
              {DESTINATIONS.map((d) => (
                <option key={d.country} value={d.country}>
                  {d.country}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
              ▾
            </span>
          </div>
        </div>

        {/* VAT / tax note for the chosen destination */}
        <p className="font-body text-xs md:text-sm text-center text-muted-foreground mb-8 italic">
          Tax & duty profile for {destination.country}: <span className="not-italic text-foreground/80">{destination.vatNote}</span>
        </p>

        {/* DDP vs DAP cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <motion.article
            key={`ddp-${country}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="border border-border rounded-lg p-6 bg-muted/20"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-foreground/5 text-foreground">
                <Truck className="w-4 h-4" />
              </span>
              <h3 className="font-display text-lg text-foreground">DDP — Delivered Duty Paid</h3>
            </div>
            <p className="font-body text-sm leading-relaxed text-muted-foreground mb-4">
              {copy.ddp}
            </p>
            <ul className="font-body text-xs text-foreground/80 space-y-1.5">
              <li>• Single all-inclusive landed price</li>
              <li>• We are Importer of Record</li>
              <li>• Best for residential & turn-key projects</li>
            </ul>
          </motion.article>

          <motion.article
            key={`dap-${country}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="border border-border rounded-lg p-6 bg-muted/20"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-foreground/5 text-foreground">
                <FileCheck2 className="w-4 h-4" />
              </span>
              <h3 className="font-display text-lg text-foreground">DAP — Delivered At Place</h3>
            </div>
            <p className="font-body text-sm leading-relaxed text-muted-foreground mb-4">
              {copy.dap}
            </p>
            <ul className="font-body text-xs text-foreground/80 space-y-1.5">
              <li>• Lower freight invoice; you pay duty/VAT directly</li>
              <li>• Your studio or broker is Importer of Record</li>
              <li>• Best when input VAT is reclaimable</li>
            </ul>
          </motion.article>
        </div>

        <p className="font-body text-xs text-center text-muted-foreground mt-6">
          Final Incoterm is confirmed on your quotation — switch any time before deposit.
        </p>
      </div>
    </section>
  );
};

export default ShippingTermsExplainer;
