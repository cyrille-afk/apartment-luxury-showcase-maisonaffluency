import { Component, type ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class TradeErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Trade portal error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <p className="font-body text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">
          Something Went Wrong
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-foreground mb-4">
          Unexpected Error
        </h1>
        <p className="font-body text-sm text-muted-foreground max-w-md leading-relaxed mb-10">
          We encountered an issue loading this page. Please try refreshing or return to the dashboard.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 px-7 py-3 bg-foreground text-background font-body text-xs uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Page
          </button>
          <Link
            to="/trade"
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center gap-2 px-7 py-3 border border-border font-body text-xs uppercase tracking-[0.2em] rounded-full text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
        </div>
        <p className="font-body text-xs text-muted-foreground mt-16">
          Persistent issues?{" "}
          <a href="mailto:concierge@myaffluency.com" className="underline underline-offset-4 hover:text-foreground transition-colors">
            concierge@myaffluency.com
          </a>
        </p>
      </div>
    );
  }
}

export default TradeErrorBoundary;
