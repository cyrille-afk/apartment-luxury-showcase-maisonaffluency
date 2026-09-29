import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { failed: boolean };

const isEdgeFailure = (reason: unknown) => {
  const error = reason as { name?: string; message?: string; context?: { status?: number } } | null;
  const message = String(error?.message ?? reason ?? "");
  return /Functions(Http|Fetch|Relay)Error/.test(error?.name ?? "") ||
    /Edge function returned 5\d\d|IDLE_TIMEOUT|Failed to send a request to the Edge Function|edge function.*(?:timed? out|timeout)/i.test(message) ||
    error?.context?.status === 504;
};

/** Keeps a failed React tree recoverable without interrupting healthy pages for background failures. */
export default class AppRecoveryBoundary extends Component<Props, State> {
  state: State = { failed: false };
  private pendingCheck: number | null = null;

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[app] unable to render page:", error, info.componentStack);
  }

  componentDidMount() {
    window.addEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("unhandledrejection", this.onUnhandledRejection);
    if (this.pendingCheck !== null) window.clearTimeout(this.pendingCheck);
  }

  private onUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (!isEdgeFailure(event.reason) || this.state.failed) return;
    // A background request must not replace a healthy page. Wait for React to
    // settle, then recover only when nothing has rendered inside the app root.
    if (this.pendingCheck !== null) window.clearTimeout(this.pendingCheck);
    this.pendingCheck = window.setTimeout(() => {
      this.pendingCheck = null;
      const root = document.getElementById("root");
      if (root && root.childElementCount === 0) this.setState({ failed: true });
    }, 1500);
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col px-6 sm:px-10">
        <header className="w-full max-w-6xl mx-auto border-b border-border py-7 sm:py-9">
          <a href="/" className="font-display uppercase text-lg sm:text-xl text-foreground" aria-label="Maison Affluency home">
            Maison Affluency
          </a>
        </header>
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col justify-center py-20 sm:py-28">
          <p className="font-body text-xs uppercase text-primary mb-8">Maison Affluency · A momentary pause</p>
          <h1 className="font-display text-4xl sm:text-6xl leading-tight max-w-2xl mb-6">
            A moment of interruption.
          </h1>
          <p className="font-body text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mb-10">
            Our collection is taking longer than expected to respond. Please try again in a moment.
          </p>
          <Button onClick={() => window.location.reload()} size="lg" className="self-start uppercase text-xs font-body px-8">
            <RefreshCw aria-hidden="true" /> Retry
          </Button>
        </div>
        <footer className="w-full max-w-6xl mx-auto border-t border-border py-7 font-body text-xs text-muted-foreground">
          Maison Affluency
        </footer>
      </main>
    );
  }
}