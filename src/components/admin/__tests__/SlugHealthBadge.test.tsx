import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useSlugHealthMap,
  isCuratedSlug,
  type SlugHealthDesigner,
} from "../SlugHealthBadge";

const d = (over: Partial<SlugHealthDesigner> & { id: string; name: string }): SlugHealthDesigner => ({
  display_name: null,
  slug: null,
  ...over,
});

describe("useSlugHealthMap", () => {
  it("flags missing slugs (null and empty string)", () => {
    const designers = [
      d({ id: "1", name: "Alpha", slug: null }),
      d({ id: "2", name: "Beta", slug: "" }),
      d({ id: "3", name: "Gamma", slug: "   " }),
      d({ id: "4", name: "Delta", slug: "delta" }),
    ];
    const { result } = renderHook(() => useSlugHealthMap(designers));
    expect(result.current.get("1")).toEqual({ kind: "missing" });
    expect(result.current.get("2")).toEqual({ kind: "missing" });
    expect(result.current.get("3")).toEqual({ kind: "missing" });
    expect(result.current.get("4")).toBeUndefined();
  });

  it("flags invalid slugs (uppercase, spaces, special chars, leading/trailing dashes)", () => {
    const designers = [
      d({ id: "1", name: "A", slug: "Has-Uppercase" }),
      d({ id: "2", name: "B", slug: "has spaces" }),
      d({ id: "3", name: "C", slug: "has_underscore" }),
      d({ id: "4", name: "D", slug: "-leading-dash" }),
      d({ id: "5", name: "E", slug: "trailing-dash-" }),
      d({ id: "6", name: "F", slug: "double--dash" }),
      d({ id: "7", name: "G", slug: "valid-slug-123" }),
    ];
    const { result } = renderHook(() => useSlugHealthMap(designers));
    expect(result.current.get("1")?.kind).toBe("invalid");
    expect(result.current.get("2")?.kind).toBe("invalid");
    expect(result.current.get("3")?.kind).toBe("invalid");
    expect(result.current.get("4")?.kind).toBe("invalid");
    expect(result.current.get("5")?.kind).toBe("invalid");
    expect(result.current.get("6")?.kind).toBe("invalid");
    expect(result.current.get("7")).toBeUndefined();
  });

  it("flags duplicate slugs and lists conflicts on every duplicated row", () => {
    const designers = [
      d({ id: "1", name: "A", slug: "shared" }),
      d({ id: "2", name: "B", slug: "shared" }),
      d({ id: "3", name: "C", slug: "shared" }),
      d({ id: "4", name: "D", slug: "unique" }),
    ];
    const { result } = renderHook(() => useSlugHealthMap(designers));
    const one = result.current.get("1");
    const two = result.current.get("2");
    const three = result.current.get("3");
    expect(one?.kind).toBe("duplicate");
    expect(two?.kind).toBe("duplicate");
    expect(three?.kind).toBe("duplicate");
    if (one?.kind === "duplicate") expect(one.conflictsWith.sort()).toEqual(["2", "3"]);
    if (two?.kind === "duplicate") expect(two.conflictsWith.sort()).toEqual(["1", "3"]);
    expect(result.current.get("4")).toBeUndefined();
  });

  it("returns empty map when all slugs are healthy", () => {
    const designers = [
      d({ id: "1", name: "A", slug: "alpha" }),
      d({ id: "2", name: "B", slug: "beta-two" }),
      d({ id: "3", name: "C", slug: "gamma-3" }),
    ];
    const { result } = renderHook(() => useSlugHealthMap(designers));
    expect(result.current.size).toBe(0);
  });

  it("missing takes precedence over duplicate when slug is empty", () => {
    const designers = [
      d({ id: "1", name: "A", slug: "" }),
      d({ id: "2", name: "B", slug: "" }),
    ];
    const { result } = renderHook(() => useSlugHealthMap(designers));
    // empty slugs aren't tracked as "shared" — both should be missing, not duplicate
    expect(result.current.get("1")?.kind).toBe("missing");
    expect(result.current.get("2")?.kind).toBe("missing");
  });
});

describe("isCuratedSlug", () => {
  it("returns false for slugs that derive from name", () => {
    expect(isCuratedSlug({ name: "Pierre Yovanovitch", slug: "pierre-yovanovitch" })).toBe(false);
    expect(isCuratedSlug({ name: "Studio KO", slug: "studio-ko" })).toBe(false);
  });

  it("returns false for slugs that derive from display_name", () => {
    expect(
      isCuratedSlug({
        name: "Internal Name",
        display_name: "Maison Affluency",
        slug: "maison-affluency",
      }),
    ).toBe(false);
  });

  it("returns false for slugs that extend the name with a suffix (still derivable)", () => {
    expect(isCuratedSlug({ name: "Pierre Yovanovitch", slug: "pierre-yovanovitch-paris" })).toBe(false);
  });

  it("returns true for the Leo Aerts case (founder-atelier slug)", () => {
    // Designer "Alinea Design Objects" with slug "leo-aerts-alinea" — slug is
    // founder-led and does NOT start with the slugified name. This is the
    // exact case the safeguard must protect.
    expect(
      isCuratedSlug({
        name: "Alinea Design Objects",
        display_name: "Alinea Design Objects",
        slug: "leo-aerts-alinea",
      }),
    ).toBe(true);
  });

  it("returns true when slug is unrelated to both name and display_name", () => {
    expect(
      isCuratedSlug({
        name: "Atelier Foo",
        display_name: "Foo Studio",
        slug: "totally-different-handle",
      }),
    ).toBe(true);
  });

  it("returns false for null/empty slugs (nothing to protect)", () => {
    expect(isCuratedSlug({ name: "Anything", slug: null })).toBe(false);
    expect(isCuratedSlug({ name: "Anything", slug: "" })).toBe(false);
  });

  it("normalizes accents when comparing (curated detection is accent-insensitive)", () => {
    expect(isCuratedSlug({ name: "Hervé Langlais", slug: "herve-langlais" })).toBe(false);
    expect(isCuratedSlug({ name: "Étoile", slug: "etoile-paris" })).toBe(false);
  });

  it("treats ampersands as 'and' when deriving (matches slugify behavior)", () => {
    expect(isCuratedSlug({ name: "Smith & Jones", slug: "smith-and-jones" })).toBe(false);
  });
});
