
Goal: fix the real cause of the quote rendering bug so `<strong>` no longer appears as literal text in the Alinea biography.

What I found
- The bold renderer already exists in `src/components/EditorialBiography.tsx`. It can tokenize and render `<strong>...</strong>`.
- The problem is not mainly the editor toolbar anymore.
- On the trade designer/atelier profile page, the opening biography paragraphs are rendered as raw text in `src/pages/TradeAtelierProfile.tsx`:
  - current code uses `{p}`
  - so any inline HTML like `<strong>...</strong>` is printed literally
- The public profile page already does this correctly with `renderParagraph(p)`, which is why the fix needs to be applied to the trade page’s hero paragraph rendering too.

Implementation plan
1. Update `src/pages/TradeAtelierProfile.tsx`
   - Import/use `renderParagraph` from `EditorialBiography`
   - Replace the raw hero paragraph output `{p}` with `{renderParagraph(p)}`
   - Keep the existing paragraph spacing/layout unchanged

2. Verify the same opening-biography path everywhere relevant
   - Check both the designer-profile hero variant and atelier-profile variant in that file
   - Confirm there are no other raw biography paragraph outputs bypassing the shared renderer

3. Sanity-check the Alinea content source
   - Confirm the visible quote is coming from the `designers.biography` field for `leo-aerts-alinea`
   - If the saved text still contains older unwanted accented branding, clean that content in the actual source of truth as a separate content update

4. Validate the fix in preview
   - Re-open the Alinea profile from both admin preview and live profile route
   - Confirm the quote renders bold instead of showing `<strong>` text
   - Confirm no regression for links, italics, or inline quote styling in opening paragraphs

Technical details
- File with the actual bug: `src/pages/TradeAtelierProfile.tsx`
- Correct reference implementation: `src/pages/PublicDesignerProfile.tsx`
- Shared renderer already handling inline markup: `src/components/EditorialBiography.tsx` via `renderParagraph()`

Why the previous answers were misleading
- The prior change focused on `EditorialBiography`, but this quote is being displayed in a special “hero/opening paragraphs” path on the trade page that was not using `EditorialBiography`’s inline renderer for those first paragraphs.
- So the bold support existed, but that specific rendering path bypassed it.
