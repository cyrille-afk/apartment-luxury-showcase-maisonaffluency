import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";

export const BOND_STREET_STOOL_ID = "938efe1a-8744-47e9-9d1d-dbd00634ab1a";

export const BOND_STREET_BASE_FINISH: VisualiserMaterial = {
  id: "bond-street-powdercoated-bronze-swivel",
  name: "Powdercoated Bronze Metal Swivel",
  brand_name: "Man of Parts",
  category: "Metal",
  material_type: "Powdercoated bronze",
  color_family: "Bronze",
  image_url: null,
  target: "base",
  color: "#655347",
  roughness: 0.38,
  metalness: 0.72,
};

export const BOND_STREET_UPHOLSTERY_FINISHES: VisualiserMaterial[] = [
  {
    id: "bond-street-sahco-coney-0003",
    name: "Sahco Coney 0003",
    brand_name: "Sahco",
    category: "Fabric",
    material_type: "Upholstery textile",
    color_family: "Neutral",
    image_url: "/materials/man-of-parts/sahco-coney-0003.jpg",
    diffuse_url: "/materials/man-of-parts/sahco-coney-0003.jpg",
    target: "upholstery",
    repeat: 7,
    roughness: 0.94,
    metalness: 0,
  },
  {
    id: "bond-street-sahco-balboa-0019",
    name: "Sahco Balboa 0019",
    brand_name: "Sahco",
    category: "Fabric",
    material_type: "Upholstery textile",
    color_family: "Neutral",
    image_url: "/materials/man-of-parts/sahco-balboa-0019.jpg",
    diffuse_url: "/materials/man-of-parts/sahco-balboa-0019.jpg",
    target: "upholstery",
    repeat: 8,
    roughness: 0.9,
    metalness: 0,
  },
];

export const isBondStreetStool = (productId: string) => productId === BOND_STREET_STOOL_ID;