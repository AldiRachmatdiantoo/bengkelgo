-- =====================================================================
-- 011_demo_photos.sql : illustration photos for the demo workshops
-- Photos marked is_illustration are generic workshop pictures (free Unsplash licence, shipped in
-- backend/assets/demo-photos), not pictures of that workshop; the web shows them with a "Foto ilustrasi" label.
-- The demo workshops (owners on the reserved .test domain, see src/db/demo.ts) that have no photo get one:
-- a car workshop picture when they service cars, else a motorbike one.
-- =====================================================================
ALTER TABLE workshop_photos ADD COLUMN is_illustration BOOLEAN NOT NULL DEFAULT FALSE;

WITH demo AS (
  SELECT w.id,
         CASE WHEN 'MOBIL' = ANY(w.vehicle_types) THEN 'mobil' ELSE 'motor' END AS kind,
         ROW_NUMBER() OVER (PARTITION BY ('MOBIL' = ANY(w.vehicle_types)) ORDER BY w.name) AS n
  FROM workshops w
  JOIN users u ON u.id = w.owner_id
  WHERE u.email LIKE '%@bengkelgo.test'
    AND NOT EXISTS (SELECT 1 FROM workshop_photos p WHERE p.workshop_id = w.id)
)
INSERT INTO workshop_photos (workshop_id, path, thumb_path, optimized, is_cover, sort_order, is_illustration)
SELECT id,
       'demo/' || kind || '-' || ((n - 1) % 5 + 1) || '.webp',
       'demo/' || kind || '-' || ((n - 1) % 5 + 1) || '-sm.webp',
       TRUE, TRUE, 0, TRUE
FROM demo;
