UPDATE gallery_hotspots 
SET link_url = '#curators/pierre-frey/Kagura Headboard Fabric'
WHERE product_name = 'Kagura Headboard Fabric' AND (link_url IS NULL OR link_url = '');

UPDATE gallery_hotspots 
SET link_url = '#curators/pierre-frey/Kagura Fabric Headboard'
WHERE product_name = 'Kagura Fabric Headboard' AND (link_url IS NULL OR link_url = '');