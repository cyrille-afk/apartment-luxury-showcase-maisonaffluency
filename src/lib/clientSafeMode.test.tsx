import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";

const guardCss = readFileSync("src/index.css", "utf8");

afterEach(() => {
  document.head.querySelector("#client-mask-test-style")?.remove();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-client-view");
  localStorage.removeItem("ma_client_safe_mode");
  vi.resetModules();
});

describe("Client View document guard", () => {
  it("restores the mask before rendering, conceals trade-only nodes and reveals placeholders on every switch", async () => {
    localStorage.setItem("ma_client_safe_mode", "1");
    const style = document.createElement("style");
    style.id = "client-mask-test-style";
    style.textContent = guardCss.slice(guardCss.indexOf("html[data-client-view="), guardCss.indexOf("/* Trade routes"));
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
    window.dispatchEvent(new StorageEvent("storage", { key: "ma_client_safe_mode", newValue: "1" }));
    expect(document.documentElement.dataset.clientView).toBe("active");
    expect(mode.getClientSafeMode()).toBe(true);
    hook.unmount();
  });
});