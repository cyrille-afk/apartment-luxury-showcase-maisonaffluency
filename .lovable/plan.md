## Mobile UI fixes — Designers & Makers page

All edits are scoped to `src/components/DesignersDirectory.tsx` (mobile-only branches; desktop layout untouched).

### 1. Show full description (no truncation) on mobile
Line 1448 currently uses `line-clamp-3 md:line-clamp-none`. Remove the mobile clamp so the full paragraph renders on mobile too (desktop already shows full text).

### 2. Search field — placeholder + icon position
Mobile search input (around lines 1550–1564):
- Change `placeholder="Designer..."` → `placeholder="Search"`.
- Move the magnifying-glass `<Search />` icon from `left-3` to `right-3`.
- Adjust input padding: `pl-4 pr-9` instead of `pl-8 pr-7`.
- When a query exists, the clear `×` button replaces the icon on the right (icon hides while typing) so the two don't overlap.

### 3. Shorter search field
Replace the search wrapper class `relative flex-1` with a fixed/limited width such as `relative w-[60%] max-w-[14rem]` so it no longer fills the row.

### 4. Filter below the search field
Restructure the mobile row (lines 1474–1566) from a single `flex items-center gap-3` row containing `[Filter, Search]` into a vertical stack:
- Top: Search input (shorter, see #3), aligned left.
- Below: Filter pill button.
- Use `flex flex-col items-start gap-3`.

### 5. Letter "A" open by default
In the mobile directory map (lines 1728–1740), pass `defaultOpen={letter === alphaGroups[0]?.[0] || forcedLetters.has(letter) || !!searchQuery.trim()}` so the first alphabet group (typically "A") is expanded on landing. `MobileLetterRow` already accepts `defaultOpen` and applies it to its initial state.

### 6. First carousel card fully visible
In `MobileLetterRow` (lines 633–656), the swipe row uses `-mx-4 px-4` with cards at `w-[78%] max-w-[320px]`. To guarantee the first card is never clipped:
- Keep `snap-x snap-mandatory` and `snap-start` on each card.
- Add `scroll-pl-4` on the scroll container so the first snap point aligns to the visible left padding instead of the negative-margin edge.
- Ensure horizontal padding (`pl-4 pr-8`) on the inner flex row provides the left flush + right peek explicitly (drop `-mx-4` reliance for the leading edge).

### Out of scope
- Desktop layout (filter/search row, A–Z bar, sidebar) unchanged.
- No business logic, data, or routing changes.
