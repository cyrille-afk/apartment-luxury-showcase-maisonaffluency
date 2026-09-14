# Consolidate Project Folders into Projects

## Goal
Make Projects the single workspace hub while preserving all existing folder-management capabilities and direct Project Studio shortcuts.

## Changes
- Remove the standalone **Project Folders** item from desktop and mobile navigation.
- Keep the two recent active-project shortcuts nested beneath **Projects**.
- Add a top-level view switch inside Projects for **Projects** and **Folders & Drafts**.
- Reuse the existing live folder view inside the new Projects tab, including AI/manual filters, folder creation, sharing, deletion, project links, and existing data.
- Keep folder detail pages working and route the old `/trade/boards` index into the consolidated Projects folder view so bookmarks do not break.
- Move the mobile-to-desktop alert indicator onto Projects, since folders now live there.
- Normalize primary sidebar row spacing for a consistent editorial rhythm.

## Technical details
- Give the existing folder screen an embedded mode that omits its standalone page title and outer metadata while retaining all management behavior.
- Drive the Projects/Folders view from a clean query parameter so the selected view is linkable and survives refreshes.
- Preserve `/trade/boards/:id` for individual folder editing.
- Verify desktop navigation, the consolidated folder view, legacy redirect behavior, and direct Project Studio shortcuts.
