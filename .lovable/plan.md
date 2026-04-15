
The issue is real: the previous fixes were aimed at the wrong places and the current behavior is still inconsistent.

What I found
- The user is on the public `/designers` flow, not a trade category page.
- `DesignersDirectory` only consumes `category` / `subcategory` URL params on initial mount, then removes them.
- The nav still uses two different behaviors:
  - Mobile category panel goes to `/designers?...` when not already on `/` or `/designers`
  - Desktop mega menu still goes to `/?category=...#designers` when not already on `/` or `/designers`
- That means filtering can arrive through different routes and different timing paths, which is why the fix keeps looping and feeling “not working”.

Root cause
- The state change is split between:
  1. URL params read once on mount
  2. `setDesignerCategory` event listeners
- Because those two paths are not unified, some navigations update the page, some only update URL, and some depend on remount timing.
- Desktop nav is also inconsistent with mobile because it sometimes sends users to homepage designers instead of the dedicated `/designers` page.

Implementation plan
1. Unify category navigation in `Navigation.tsx`
- Create one internal helper for category clicks.
- Behavior:
  - If current route is `/designers`, dispatch `setDesignerCategory`
  - If current route is `/`, navigate to `/designers?category=...` (or with subcategory)
  - For all other public pages, also navigate to `/designers?category=...`
- Remove the desktop-only fallback to `/?category=...#designers` so both mobile and desktop use the same target.

2. Make `DesignersDirectory` react to URL param changes, not just first mount
- Replace the mount-only URL-param effect with a reactive effect keyed to location/search params.
- When category/subcategory appears in the URL:
  - set selected category/subcategory
  - close sidebar
  - keep product grid in its default 3-column state
  - broadcast the filter once
  - clean the URL after state is applied
- This removes the “same page but no visible change” problem.

3. Remove the self-loop risk inside `DesignersDirectory`
- Right now URL-param handling dispatches `setDesignerCategory`, which is also listened to in the same component.
- Refactor so URL-param application updates local state directly instead of rebroadcasting the same event back into itself.
- Keep `setDesignerCategory` only for true external nav-triggered actions.

4. Keep the grid behavior explicit
- Preserve the current directory grid rule:
  - sidebar open = 3/4 columns
  - sidebar closed = 3 columns
- Ensure any nav-triggered category selection always forces `sidebarOpen = false`.

5. Verify both entry points
- Test these exact cases:
  - From `/designers`, click “Sofas” in mobile nav
  - From `/designers`, click “Sofas” in desktop mega menu
  - From another public page, click “Sofas” and land on `/designers`
  - Repeat when a filter is already active
  - Clear filter, then reselect another category

Technical details
```text
Current problem:
nav click
  -> sometimes dispatch event
  -> sometimes navigate with query params
  -> directory reads params only once
  -> later clicks may not update visible state correctly

Planned flow:
nav click
  -> if on /designers: dispatch event
  -> else: navigate to /designers?...
directory
  -> listens for event
  -> also reacts to URL search changes
  -> applies filter directly
  -> closes sidebar
  -> renders 3-col product grid
```

Files to update
- `src/components/Navigation.tsx`
- `src/components/DesignersDirectory.tsx`

Expected outcome
- Selecting “Sofas” from All Categories will always close the filter sidebar on `/designers`
- The product grid will consistently render at the 3-column default
- Mobile and desktop nav will behave the same
- No more looping between partial fixes because URL-param and event handling will be unified
