/**
 * Maps gallery flat indices to small Cloudinary thumbnail URLs.
 * Used by designer/collectible cards to show "On View" room avatars.
 *
 * Order must match galleryExperiences.flatMap(s => s.items) in Gallery.tsx.
 */

import { cloudinaryUrl } from "@/lib/cloudinary";

const t = (id: string) =>
  cloudinaryUrl(id, { width: 200, height: 200, quality: "auto", crop: "fill", gravity: "auto" });

export const GALLERY_THUMBNAILS: Record<number, string> = {
  /* A Sociable Environment */
  0: t("bespoke-sofa_gxidtx"),
  1: t("living-room-hero_zxfcxl"),
  2: t("dining-room_ey0bu5"),
  3: t("IMG_2402_y3atdm"),

  /* An Intimate Setting */
  4: t("intimate-dining_ux4pee"),
  5: t("intimate-table-detail_aqxvvm"),
  6: t("intimate-lounge_tf4sm1"),
  7: t("IMG_2133_wtxd62"),

  /* A Personal Sanctuary */
  8: t("boudoir_ll5spn"),
  9: t("70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq"),
  10: t("bedroom-second_cyfmdj"),
  11: t("art-master-bronze_hf6bad"),

  /* A Calming and Dreamy Environment */
  12: t("master-suite_y6jaix"),
  13: t("bedroom-third_ol56sx"),
  14: t("calming-2"), // local fallback — uses Cloudinary ID if uploaded
  15: t("bedroom-alt_yk0j0d"),

  /* A Small Room with Massive Personality */
  16: t("small-room-bedroom_mp8mdd"),
  17: t("small-room-personality_wvxz6y"),
  18: t("small-room-vase_s3nz5o"),
  19: t("small-room-chair_aobzyb"),

  /* Home Office with a View */
  20: t("home-office-desk_g0ywv2"),
  21: t("home-office-desk-2_gb1nlb"),
  22: t("home-office-3_t39msw"),
  23: t("AffluencySG_143_1_f9iihg"),

  /* The Details Make the Design */
  24: t("details-section_u6rwbu"),
  25: t("details-console_hk6uxt"),
  26: t("details-lamp_clzcrk"),
  27: t("AffluencySG_204_1_qbbpqb"),
};
