# Currency lock + persistent project location across the funnel

## 1. Checkout charges in the destination currency

Today the cart and checkout settle in whichever currency the products are listed in (EUR for Thierry Lemaire, USD for Apparatus). The flag modal only changes display hints, not the money.

Change: the destination chosen in "Shipping destination & currency" becomes the **base settlement currency** for the whole funnel.

- `src/lib/checkout/multiCurrency.ts` gains an optional preferred base. When the shopper has picked a destination (Singapore → SGD), every line is converted with the live rate into that currency before any subtotal, freight, tax or payment maths runs. Without a picked destination, current behaviour is unchanged (single-currency cart keeps its currency; mixed cart picks the dominant one).
- `src/pages/Cart.tsx`, `src/pages/CartIdentify.tsx` and `src/pages/Checkout.tsx` pass the destination currency in, so line prices, subtotal, freight deposit, tax row and the final total all render as clean `SGD $…` values, with a small "Converted from EUR €11,100" note under converted lines.
- The amount sent to payment already travels as converted line prices plus a currency code, so Stripe charges natively in SGD (PayNow already requires SGD — this makes it reachable). Card and PayNow are covered.
- Bank wire (`create-cart-checkout`) is currently hardcoded to USD. It gets the same currency parameter so the reservation record, the invoice figures and the confirmation email match what the shopper saw. Currencies without a live rate fall back to the existing rate table, so checkout is never blocked.
- Freight caps, the S$400 import-GST threshold and the zero-rating rules keep working — they read the same base currency.

## 2. Project location and buyer profile persist globally

- Extend the existing global checkout state (`src/contexts/CheckoutFormContext.tsx`) with `projectCity`, `projectCountry` and `buyerProfile` ("studio" / "private"), stored in localStorage alongside the email so it survives browsing, new tabs and OAuth redirects.
- The 3-step intent drawer (`OrderIntakeSheet`) writes profile and project location into that state the moment they are entered, and pre-fills them when reopened on any other product.
- Secure Checkout pre-fills its country field and the "buying on behalf of a company" state from the same source, so nobody types their country twice.
- Choosing a country in the shipping-destination modal also updates the stored project country (and vice-versa: a saved country pre-selects the flag), keeping one single location of record.

## Technical notes

- Base-currency resolution stays in one shared helper so cart, identify and checkout can never disagree.
- Conversion uses the existing live FX helper with its 10-minute cache and hardcoded fallback table.
- Persistence uses the existing context + localStorage pattern; no new state library.
- Verification: typecheck, the pricing-engine unit tests, and a live browser pass with a mixed EUR/USD cart set to Singapore, confirming SGD line prices, SGD freight, SGD total, and location pre-fill after leaving and re-entering the funnel.
