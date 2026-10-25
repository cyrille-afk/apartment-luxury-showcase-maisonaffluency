import { afterEach, describe, expect, it } from "vitest";
import { watchAppStylesheetReady } from "./appStylesheetReady";

afterEach(() => {
  document.getElementById("app-css")?.remove();
  document.getElementById("static-hero-copy")?.remove();
  document.documentElement.classList.remove("home-fouc", "app-css");
});

function stylesheet(loaded: boolean) {
  const link = document.createElement("link");
  link.id = "app-css";
  link.media = "print";
  Object.defineProperty(link, "sheet", { value: loaded ? {} : null });
  document.head.append(link);
  document.documentElement.classList.add("home-fouc");
  return link;
}

describe("homepage stylesheet handoff", () => {
  it("reveals a return visit when CSS is already loaded but its boot marker is missing", () => {
    const link = stylesheet(true);
    const copy = document.createElement("div");
    copy.id = "static-hero-copy";
    document.body.append(copy);
    watchAppStylesheetReady(document);
    expect(document.documentElement.classList.contains("home-fouc")).toBe(false);
    expect(document.documentElement.classList.contains("app-css")).toBe(true);
    expect(link.media).toBe("all");
    expect(copy.style.display).toBe("none");
  });
  it("keeps the initial guard until delayed CSS loads, then releases it", () => {
    const link = stylesheet(false);
    watchAppStylesheetReady(document);
    expect(document.documentElement.classList.contains("home-fouc")).toBe(true);
    link.dispatchEvent(new Event("load"));
    expect(document.documentElement.classList.contains("home-fouc")).toBe(false);
    expect(link.media).toBe("all");
  });
  it("removes the old load listener when the route effect is cleaned up", () => {
    const link = stylesheet(false);
    const cleanup = watchAppStylesheetReady(document);
    cleanup();
    link.dispatchEvent(new Event("load"));
    expect(document.documentElement.classList.contains("app-css")).toBe(false);
  });
});