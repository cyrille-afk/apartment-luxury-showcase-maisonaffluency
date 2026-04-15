

## The real bug

"Sofas" is a **subcategory** (under Seating), not a category. When the nav dispatches `{category: "Seating", subcategory: "Sofas"}`:

1. `DesignersDirectory` event handler runs → calls `setSidebarOpen(false)` ✓
2. CategorySidebar re-renders with `activeSubcategory="Sofas"`
3. CategorySidebar's `useEffect` on `activeSubcategory` runs → calls `setIsOpen(true)` → `onOpenChange(true)` → `setSidebarOpen(true)` ✗

The auto-open effect in CategorySidebar **overrides** the close from the nav handler. This also explains the 4-column grid — the sidebar is open, so `sidebarOpen ? 'md:grid-cols-3 lg:grid-cols-4'` applies.

## Fix

**File: `src/components/CategorySidebar.tsx`**
- Remove or guard the auto-open `useEffect`. The sidebar should not self-open when a subcategory is set externally via nav. The parent (`DesignersDirectory`) already controls `isOpen` via the controlled prop — the sidebar shouldn't fight it.
- Keep the expand-parent-category logic (so the correct category accordion expands), but remove the `setIsOpen(true)` call.

**File: `src/components/DesignersDirectory.tsx`**
- No changes needed — the existing `setSidebarOpen(false)` in the event handler is correct.

**File: `src/components/Navigation.tsx`**
- No changes needed — the dispatch logic is correct.

## Result
- Nav click "Sofas" → sidebar stays closed → grid renders 3 columns
- User can still manually open sidebar via Filter button to see the active subcategory highlighted

