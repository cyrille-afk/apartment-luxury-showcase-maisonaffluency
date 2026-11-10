import { describe, expect, it } from "vitest";
import {
  isSupportedLogoUrl,
  logoFileExtension,
  logoFormatLabel,
} from "./studioLogoFormat";

describe("logoFileExtension", () => {
  it("reads the extension from each accepted format", () => {
    expect(logoFileExtension("https://yourstudio.com/logo.png")).toBe("png");
    expect(logoFileExtension("https://yourstudio.com/logo.svg")).toBe("svg");
    expect(logoFileExtension("https://yourstudio.com/logo.jpg")).toBe("jpg");
    expect(logoFileExtension("https://yourstudio.com/logo.jpeg")).toBe("jpeg");
    expect(logoFileExtension("https://yourstudio.com/logo.webp")).toBe("webp");
  });

  it("ignores casing, query strings and fragments", () => {
    expect(logoFileExtension("https://yourstudio.com/LOGO.SVG")).toBe("svg");
    expect(logoFileExtension("https://yourstudio.com/logo.PNG?v=3")).toBe("png");
    expect(logoFileExtension("https://yourstudio.com/logo.WebP#brand")).toBe("webp");
  });

  it("returns null when the link has no file extension", () => {
    expect(logoFileExtension("https://res.cloudinary.com/dx/image/upload/v1/logo")).toBeNull();
    expect(logoFileExtension("https://yourstudio.com")).toBeNull();
    expect(logoFileExtension("")).toBeNull();
    expect(logoFileExtension(null)).toBeNull();
  });
});

describe("isSupportedLogoUrl", () => {
  it("accepts every supported image format", () => {
    expect(isSupportedLogoUrl("https://yourstudio.com/logo.png")).toBe(true);
    expect(isSupportedLogoUrl("https://yourstudio.com/logo.svg")).toBe(true);
    expect(isSupportedLogoUrl("https://yourstudio.com/logo.jpg")).toBe(true);
    expect(isSupportedLogoUrl("https://yourstudio.com/logo.jpeg")).toBe(true);
    expect(isSupportedLogoUrl("https://yourstudio.com/logo.webp")).toBe(true);
    expect(isSupportedLogoUrl("https://yourstudio.com/Brand.Mark.SVG")).toBe(true);
  });

  it("rejects links whose extension is known but not an image", () => {
    expect(isSupportedLogoUrl("https://yourstudio.com/logo.pdf")).toBe(false);
    expect(isSupportedLogoUrl("https://yourstudio.com/logo.gif")).toBe(false);
    expect(isSupportedLogoUrl("https://yourstudio.com/logo.html")).toBe(false);
    expect(isSupportedLogoUrl("https://yourstudio.com/logo.tiff")).toBe(false);
  });

  it("keeps extension-less CDN links renderable and refuses empty values", () => {
    expect(isSupportedLogoUrl("https://res.cloudinary.com/dx/image/upload/v1/logo")).toBe(true);
    expect(isSupportedLogoUrl("   ")).toBe(false);
    expect(isSupportedLogoUrl(null)).toBe(false);
  });
});

describe("logoFormatLabel", () => {
  it("names the format for the preview caption", () => {
    expect(logoFormatLabel("https://yourstudio.com/logo.svg")).toBe("SVG vector");
    expect(logoFormatLabel("https://yourstudio.com/logo.png")).toBe("PNG image");
    expect(logoFormatLabel("https://yourstudio.com/logo.jpeg")).toBe("JPG image");
    expect(logoFormatLabel("https://yourstudio.com/logo.webp")).toBe("WEBP image");
    expect(logoFormatLabel("https://yourstudio.com/logo.pdf")).toBeNull();
  });
});
