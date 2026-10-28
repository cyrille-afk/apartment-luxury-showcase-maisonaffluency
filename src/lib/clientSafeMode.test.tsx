import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";

const guardCss = readFileSync("src/styles.css", "utf8");

afterEach(() => {
  document.head.querySelector("#client-mask-test-style")?.remove();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-client-view");
  localStorage.removeItem("ma_client_safe_mode");
  vi.resetModules();
});

describe("Client View document guard", () => {
  it.each([true, false])("persists the explicit %s preference across drawer remounts and a fresh app session", async (enabled) => {
    const mode = await import("./clientSafeMode");
    const product = renderHook(() => mode.useClientSafeMode());
    act(() => product.result.current.setClientSafe(enabled));
    expect(localStorage.getItem("ma_client_safe_mode")).toBe(enabled ? "1" : "0");
    product.unmount();
    const drawer = renderHook(() => mode.useClientSafeMode());
    expect(drawer.result.current.clientSafe).toBe(enabled);
    drawer.unmount();
    vi.resetModules();
    const restarted = await import("./clientSafeMode");
    expect(restarted.getClientSafeMode()).toBe(enabled);
    expect(document.documentElement.dataset.clientView).toBe(enabled ? "active" : "inactive");
  });

  it("restores changes made while product and drawer subscribers were closed", async () => {
    const mode = await import("./clientSafeMode");
    const first = renderHook(() => mode.useClientSafeMode());
    first.unmount();
    localStorage.setItem("ma_client_safe_mode", "1");
    const reopened = renderHook(() => mode.useClientSafeMode());
    expect(reopened.result.current.clientSafe).toBe(true);
    expect(document.documentElement.dataset.clientView).toBe("active");
    reopened.unmount();
  });

  it("reconciles the saved preference when a suspended browser session resumes", async () => {
    const mode = await import("./clientSafeMode");
    const hook = renderHook(() => mode.useClientSafeMode());
    localStorage.setItem("ma_client_safe_mode", "1");
    act(() => window.dispatchEvent(new Event("pageshow")));
    expect(hook.result.current.clientSafe).toBe(true);
    localStorage.setItem("ma_client_safe_mode", "0");
    act(() => window.dispatchEvent(new Event("focus")));
    expect(hook.result.current.clientSafe).toBe(false);
    hook.unmount();
  });

  it("restores the mask before rendering, conceals trade-only nodes and reveals placeholders on every switch", async () => {
    localStorage.setItem("ma_client_safe_mode", "1");
    const style = document.createElement("style");
    style.id = "client-mask-test-style";
    // jsdom 20 resolves these declarations by source order rather than CSS
    // specificity/!important; place the real default rule before overrides.
    const rules = guardCss.slice(guardCss.indexOf("html[data-client-view="), guardCss.indexOf("/* Trade routes"));
    const fallback = "[data-client-placeholder] { display: none; }";
    expect(rules).toContain(fallback);
    style.textContent = fallback + rules.replace(fallback, "");
    document.head.appendChild(style);
    document.body.innerHTML = '<span data-trade-sensitive>SECRET SUPPLIER · FACTORY-SECRET-49 · Trade $7,782.30</span><span data-client-placeholder>Loading</span><span>Client $9,727.88</span>';

    const mode = await import("./clientSafeMode");
    expect(document.documentElement.dataset.clientView).toBe("active");
    const secret = document.querySelector<HTMLElement>("[data-trade-sensitive]");
    const placeholder = document.querySelector<HTMLElement>("[data-client-placeholder]");
    expect(secret).not.toBeNull();
    expect(placeholder).not.toBeNull();
    if (!secret || !placeholder) return;
    expect(getComputedStyle(secret).display).toBe("none");
    expect(getComputedStyle(placeholder).display).toBe("block");
    expect(document.body.textContent).toContain("Client $9,727.88");

    mode.setClientSafeMode(false);
    expect(document.documentElement.dataset.clientView).toBe("inactive");
    expect(getComputedStyle(secret).display).not.toBe("none");
    expect(getComputedStyle(placeholder).display).toBe("none");
    mode.setClientSafeMode(true);
    expect(getComputedStyle(secret).display).toBe("none");
    expect(getComputedStyle(placeholder).display).toBe("block");
  });

  it("keeps the mask synchronized when another tab activates Client View", async () => {
    localStorage.setItem("ma_client_safe_mode", "0");
    const mode = await import("./clientSafeMode");
    const hook = renderHook(() => mode.useClientSafeMode());
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "ma_client_safe_mode", newValue: "1" })));
    expect(document.documentElement.dataset.clientView).toBe("active");
    expect(mode.getClientSafeMode()).toBe(true);
    hook.unmount();
  });
});