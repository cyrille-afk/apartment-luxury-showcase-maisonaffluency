import { useEffect, useState, Suspense, type ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { bootClient } from "@/lib/clientBoot";
import HmrStatusBanner from "@/components/dev/HmrStatusBanner";
import BuildUpdateBanner from "@/components/BuildUpdateBanner";
import AppRecoveryBoundary from "@/components/AppRecoveryBoundary";
import { PwaPendingAuthConsumer } from "@/components/PwaPendingAuthConsumer";
import { mobileManifestHref } from "@/lib/pwaLaunchManifest";
import {
  AuthProvider,
  CheckoutFormProvider,
  ClientCurrencyDetection,
  CompareProvider,
  CookieConsent,
  GlobalCanonical,
  GoogleOAuthReturnRecovery,
  HomeRouteSync,
  MobilePreviewShareButton,
  NotFound,
  PageTracker,
  PreviewViewContinuity,
  ProjectInventoryProvider,
  RealtimeMultiplexerProvider,
  RouteScrollLockFailsafe,
  SameOriginLinkGuard,
  ScrollToTopOnNavigate,
  Sonner,
  StudioProvider,
  Toaster,
  TooltipProvider,
  TradeCopilotProvider,
  VisualiserMaterialProvider,
  WishlistProvider,
  useLegacyAppEffects,
} from "@/app/legacyShell";
import {
  CRITICAL_STYLE,
  HEAD_INLINE_SCRIPTS,
  JSON_LD_BLOCKS,
  NOSCRIPT_HTML,
  STATIC_HERO_HTML,
} from "@/app/documentMarkup";

// ported from main.tsx — browser start-up safeguards must run before any page code.
if (typeof window !== "undefined") bootClient();

const SITE_TITLE = "Maison Affluency | Luxury Collectible Design Singapore";
const SITE_DESCRIPTION =
  "Curated luxury collectible furniture, bespoke interiors, and contemporary design by world-renowned designers and ateliers in Singapore.";
const SITE_IMAGE =
  "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg";
const HERO = "https://res.cloudinary.com/dif1oamtj/image/upload/c_scale%2Cw_{w}%2Cq_auto:good%2Cf_avif/v1781920000/AffluencySG_194-22.jpg_macpwj";
const hero = (w: number) => HERO.replace("{w}", String(w));

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { httpEquiv: "Cache-Control", content: "no-cache, no-store, must-revalidate" },
      { httpEquiv: "Pragma", content: "no-cache" },
      { httpEquiv: "Expires", content: "0" },
      { name: "app-build-id", content: String(import.meta.env["VITE_APP_BUILD_ID"] ?? "dev") },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, viewport-fit=cover" },
      { title: SITE_TITLE },
      { name: "author", content: "Maison Affluency" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      {
        name: "keywords",
        content:
          "luxury furniture, collectible design, interior design Singapore, bespoke furniture, contemporary design, French design, ateliers, curated interiors, Maison Affluency",
      },
      { name: "pinterest", content: "nopin" },
      { name: "google-site-verification", content: "I5rZclKz61ck4fzMMmvUVK4Q03lhXT5bHMNB-V8wEEg" },
      { property: "og:site_name", content: "Maison Affluency" },
      { property: "og:locale", content: "en_SG" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:url", content: "https://www.maisonaffluency.com/" },
      { property: "og:image", content: SITE_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: SITE_IMAGE },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Maison Affluency" },
      { id: "mobile-theme-color", name: "theme-color", content: "#000000", media: "(max-width: 767px)" },
      { name: "theme-color", content: "#ffffff", media: "(prefers-color-scheme: light) and (min-width: 768px)" },
      { name: "theme-color", content: "#0a0a0a", media: "(prefers-color-scheme: dark) and (min-width: 768px)" },
      { name: "format-detection", content: "telephone=no" },
      { name: "color-scheme", content: "light" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://res.cloudinary.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://res.cloudinary.com" },
      { rel: "preconnect", href: "https://dcrauiygaezoduwdjmsm.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://dcrauiygaezoduwdjmsm.supabase.co" },
      { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/PlayfairDisplay-500.woff2", crossOrigin: "anonymous" },
      { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/Lora-Regular.woff2", crossOrigin: "anonymous" },
      { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/Cinzel-Bold.woff2", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "image",
        type: "image/avif",
        href: hero(960),
        imageSrcSet: [480, 780, 960, 1280].map((w) => `${hero(w)} ${w}w`).join(", "),
        imageSizes: "100vw",
        media: "(max-width: 640px)",
      },
      {
        rel: "preload",
        as: "image",
        type: "image/avif",
        href: hero(1440),
        imageSrcSet: [828, 1080, 1440].map((w) => `${hero(w)} ${w}w`).join(", "),
        imageSizes: "100vw",
        media: "(min-width: 641px)",
      },
    ],
    styles: [{ children: CRITICAL_STYLE }],
    scripts: [
      ...HEAD_INLINE_SCRIPTS.map((children) => ({ children })),
      ...JSON_LD_BLOCKS.map((children) => ({ type: "application/ld+json", children })),
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <Suspense fallback={null}>
      <NotFound />
    </Suspense>
  ),
  errorComponent: RootErrorComponent,
});

// On the homepage the first screen is painted by the inline static hero, so
// the site-wide stylesheet loads without blocking that paint; #root stays
// hidden until it arrives. Every other page keeps a normal blocking stylesheet.
const HOME_CSS_SWAP =
  "(function(){var l=document.getElementById('app-css');if(!l)return;function d(){l.media='all';document.documentElement.classList.add('app-css')}if(l.sheet)d();else l.addEventListener('load',d)})();";

function RootShell({ children }: { children: ReactNode }) {
  const isHome = useRouterState({ select: (s) => s.location.pathname === "/" });
  const manifestHref = useRouterState({ select: (s) => mobileManifestHref(s.location.pathname, s.location.searchStr) });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href={manifestHref} />
        <link
          id="app-css"
          rel="stylesheet"
          href={appCss}
          media={isHome && !hydrated ? "print" : undefined}
          suppressHydrationWarning
        />
        {isHome && (
          <>
            <style>{"html.home-fouc:not(.app-css) #root{visibility:hidden}"}</style>
            <script dangerouslySetInnerHTML={{ __html: HOME_CSS_SWAP }} />
            <noscript>
              <link rel="stylesheet" href={appCss} />
            </noscript>
          </>
        )}
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: STATIC_HERO_HTML }} />
        <div id="root">{children}</div>
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: NOSCRIPT_HTML }} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const showDeferredUi = useLegacyAppEffects();

  return (
    <AppRecoveryBoundary>
      <HelmetProvider>
        <AuthProvider>
          <PwaPendingAuthConsumer>
          <ClientCurrencyDetection />
          <RealtimeMultiplexerProvider>
            <StudioProvider>
              <CompareProvider>
                <WishlistProvider>
                  <CheckoutFormProvider>
                    <QueryClientProvider client={queryClient}>
                      <GoogleOAuthReturnRecovery />
                      <GlobalCanonical />
                      <HomeRouteSync />
                      <SameOriginLinkGuard />
                      <RouteScrollLockFailsafe />
                      <ScrollToTopOnNavigate />
                      <PreviewViewContinuity />
                      <TradeCopilotProvider>
                        <VisualiserMaterialProvider>
                          <ProjectInventoryProvider>
                            <Outlet />
                          </ProjectInventoryProvider>
                        </VisualiserMaterialProvider>
                      </TradeCopilotProvider>

                      {/* Viewport-level product controls mount here, outside every route. */}
                      <div id="product-root-overlays" className="contents" />

                      {showDeferredUi && (
                        <Suspense fallback={null}>
                          <TooltipProvider>
                            <Toaster />
                            <Sonner />
                            <PageTracker />
                            <CookieConsent />
                          </TooltipProvider>
                        </Suspense>
                      )}
                      {showDeferredUi && (
                        <Suspense fallback={null}>
                          <MobilePreviewShareButton />
                        </Suspense>
                      )}
                    </QueryClientProvider>
                  </CheckoutFormProvider>
                </WishlistProvider>
              </CompareProvider>
            </StudioProvider>
          </RealtimeMultiplexerProvider>
          </PwaPendingAuthConsumer>
        </AuthProvider>
      </HelmetProvider>
      <BuildUpdateBanner />
      <HmrStatusBanner />
    </AppRecoveryBoundary>
  );
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl">This page didn&apos;t load</h1>
        <p className="mt-3 font-body text-sm text-muted-foreground">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            className="bg-primary px-4 py-2 font-body text-xs uppercase tracking-[0.14em] text-primary-foreground"
            onClick={() => {
              void router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a href="/" className="border border-border px-4 py-2 font-body text-xs uppercase tracking-[0.14em]">
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
