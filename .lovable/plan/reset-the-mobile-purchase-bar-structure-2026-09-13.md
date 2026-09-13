# Reset the mobile purchase bar structure

## Outcome
- Keep the existing three-step purchase funnel state and transitions untouched.
- Keep the mobile purchase action opening Step 1 of 3: Intent.
- Render one mobile CTA outside the product page’s scrolling `<main>` and portal its fixed surface directly under `document.body`.
- Apply exactly this class list to the CTA container: `fixed bottom-0 left-0 w-full z-50 bg-white border-t border-gray-100 flex justify-between items-center px-6 py-4 h-[76px]`.

## Implementation
1. Remove the dock measurement/device-listener effect and its ref because the fixed CTA must not depend on viewport, resize, or scroll calculations.
2. Preserve `handleMobilePrimary`, `OrderIntakeSheet`, `STEPS`, `canAdvance`, `next()`, and all checkout state logic unchanged.
3. Keep the authoritative mobile CTA mounted after the product page’s closing `</main>` and portaled directly to `document.body`.
4. Verify the CTA remains fixed at the top, middle, and bottom of a mobile product page, then confirm its primary action opens Step 1 of 3: Intent.
