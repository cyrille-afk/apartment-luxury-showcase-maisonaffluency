# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/02208d51-b513-401f-a97f-9e38a2a4260f

## iPhone Standalone (PWA) Preview Checklist

Use this checklist after any change to viewport meta, `manifest.json`,
`theme-color`, safe-area padding, or fixed/sticky bars (top nav, cookie
banner, mobile bottom bar). iOS caches the manifest at install time, so
**you must reinstall the app** to see manifest/theme-color changes.

### 1. Reinstall the app on iPhone

1. Long-press the **Maison Affluency** icon on the Home Screen → **Remove App** → **Delete from Home Screen**.
2. Open **Safari** (not Chrome) and go to `https://maisonaffluency.com`.
   - Important: the Lovable preview URL won't reflect manifest changes — only the live domain does.
3. Fully reload: tap the address bar → pull down to refresh, or close and reopen the Safari tab.
4. Tap the **Share** icon (square with arrow ↑) at the bottom.
5. Scroll down → **Add to Home Screen** → **Add**.
6. Launch the app from the **Home Screen icon** (not from Safari).

### 2. Screenshots to capture

Take a screenshot (Side button + Volume Up) on each of the following and save them for review:

- [ ] **Home — portrait**, scrolled to top. Check: status bar (clock, battery) sits in a clean white strip above the logo; nothing overlaps the burger menu or logo.
- [ ] **Home — portrait**, burger menu open. Check: menu items aren't clipped by the notch / Dynamic Island.
- [ ] **Home — landscape**. Check: notch on the left doesn't overlap the logo or nav icons.
- [ ] **Designers Directory — portrait**, scrolled mid-page. Check: sticky filters (if any) clear the status bar.
- [ ] **A product page — portrait**, scrolled to bottom. Check: the iPhone home indicator bar at the bottom doesn't sit on top of the cookie banner, sticky CTA, or footer links.
- [ ] **Trade login / any modal** — portrait. Check: dialog close button isn't hidden behind the notch.
- [ ] **Cookie consent banner visible** (clear cookies via footer → Cookie Settings, then reload). Check: banner sits above the home indicator with breathing room.

### 3. What to look for in each screenshot

- **Top overlap**: status bar icons must NOT sit on top of the logo, burger, or any text. There should be a solid white strip above the nav.
- **Notch / Dynamic Island**: in landscape, no content should disappear behind the left-side notch.
- **Bottom home indicator**: the thin black/white bar at the bottom must NOT cover sticky bars, buttons, or footer links.
- **Color seam**: the status bar background should match the page header (white). No dark band or mismatched color strip.
- **Scroll behaviour**: pull-to-refresh should NOT reveal Safari chrome — if it does, the app launched from Safari, not the Home Screen icon.

### 4. If something overlaps

Note the exact page + screenshot, then ask Lovable to patch the affected component
with `pt-[env(safe-area-inset-top)]` (top) or `pb-[env(safe-area-inset-bottom)]` (bottom).


## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/02208d51-b513-401f-a97f-9e38a2a4260f) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/02208d51-b513-401f-a97f-9e38a2a4260f) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
