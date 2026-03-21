-- Update prices from ECART 2026 Price List EUR
-- Matching each card's material/finish to the correct price variant

-- === PAUL LÁSZLÓ ===
-- Arcadia Bench: "Varnished solid ash & rattan" → 9,000€
UPDATE designer_curator_picks SET trade_price_cents = 900000 WHERE id = 'ed184937-115f-4cf2-bfd4-57f71b89e1c8';
-- Arcadia Chair: "Varnished solid ash & rattan" → 6,500€
UPDATE designer_curator_picks SET trade_price_cents = 650000 WHERE id = '875401d2-67ca-4b72-9af7-cd7156a351a4';
-- Arcadia Ottoman: "Varnished solid ash & rattan" → 4,000€
UPDATE designer_curator_picks SET trade_price_cents = 400000 WHERE id = 'f25a7f0e-5e4a-4bbb-ad81-c5d619a3226f';
-- Rodeo Chair: "Varnished solid ash & fabric" → ECART fabric 4,500€
UPDATE designer_curator_picks SET trade_price_cents = 450000 WHERE id = 'b1534548-cba8-4df4-b6fb-616f802b7bd2';
-- Carmelina Chair: "Varnished solid ash & fabric" → ECART fabric 3,200€
UPDATE designer_curator_picks SET trade_price_cents = 320000 WHERE id = '9baeef6c-d0fa-4789-ac9d-2703209486dd';
-- Palisades Coffee Table: "Varnished solid ash & Lucite" → Lucite top 15,000€
UPDATE designer_curator_picks SET trade_price_cents = 1500000 WHERE id = '1fb0b106-dede-475c-b709-b9b6e6a245d4';
-- Brentwood Coffee Table: "Varnished solid ash" → 8,000€
UPDATE designer_curator_picks SET trade_price_cents = 800000 WHERE id = '9675a4da-c2d2-4bb7-a477-808807f77f4b';
-- Wilshire Console: "Varnished solid ash" → 9,500€
UPDATE designer_curator_picks SET trade_price_cents = 950000 WHERE id = '5c7f293a-e79d-48bb-aa1d-8abf24d8b3c5';
-- Avondale Sideboard: "Varnished solid ash" → 15,000€
UPDATE designer_curator_picks SET trade_price_cents = 1500000 WHERE id = '6d94a8fc-e5a1-4914-8628-e561808a7ec7';
-- Avondale Lamp: "Varnished ash, patinated brass & wild silk" → 4,000€
UPDATE designer_curator_picks SET trade_price_cents = 400000 WHERE id = '1c77ac18-c093-4e93-9c35-87ee75771988';

-- === JEAN-MICHEL FRANK ===
-- Upholstered Back 3-Seater Sofa: "Varnished Solid Oak • Leather" → Leather 22,500€
UPDATE designer_curator_picks SET trade_price_cents = 2250000 WHERE id = 'a21f9847-b71e-4f4f-abcc-856c0313b584';
-- Croisillon Lamp: "Varnished Solid Oak Base • Patinated Brass • Cotton Lamp Shade" → Smooth oak 1,600 + Cotton shade 300 = 1,900€
UPDATE designer_curator_picks SET trade_price_cents = 190000 WHERE id = 'd423e61c-baac-4e9e-af3d-f80b82b6726a';
-- Soleil Coffee Table: "Straw Marquetry" → Natural straw marquetry 15,000€
UPDATE designer_curator_picks SET trade_price_cents = 1500000 WHERE id = 'b8b26623-7d10-49f4-9046-8fa9d6685f8a';
-- Elephant Armchair: "Smooth Solid Oak Frame • Fabric" → Smooth oak ECART fabric 7,000€
UPDATE designer_curator_picks SET trade_price_cents = 700000 WHERE id = '1b6a0347-30e3-41e0-a464-5cc998bf6ce6';
-- Round Table: "Sandblasted Oak Marquetry • Deep Sandblasted Oak" → 18,000€
UPDATE designer_curator_picks SET trade_price_cents = 1800000 WHERE id = '204350c5-805a-4a5a-a59f-385f608ffb2d';
-- X Stool (Round): "Sandblasted Varnished Oak • Foal Hide" → Sandblasted oak Hide 4,000€
UPDATE designer_curator_picks SET trade_price_cents = 400000 WHERE id = 'e5f9dfaa-20d3-4a64-a3ff-e6c2edd40f45';
-- Nesting Tables: "Parchment" → Parchment 28,000€
UPDATE designer_curator_picks SET trade_price_cents = 2800000 WHERE id = '7e35f8ce-c287-4ceb-9e72-89bdf783463b';
-- Console: "Varnished oak & sandblasted oak" → Natural oak 8,500€
UPDATE designer_curator_picks SET trade_price_cents = 850000 WHERE id = '11ab72ba-40b7-49df-8d44-9b3ef9b28bf0';
-- Transat (JMF): "Varnished solid oak & fabric" → Smooth oak ECART fabric 7,500€
UPDATE designer_curator_picks SET trade_price_cents = 750000 WHERE id = '0d33b077-dc1a-4aed-bc8e-86dd2884b2dd';
-- Apartment Desk: "Varnished oak" → Smooth oak 12,000€
UPDATE designer_curator_picks SET trade_price_cents = 1200000 WHERE id = 'd4c11aa8-05a4-4e80-8780-32001b7a92fb';

