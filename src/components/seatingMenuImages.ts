// Existing published catalogue photographs, curated by seating typology.
export const SEATING_CARDS = [
  { label: "Armchairs", category: "Seating", subcategory: "Armchairs", images: [
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1781803450/cover_w5pk16.jpg",
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1777955799/Peonia_Armchair-1_y0wuft.jpg",
  ] },
  { label: "Bar Stools", category: "Seating", subcategory: "Ottomans & Stools", images: [
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1775836417/Ari_Barstool-1_lsexyf.jpg",
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1779957028/ByronBarStool-1_aicwv9.jpg",
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1776421539/Screen_Shot_2026-04-17_at_6.25.19_PM_elcmw3.png",
  ] },
  { label: "Chairs", category: "Seating", subcategory: "Chairs", images: [
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1780638970/Solid_Oak_Wood_-_Neve_Fabric-2_w2umoh.jpg",
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1774940083/Albori_Chair-3_ito8bg.png",
  ] },
  { label: "Daybeds & Benches", category: "Seating", subcategory: "Daybeds & Benches", images: [
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1791126840/Beauregard_Daybed-1_npqxtc.webp",
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1774940080/Vesuvio_Bench-1_m9evyq.jpg",
  ] },
  { label: "Ottomans & Stools", category: "Seating", subcategory: "Ottomans & Stools", images: [
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1776136286/Barth_Stool-4_jkc3my.jpg",
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1776011997/ROI-1_oszmvx.jpg",
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1777955260/Barri_Stool-1_zddsqe.png",
  ] },
  { label: "Sofas", category: "Seating", subcategory: "Sofas", images: [
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1777527856/PC_Corbeille_Sofa_01_A4_BD_1_ziscqe.jpg",
    "https://res.cloudinary.com/dif1oamtj/image/upload/v1775836406/Oze_sofa-1_zpxhfl.jpg",
  ] },
];

export function seatingImagesForVisit(visit: number): string[] {
  return SEATING_CARDS.map((card) => card.images[Math.max(0, visit) % card.images.length] ?? card.images[0] ?? "");
}

export const seatingCardImage = (url: string) => url.replace("/image/upload/", "/image/upload/c_fill,ar_4:5,w_480,q_auto,f_auto/");