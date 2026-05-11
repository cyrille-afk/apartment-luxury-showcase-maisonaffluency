import { Link, useParams, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Smartphone,
  MonitorSmartphone,
  CheckSquare,
  AlertCircle,
} from "lucide-react";
import { trackEvent, trackGuide } from "@/lib/analytics";

const PDF_URL = "/guides/studio-pwa-preview-checklist.pdf";
const SLUG = "pwa-preview-checklist";

export default function TradeGuidePwaPreview() {
  const { slug } = useParams();
  if (slug && slug !== SLUG) return <Navigate to="/trade/guides" replace />;

  return (
    <article className="max-w-3xl mx-auto space-y-10">
      <header className="space-y-4">
        <Link
          to="/trade/guides"
          onClick={() =>
            trackEvent("trade_guide_back_to_list", {
              event_category: "Trade Guides",
              event_label: SLUG,
              guide_slug: SLUG,
            })
          }
          className="inline-flex items-center gap-1 font-body text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> All guides
        </Link>
        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-primary">
          Mobile essentials · v1.0
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground tracking-wide leading-tight">
          Installing Maison Affluency on Your Phone
        </h1>
        <p className="font-body text-base text-muted-foreground">
          Add Maison Affluency to your iPhone or Android home screen so it opens
          like a native app — and run a quick preview check to make sure the
          interface is safe from notches, status bars and gesture handles.
        </p>
        <a
          href={PDF_URL}
          download
          onClick={() => trackGuide.pdfDownload(SLUG, "guide_detail_page", { file_name: PDF_URL.split("/").pop() || PDF_URL })}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-foreground px-4 py-2 font-body text-xs uppercase tracking-wider text-background hover:bg-foreground/90 transition-colors"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download PDF
        </a>
      </header>

      <Section eyebrow="01" title="What a PWA gives you" icon={Smartphone}>
        <p>
          A Progressive Web App (PWA) lets you launch Maison Affluency from your
          home screen without going through an app store. It behaves like a native
          app — full-screen browsing, offline access to previously loaded pages,
          and a dedicated icon.
        </p>
        <DefList
          items={[
            ["One-tap launch", "No browser chrome, no address bar — just the Trade Portal in full screen."],
            ["Offline resilience", "Pages you have already opened remain readable even without signal."],
            ["Auto-updates", "The app refreshes silently in the background whenever we publish improvements."],
            ["Cross-platform", "Same install flow on iPhone, iPad and Android — no separate downloads."],
          ]}
        />
        <Callout title="When this matters most">
          On site visits, in showrooms, or during client presentations where you
          need fast, distraction-free access to quotes, boards and product
          pages.
        </Callout>
      </Section>

      <Section eyebrow="02" title="iPhone & iPad" icon={MonitorSmartphone}>
        <Subsection title="A. Safari install">
          Open <strong>maisonaffluency.com</strong> in Safari, tap the{" "}
          <strong>Share</strong> button (square with arrow), then scroll down and
          tap <strong>Add to Home Screen</strong>. You can edit the label before
          saving.
        </Subsection>
        <Subsection title="B. Launch from the icon">
          Tap the new home-screen icon. Maison Affluency opens in a standalone
          window — pull down to refresh, swipe left/right for back/forward.
        </Subsection>
        <Subsection title="C. Keep Safari as default">
          The PWA uses Safari's engine under the hood, so bookmarks, passwords
          and AutoFill continue to work exactly as before.
        </Subsection>
        <Callout title="Known iOS quirk">
          If the "Add to Home Screen" option is missing, make sure you are not
          in a private tab and that the site has finished loading.
        </Callout>
      </Section>

      <Section eyebrow="03" title="Android" icon={MonitorSmartphone}>
        <Subsection title="A. Chrome install">
          Open <strong>maisonaffluency.com</strong> in Chrome, tap the{" "}
          <strong>⋮</strong> menu, then choose{" "}
          <strong>Add to Home screen</strong>. Confirm the label and tap{" "}
          <strong>Add</strong>.
        </Subsection>
        <Subsection title="B. Samsung Internet &amp; Edge">
          Samsung Internet users: tap the menu button, choose{" "}
          <strong>Add page to</strong> → <strong>Home screen</strong>. Edge
          users: tap <strong>⋯</strong> → <strong>Add to phone</strong> →{" "}
          <strong>Add to home screen</strong>.
        </Subsection>
        <Subsection title="C. Standalone mode">
          On most Android devices the PWA opens in its own task, appears in the
          recent-apps list with a branded splash screen, and supports pull-to
          refresh.
        </Subsection>
      </Section>

      <Section eyebrow="04" title="Preview checklist" icon={CheckSquare}>
        <p>
          After installing, open the app and walk through these five checks to
          confirm the interface is safe on your specific device.
        </p>
        <DefList
          items={[
            ["Status bar safe zone", "Top navigation text and buttons sit below the dynamic island / notch / status bar. Nothing is cropped or unreadable."],
            ["Bottom gesture bar", "The home-indicator strip at the bottom does not overlap primary buttons (e.g., 'Request Quote', 'Add to Board')."],
            ["Landscape rotation", "Rotate to landscape: side margins still clear the notch; images and tables do not overflow the viewport."],
            ["Modal positioning", "Open a product lightbox or quote modal: it is vertically centred and the close button is reachable with one thumb."],
            ["Keyboard push", "Tap into a notes or quantity field: the keyboard slides up and the input remains in view; nothing is trapped behind the keys."],
          ]}
        />
        <Callout title="If something overlaps">
          Screenshot the issue and share it with your Maison Affluency contact.
          We maintain per-device safe-area padding and update it with each
          release.
        </Callout>
      </Section>

      <Section eyebrow="05" title="Quick fixes" icon={AlertCircle}>
        <DefList
          items={[
            ["Icon not appearing", "Hard-close Safari/Chrome, reopen the site, wait for the page to fully load, then try Share → Add again."],
            ["Still seeing browser UI", "Delete the home-screen icon and re-add it. On iOS, make sure you are using Safari, not an in-app browser."],
            ["Old content after update", "Pull down to force a refresh. On Android, long-press the icon → App info → Storage → Clear cache."],
            ["Notifications not supported", "iOS PWAs currently do not support push notifications. Use email alerts or check the portal manually."],
          ]}
        />
      </Section>

      <p className="font-body text-xs italic text-muted-foreground border-t border-border pt-6">
        Need help testing on a specific device? Reach out to your Maison
        Affluency contact — we keep a library of safe-area specs for every
        major phone and tablet.
      </p>
    </article>
  );
}

function Section({ eyebrow, title, icon: Icon, children }: { eyebrow: string; title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="font-body text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</span>
      </div>
      <h2 className="font-display text-2xl text-foreground tracking-wide">{title}</h2>
      <div className="space-y-4 font-body text-sm text-foreground/90 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-body text-xs uppercase tracking-wider text-primary mb-1">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function DefList({ items }: { items: [string, string][] }) {
  return (
    <dl className="divide-y divide-border rounded-md border border-border overflow-hidden">
      {items.map(([term, def]) => (
        <div key={term} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-1 md:gap-4 px-3 py-3 bg-card">
          <dt className="font-body text-sm font-medium text-foreground">{term}</dt>
          <dd className="font-body text-sm text-muted-foreground">{def}</dd>
        </div>
      ))}
    </dl>
  );
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 border-l-2 border-l-primary px-4 py-3">
      <p className="font-body text-xs uppercase tracking-wider text-primary mb-1">{title}</p>
      <p className="font-body text-sm text-foreground/90">{children}</p>
    </div>
  );
}