-- === ECART (same items duplicated under Ecart brand) ===
-- Upholstered Back 3-Seater Sofa: "Varnished Solid Oak • Leather" → Leather 22,500€
UPDATE designer_curator_picks SET trade_price_cents = 2250000 WHERE id = 'a2ea6a77-c772-4f0f-8793-9666ec3d3caa';
-- Croisillon Lamp: Cotton → 1,900€
UPDATE designer_curator_picks SET trade_price_cents = 190000 WHERE id = '9344d31e-b233-4ea0-8180-8d04a4809fe4';
-- Soleil Coffee Table: Straw marquetry → 15,000€ (already correct)
UPDATE designer_curator_picks SET trade_price_cents = 1500000 WHERE id = '4235fbee-0428-4c48-9271-7ad87a731380';
-- Elephant Armchair: Smooth oak fabric → 7,000€
UPDATE designer_curator_picks SET trade_price_cents = 700000 WHERE id = 'ef4f4cf3-df49-44d4-8050-bd5a634382d7';
-- Round Table: Sandblasted → 18,000€
UPDATE designer_curator_picks SET trade_price_cents = 1800000 WHERE id = 'f9965423-9a96-4982-b57c-38c9970cddc1';
-- X Stool (Round): Sandblasted Hide → 4,000€
UPDATE designer_curator_picks SET trade_price_cents = 400000 WHERE id = 'a78cf035-7b7e-47e3-af54-4effcd0aee4b';
-- Transat (Eileen Gray via Ecart): Black lacquered sycamore ECART fabric → 19,000€
UPDATE designer_curator_picks SET trade_price_cents = 1900000 WHERE id = '98054e71-a4a5-4e16-a5e1-56895c06a549';
-- Satellite Mirror: → 7,500€
UPDATE designer_curator_picks SET trade_price_cents = 750000 WHERE id = '04ee72e0-5f27-4416-b123-b97440833ac9';

-- === EILEEN GRAY ===
-- Transat: Black lacquered sycamore ECART fabric → 19,000€
UPDATE designer_curator_picks SET trade_price_cents = 1900000 WHERE id = '26ad03ef-4cf8-4463-960f-fcd614e37c79';
-- Satellite Mirror: → 7,500€
UPDATE designer_curator_picks SET trade_price_cents = 750000 WHERE id = 'ef26b2ce-08d1-40cf-9a2c-d89ecde6932b';
-- Collage Rug: Hand-knotted wool → 7,000€
UPDATE designer_curator_picks SET trade_price_cents = 700000 WHERE id = '2ba69c63-8ea8-4ccc-8839-2c22d67ffead';

-- === FÉLIX AUBLET ===
-- Boule Lamp (Small): Nickel-plated brass & alloy → 2,550€
UPDATE designer_curator_picks SET trade_price_cents = 255000 WHERE id = '0e0dc3db-4706-4890-b644-e502f96e369b';

-- === MARIANO FORTUNY ===
-- Lamp: → 3,600€
UPDATE designer_curator_picks SET trade_price_cents = 360000 WHERE id = '47c9c5e2-d5d8-4dc2-9357-6a6d46946bee';
-- Projector: → 9,500€
UPDATE designer_curator_picks SET trade_price_cents = 950000 WHERE id = '3a18cf60-c88b-4aff-8c43-937850882efb';

-- === PIERRE CHAREAU ===
-- Corbeille Sofa: "Varnished solid oak & fabric" → COM fabric 14,000€
UPDATE designer_curator_picks SET trade_price_cents = 1400000 WHERE id = 'fc3a68b1-65cd-4d6f-941c-b8a2451dd064';
-- Fan Table: "Patinated steel" → 2,500€
UPDATE designer_curator_picks SET trade_price_cents = 250000 WHERE id = '80d6f67e-0e25-44b0-a607-3660aca50647';
-- Curule Stool: "Satin sycamore" → Natural or brown 2,300€
UPDATE designer_curator_picks SET trade_price_cents = 230000 WHERE id = '92f1a565-1c79-49ac-ba34-a546ed9d4131';
-- T Stool (Curved): "Varnished oak & patinated steel" → Smooth oak 2,900€
UPDATE designer_curator_picks SET trade_price_cents = 290000 WHERE id = '1951ea99-2031-4a91-9195-5535cd54fcec';

-- === LAURENT MAUGOUST & CÉCILE CHENAIS ===
-- Wolf Armchair: "Lacquered wood & shearling or fabric" → Shearling without swivel 9,000€
UPDATE designer_curator_picks SET trade_price_cents = 900000 WHERE id = '1547d5cf-ccf4-4ea5-b28a-40cedea1d6c2';
-- Wolf Bridge: "Varnished solid oak & fabric" → COM fabric 2,900€
UPDATE designer_curator_picks SET trade_price_cents = 290000 WHERE id = '93a2dd5e-44fe-452b-973a-8ed75eb4784d';
-- Reiko Screen: "Lacquered glass & wood" → 15,000€
UPDATE designer_curator_picks SET trade_price_cents = 1500000 WHERE id = '9ce57f2e-addb-496f-9800-c402b8b7b900';