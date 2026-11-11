import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickTour, startTradeQuickTour } from "./QuickTour";
import { replayFelixTour } from "./felixTourUtils";

const state = vi.hoisted(() => ({ path: "/trade/the-collection", navigate: vi.fn() }));
vi.mock("@/lib/router-compat", () => ({ useLocation: () => ({ pathname: state.path }), useNavigate: () => state.navigate }));
vi.mock("./useDesktopTradeTour", () => ({ useDesktopTradeTour: () => true }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) }) } }));
vi.mock("@/lib/analytics", () => ({ trackTour: { complete: vi.fn(), skip: vi.fn(), stepView: vi.fn() } }));
const track = vi.fn();
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); track.mockReset(); state.path = "/trade/the-collection";
  window.__lovableEvents = { track };
});
afterEach(() => { cleanup(); delete window.__lovableEvents; });

describe("onboarding analytics", () => {
  it("records a start and one view per step per run, including replayed runs", () => {
    const view = render(<QuickTour />);
    act(startTradeQuickTour);
    view.rerender(<QuickTour />);
    expect(track.mock.calls.filter(([name]) => name === "project.onboarding_tour_started")).toHaveLength(1);
    expect(track.mock.calls.filter(([name]) => name === "project.onboarding_tour_step_viewed")).toHaveLength(1);
    act(startTradeQuickTour);
    expect(track.mock.calls.filter(([name]) => name === "project.onboarding_tour_step_viewed")).toHaveLength(2);
  });
  it("does not count a requested step before its page renders", () => {
    state.path = "/trade/settings";
    const view = render(<QuickTour />);
    act(startTradeQuickTour);
    expect(track.mock.calls.some(([name]) => name === "project.onboarding_tour_step_viewed")).toBe(false);
    state.path = "/trade/the-collection";
    view.rerender(<QuickTour />);
    expect(track).toHaveBeenCalledWith("project.onboarding_tour_step_viewed", expect.objectContaining({ step_id: "showroom", step_number: 1 }));
  });
  it("last-step dismissal is an exit, not completion", () => {
    localStorage.setItem("trade_quick_tour_step", "4"); state.path = "/trade/tools";
    render(<QuickTour />);
    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(track).toHaveBeenCalledWith("project.onboarding_tour_exited", expect.objectContaining({ step_number: 5, reason: "dismissed" }));
    expect(track.mock.calls.some(([name]) => name === "project.onboarding_tour_completed")).toBe(false);
  });
  it("counts explicit finish once", () => {
    localStorage.setItem("trade_quick_tour_step", "4"); state.path = "/trade/tools";
    render(<QuickTour />);
    fireEvent.click(screen.getByRole("button", { name: /Finish.*Open Workspace/i }));
    expect(track).toHaveBeenCalledWith("project.onboarding_tour_completed", expect.objectContaining({ tour: "quick", step_number: 5, total_steps: 5 }));
    expect(track.mock.calls.filter(([name]) => name === "project.onboarding_tour_completed")).toHaveLength(1);
  });
  it("page exit records the current step once without conflating route changes", () => {
    render(<QuickTour />); act(startTradeQuickTour);
    act(() => { window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("pagehide")); });
    expect(track.mock.calls.filter(([name]) => name === "project.onboarding_tour_exited")).toHaveLength(1);
    expect(track).toHaveBeenCalledWith("project.onboarding_tour_exited", expect.objectContaining({ reason: "page_exit", step_number: 1 }));
  });
  it("replay records intent and resets to step one without sending personal data", () => {
    localStorage.setItem("felix_tour_progress_v1", "18");
    replayFelixTour();
    expect(track).toHaveBeenCalledExactlyOnceWith("project.onboarding_tour_replayed", { tour: "felix" });
    expect(localStorage.getItem("felix_tour_progress_v1")).toBeNull();
  });
  it("works when the injected tracker is unavailable", () => {
    delete window.__lovableEvents;
    render(<QuickTour />);
    expect(() => act(startTradeQuickTour)).not.toThrow();
    expect(() => replayFelixTour()).not.toThrow();
  });
});