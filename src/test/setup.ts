import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: () => {},
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom 20's CSS declaration implementation predates individual transforms.
// Store translate through the CSSOM so removeProperty restores the empty value.
if (typeof CSSStyleDeclaration !== "undefined" && !("translate" in CSSStyleDeclaration.prototype)) {
  Object.defineProperty(CSSStyleDeclaration.prototype, "translate", {
    configurable: true,
    get(this: CSSStyleDeclaration) { return this.getPropertyValue("translate"); },
    set(this: CSSStyleDeclaration, value: string) { this.setProperty("translate", value); },
  });
}

// jsdom's Blob lacks the browser arrayBuffer API used by PDF assertions.
if (typeof FileReader !== "undefined" && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
