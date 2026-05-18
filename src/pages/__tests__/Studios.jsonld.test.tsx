import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

const FIXTURE_STUDIOS = [
  {
    id: "s-1",
    slug: "atelier-secret-one",
    name: "Atelier Secret One",
    tagline: "Bespoke joinery for private residences",
    bio: null,
    location: "Paris",
    country: "France",
    logo_url: null,
    hero_image_url: "https://example.com/hero1.jpg",
    disciplines: ["interior_design"],
    project_types: ["residential"],
    is_featured: true,
    is_published: true,
    sort_order: 1,
  },
  {
    id: "s-2",
    slug: "studio-confidential-two",
    name: "Studio Confidential Two",
    tagline: "Yacht interiors",
    bio: null,
    location: "Milan",
    country: "Italy",
    logo_url: null,
    hero_image_url: null,
    disciplines: ["architecture"],
    project_types: ["yacht"],
    is_featured: false,
    is_published: true,
    sort_order: 2,
  },
];

const buildQuery = () => {
  const q: any = {
    select: () => q,
    eq: () => q,
    order: () => q,
    then: (resolve: any) => resolve({ data: FIXTURE_STUDIOS, error: null }),
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => buildQuery() },
}));

vi.mock("@/lib/leadTracking", () => ({
  logStudioEvent: vi.fn(),
}));

const authState = { user: null as any, loading: false };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

import Studios from "@/pages/Studios";

const renderStudios = async () => {
  const result = render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/studios"]}>
        <Studios />
      </MemoryRouter>
    </HelmetProvider>
  );
  // Wait for supabase fetch + Helmet to flush into document.head
  await waitFor(() => {
    const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts.length).toBeGreaterThan(0);
  });
  return result;
};

const collectJsonLd = (): any[] => {
  const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
  return Array.from(scripts).map((s) => JSON.parse(s.textContent || "{}"));
};

const SENSITIVE_STRINGS = [
  "Atelier Secret One",
  "atelier-secret-one",
  "Studio Confidential Two",
  "studio-confidential-two",
  "/studios/atelier-secret-one",
  "/studios/studio-confidential-two",
];

describe("/studios JSON-LD gating", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
  });

  afterEach(() => {
    cleanup();
    // react-helmet-async leaves nodes in head between renders
    document.head
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach((n) => n.remove());
  });

  it("emits only the BreadcrumbList schema for logged-out visitors", async () => {
    await renderStudios();
    const ld = collectJsonLd();
    const types = ld.map((s) => s["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).not.toContain("ItemList");
  });

  it("never leaks studio names or profile links for logged-out visitors", async () => {
    await renderStudios();
    const serialised = JSON.stringify(collectJsonLd());
    for (const needle of SENSITIVE_STRINGS) {
      expect(serialised).not.toContain(needle);
    }
  });

  it("breadcrumb only references Home and the Studios index", async () => {
    await renderStudios();
    const breadcrumb = collectJsonLd().find((s) => s["@type"] === "BreadcrumbList");
    expect(breadcrumb).toBeTruthy();
    const items = breadcrumb.itemListElement.map((i: any) => i.name);
    expect(items).toEqual(["Home", "Studios"]);
  });

  it("includes the ItemList with studio names + profile URLs once authenticated", async () => {
    authState.user = { id: "u-1" };
    await renderStudios();
    const ld = collectJsonLd();
    const itemList = ld.find((s) => s["@type"] === "ItemList");
    expect(itemList).toBeTruthy();
    const serialised = JSON.stringify(itemList);
    expect(serialised).toContain("Atelier Secret One");
    expect(serialised).toContain("/studios/atelier-secret-one");
  });
});
