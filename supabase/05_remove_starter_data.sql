-- ============================================
-- BIKE DANGLER INDUSTRIES - REMOVE STARTER DATA (optional, one-off)
-- Run AFTER 04, in the Supabase SQL Editor, when you want to enter your own
-- fields, buildings and crops instead of the guessed starter ones.
-- Safe to run more than once.
-- ============================================
--
-- Removes only the starter rows that scripts 02/03 added, by name, and only
-- if nothing uses them yet (no planting in the field, no batch in the house).
-- Then records that starter data was handled, so re-running 02/03 never
-- adds it back.

CREATE TABLE IF NOT EXISTS public.setup_flags (
  flag TEXT PRIMARY KEY,
  set_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE public.setup_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.setup_flags FROM anon, authenticated;

INSERT INTO public.setup_flags (flag) VALUES ('starter_farm_data'), ('starter_crop_data')
ON CONFLICT (flag) DO NOTHING;

DELETE FROM public.fields f
WHERE f.field_name IN ('Greenhouse North', 'Plot A', 'Nursery')
  AND NOT EXISTS (SELECT 1 FROM public.plantings p WHERE p.field_id = f.field_id);

DELETE FROM public.buildings b
WHERE b.building_name IN ('Broiler House 1', 'Storage Shed')
  AND NOT EXISTS (SELECT 1 FROM public.flocks fl WHERE fl.building_id = b.building_id);

DELETE FROM public.crop_calendar WHERE crop_name IN ('Green Pepper', 'Tsunga');

DELETE FROM public.crop_varieties WHERE crop_name IN ('Green Pepper', 'Tsunga', 'Cabbage');

-- What's left (should be all zeros unless something was in use).
SELECT
  (SELECT count(*) FROM public.fields) AS fields_left,
  (SELECT count(*) FROM public.buildings) AS buildings_left,
  (SELECT count(*) FROM public.crop_calendar) AS crop_calendar_left,
  (SELECT count(*) FROM public.crop_varieties) AS crop_list_left;
