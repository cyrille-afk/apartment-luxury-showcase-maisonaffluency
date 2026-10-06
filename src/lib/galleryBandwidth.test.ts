import { describe, it, expect } from "vitest";
import lookbook from "../components/InteractiveGalleryLookbook.tsx?raw";
import gallery from "../components/Gallery.tsx?raw";
import tradeLanding from "../pages/TradeLanding.tsx?raw";
import apartmentTour from "../pages/ApartmentTour.tsx?raw";

describe("high-bandwidth gallery photo delivery", () => {
  it("keeps screen renditions smaller than fullscreen detail", () => {
    expect(lookbook).toContain('const displayImage = (id: string) => cloudinaryUrl(id, { width: 1200');
    expect(lookbook).toContain('const large = (id: string) => cloudinaryUrl(id, { width: 1920');
    expect(lookbook).toContain('src={displayImage(pageScene.id)}');
    expect(lookbook).toContain('src={large(expandedScene.id)}');
    expect(lookbook).toContain('poster={displayImage("bespoke-sofa_gxidtx")}');
  });

  it("does not preload fixed-width copies of the first gallery section", () => {
    expect(gallery).not.toContain("galleryExperiences[0].items.forEach");
  });

  it("sizes trade photos through the mobile-aware auto-format helper", () => {
    expect(tradeLanding).toContain('cloudinaryUrl("dining-room_ey0bu5", { width: 800');
    expect(tradeLanding).toContain("backgroundImage: `url('${TRADE_PROGRAM_CTA_IMAGE}')`");
    expect(tradeLanding).not.toContain('upload/w_1600,q_auto,f_auto,c_fill,g_auto/v1773968016');
    expect(apartmentTour).not.toContain("poster={OG_IMAGE}");
  });
});