import { Component, ReactNode } from "react";

interface Props {
  section: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ScrapeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-destructive/30 rounded-md p-3 bg-destructive/5">
          <p className="font-display text-xs text-destructive">
            {this.props.section} failed to load
          </p>
          <p className="font-body text-[10px] text-muted-foreground mt-1">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-2 py-1 rounded border border-border font-body text-[10px] text-foreground hover:bg-muted transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ScrapeErrorBoundary;
