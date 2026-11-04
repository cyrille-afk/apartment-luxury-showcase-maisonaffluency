import { afterEach, describe, expect, it, vi } from "vitest";
import { appStylesheetRecoveryScript, installAppStylesheetRecovery } from "./appStylesheetRecovery";

afterEach(() => {
  vi.useRealTimers();
  document.getElementById("app-css")?.remove();
  document.getElementById("app-css-recovery")?.remove();
  document.getElementById("static-hero-copy")?.remove();
  document.documentElement.classList.remove("home-fouc", "app-css");
  document.documentElement.removeAttribute("data-stylesheet-recovery");
});
function primary(loaded = false) {
  const link = document.createElement("link");
  link.id = "app-css";
  link.media = "print";
  Object.defineProperty(link, "sheet", { value: loaded ? { cssRules: [{}] } : null });
  document.head.append(link);
  document.documentElement.classList.add("home-fouc");
  vi.useFakeTimers();
  return link;
}
describe("stylesheet recovery", () => {
  it("does not request a backup when the primary stylesheet is already loaded", () => {
    primary(true);
    installAppStylesheetRecovery(document, "/backup.css");
    vi.advanceTimersByTime(16000);
    expect(document.getElementById("app-css-recovery")).toBeNull();
    expect(document.documentElement.classList.contains("home-fouc")).toBe(false);
  });
  it("loads exactly one independent backup after failure and reveals only after success", () => {
    const link = primary();
    installAppStylesheetRecovery(document, "/backup.css");
    link.dispatchEvent(new Event("error"));
    installAppStylesheetRecovery(document, "/backup.css");
    link.dispatchEvent(new Event("error"));
    expect(document.querySelectorAll("#app-css-recovery")).toHaveLength(1);
    expect(document.documentElement.classList.contains("home-fouc")).toBe(true);
    const backup = document.getElementById("app-css-recovery");
    expect(backup?.getAttribute("href")).toBe("/backup.css");
    backup?.dispatchEvent(new Event("load"));
    expect(document.documentElement.classList.contains("home-fouc")).toBe(false);
    expect(document.documentElement.getAttribute("data-stylesheet-recovery")).toBe("loaded");
  });
  it("recovers a missed error or stalled request after a bounded wait", () => {
    primary();
    installAppStylesheetRecovery(document, "/backup.css");
    vi.advanceTimersByTime(7999);
    expect(document.getElementById("app-css-recovery")).toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.getElementById("app-css-recovery")).not.toBeNull();
  });
  it("does not loop or falsely reveal when the backup also fails", () => {
    const link = primary();
    installAppStylesheetRecovery(document, "/backup.css");
    link.dispatchEvent(new Event("error"));
    document.getElementById("app-css-recovery")?.dispatchEvent(new Event("error"));
    vi.advanceTimersByTime(60000);
    link.dispatchEvent(new Event("error"));
    expect(document.querySelectorAll("#app-css-recovery")).toHaveLength(1);
    expect(document.documentElement.getAttribute("data-stylesheet-recovery")).toBe("failed");
    expect(document.documentElement.classList.contains("app-css")).toBe(false);
  });
  it("returns to the primary when it arrives late without leaving duplicate styles", () => {
    const link = primary();
    installAppStylesheetRecovery(document, "/backup.css");
    link.dispatchEvent(new Event("error"));
    document.getElementById("app-css-recovery")?.dispatchEvent(new Event("load"));
    link.dispatchEvent(new Event("load"));
    expect(document.getElementById("app-css-recovery")).toBeNull();
    expect(link.media).toBe("all");
    expect(document.documentElement.hasAttribute("data-stylesheet-recovery")).toBe(false);
  });
  it("the pre-hydration script installs the same recovery independently", () => {
    const link = primary();
    new Function("document", appStylesheetRecoveryScript("/backup.css"))(document);
    link.dispatchEvent(new Event("error"));
    expect(document.getElementById("app-css-recovery")?.getAttribute("href")).toBe("/backup.css");
  });
});