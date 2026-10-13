import { Component, type ReactNode } from "react";

/** Catches render crashes in the 3D canvas so the page survives and can restore a working scene. */
export class SceneErrorBoundary extends Component<{ children: ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[visualiser] render error — restoring last working scene", error);
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
