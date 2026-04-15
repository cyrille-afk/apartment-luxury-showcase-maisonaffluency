

## Problem

The SEO descriptions are **not showing on the published site** because frontend changes require clicking **"Update"** in the publish dialog to go live. Backend changes (database, edge functions) deploy instantly, but UI code does not.

The code itself is correct — `description` is:
1. Present in the `PublicLightboxItem` interface
2. Fetched from the `designer_curator_picks_public` view (which includes `description`)
3. Passed through in all consumers (`Gallery.tsx`, `PublicDesignerProfile.tsx`, `NewInSpotlight.tsx`, `PublicFavorites.tsx`)
4. Rendered in the lightbox below materials/dimensions

## Action Required

**Re-publish the site**: Click the **Publish** button (top-right) → click **Update** to deploy the latest frontend code to the published URL.

No code changes are needed — this is purely a deployment step.

