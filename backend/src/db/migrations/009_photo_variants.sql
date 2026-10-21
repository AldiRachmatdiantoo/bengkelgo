-- =====================================================================
-- 009_photo_variants.sql : smaller workshop photos
-- Photos are stored as WebP (max 1600 px) plus a 640 px thumbnail for the workshop cards. Photos uploaded
-- before this are converted the first time they are requested (optimized = FALSE until then).
-- =====================================================================
ALTER TABLE workshop_photos
  ADD COLUMN thumb_path TEXT,
  ADD COLUMN optimized  BOOLEAN NOT NULL DEFAULT FALSE;
