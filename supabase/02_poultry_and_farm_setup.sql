-- ============================================
-- BIKE DANGLER INDUSTRIES - FARM SETUP & POULTRY TRACKING
-- Run AFTER 01_security_and_roles.sql, in the Supabase SQL Editor.
-- Safe to run more than once.
-- ============================================

-- ============================================
-- 1. FARM SETUP
-- ============================================
-- The sample data in the original schema could never be inserted: the farm
-- needs an owner, and no users existed when it ran. Create the farm now
-- that an OWNER exists (only if there is no farm yet), and give it starter
-- fields / buildings if it has none (a farm row may have been added by hand).

DO $$
DECLARE
  v_owner UUID;
  v_farm  UUID;
BEGIN
  SELECT farm_id INTO v_farm FROM public.farms LIMIT 1;

  IF v_farm IS NULL THEN
    SELECT user_id INTO v_owner FROM public.users WHERE role = 'OWNER' LIMIT 1;
    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'No OWNER user yet. Run 01_security_and_roles.sql first.';
    END IF;

    INSERT INTO public.farms (name, location, total_area_sqm, owner_id)
    VALUES ('Marondera Farm', 'Marondera, Zimbabwe', 5000, v_owner)
    RETURNING farm_id INTO v_farm;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fields WHERE farm_id = v_farm) THEN
    INSERT INTO public.fields (farm_id, field_name, area_sqm, field_type, irrigation) VALUES
      (v_farm, 'Greenhouse North', 200, 'GREENHOUSE', 'DRIP'),
      (v_farm, 'Plot A', 500, 'OPEN_FIELD', 'FLOOD'),
      (v_farm, 'Nursery', 100, 'NURSERY', 'DRIP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.buildings WHERE farm_id = v_farm) THEN
    INSERT INTO public.buildings (farm_id, building_name, building_type, capacity, climate_controlled) VALUES
      (v_farm, 'Broiler House 1', 'POULTRY_HOUSE', 500, FALSE),
      (v_farm, 'Storage Shed', 'STORAGE', 1000, FALSE);
  END IF;
END $$;

-- ============================================
-- 2. POULTRY TABLE CHANGES
-- ============================================

-- One log per batch per day (a second save for the same day corrects it).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flock_daily_logs_one_per_day') THEN
    ALTER TABLE public.flock_daily_logs
      ADD CONSTRAINT flock_daily_logs_one_per_day UNIQUE (flock_id, log_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flock_daily_logs_non_negative') THEN
    ALTER TABLE public.flock_daily_logs
      ADD CONSTRAINT flock_daily_logs_non_negative
      CHECK (mortality >= 0 AND COALESCE(feed_given_kg, 0) >= 0 AND COALESCE(water_given_liters, 0) >= 0);
  END IF;
END $$;

ALTER TABLE public.flock_daily_logs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(user_id);
ALTER TABLE public.flock_harvesting ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(user_id);

-- Let an expense or income be tied to a batch (chicks, feed, vaccines, sales),
-- so each batch's profit can be worked out.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS flock_id UUID REFERENCES public.flocks(flock_id);
CREATE INDEX IF NOT EXISTS idx_transactions_flock_id ON public.transactions(flock_id);
CREATE INDEX IF NOT EXISTS idx_flock_daily_logs_flock_id ON public.flock_daily_logs(flock_id);
CREATE INDEX IF NOT EXISTS idx_flock_harvesting_flock_id ON public.flock_harvesting(flock_id);

-- ============================================
-- 3. BATCH SUMMARY VIEW
-- ============================================
-- One row per batch with running totals. Runs as the person asking, so a
-- WORKER gets expenses = 0 (they can't read transactions).

DROP VIEW IF EXISTS public.flock_summary;
CREATE VIEW public.flock_summary WITH (security_invoker = true) AS
SELECT
  f.flock_id,
  f.farm_id,
  f.building_id,
  b.building_name,
  f.batch_number,
  f.bird_type,
  f.bird_count,
  f.start_date,
  f.expected_harvest_date,
  f.status,
  (CURRENT_DATE - f.start_date) AS age_days,
  COALESCE(l.total_mortality, 0) AS total_mortality,
  ROUND(100.0 * COALESCE(l.total_mortality, 0) / NULLIF(f.bird_count, 0), 1) AS mortality_pct,
  COALESCE(l.total_feed_kg, 0) AS total_feed_kg,
  COALESCE(l.total_water_liters, 0) AS total_water_liters,
  l.last_log_date,
  COALESCE(h.birds_harvested, 0) AS birds_harvested,
  COALESCE(h.total_weight_kg, 0) AS total_weight_kg,
  f.bird_count - COALESCE(l.total_mortality, 0) - COALESCE(h.birds_harvested, 0) AS birds_alive,
  COALESCE(h.revenue, 0) AS revenue,
  COALESCE(x.expenses, 0) AS expenses,
  COALESCE(h.revenue, 0) - COALESCE(x.expenses, 0) AS profit
FROM public.flocks f
LEFT JOIN public.buildings b ON b.building_id = f.building_id
LEFT JOIN (
  SELECT flock_id,
         SUM(mortality) AS total_mortality,
         SUM(feed_given_kg) AS total_feed_kg,
         SUM(water_given_liters) AS total_water_liters,
         MAX(log_date) AS last_log_date
  FROM public.flock_daily_logs
  GROUP BY flock_id
) l ON l.flock_id = f.flock_id
LEFT JOIN (
  SELECT flock_id,
         SUM(birds_harvested) AS birds_harvested,
         SUM(total_weight_kg) AS total_weight_kg,
         SUM(total_revenue) AS revenue
  FROM public.flock_harvesting
  GROUP BY flock_id
) h ON h.flock_id = f.flock_id
LEFT JOIN (
  SELECT flock_id, SUM(amount) AS expenses
  FROM public.transactions
  WHERE transaction_type = 'EXPENSE' AND flock_id IS NOT NULL
  GROUP BY flock_id
) x ON x.flock_id = f.flock_id;

REVOKE ALL ON public.flock_summary FROM anon;
GRANT SELECT ON public.flock_summary TO authenticated;

-- ============================================
-- 4. RECORD A HARVEST / SALE (one step)
-- ============================================
-- Saves the harvest, books the income in transactions (so the Partner
-- Dashboard sees it) and optionally closes the batch, all-or-nothing.
-- Runs as the caller, so only the OWNER can use it.

CREATE OR REPLACE FUNCTION public.record_flock_harvest(
  p_flock_id UUID,
  p_harvest_date DATE,
  p_birds_harvested INT,
  p_total_weight_kg NUMERIC,
  p_sale_price_per_kg NUMERIC,
  p_buyer_name TEXT DEFAULT NULL,
  p_quality_grade TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_close_batch BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_flock   public.flocks%ROWTYPE;
  v_alive   INT;
  v_revenue NUMERIC;
  v_id      UUID;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'Only the owner can record sales';
  END IF;

  SELECT * INTO v_flock FROM public.flocks WHERE flock_id = p_flock_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;

  SELECT birds_alive INTO v_alive FROM public.flock_summary WHERE flock_id = p_flock_id;
  IF p_birds_harvested IS NULL OR p_birds_harvested <= 0 THEN
    RAISE EXCEPTION 'Birds harvested must be more than 0';
  END IF;
  IF p_birds_harvested > v_alive THEN
    RAISE EXCEPTION 'Only % birds are left in batch %', v_alive, v_flock.batch_number;
  END IF;

  v_revenue := ROUND(COALESCE(p_total_weight_kg, 0) * COALESCE(p_sale_price_per_kg, 0), 2);

  INSERT INTO public.flock_harvesting (
    flock_id, harvest_date, birds_harvested, average_weight_kg, total_weight_kg,
    quality_grade, buyer_name, sale_price_per_kg, total_revenue, notes, created_by)
  VALUES (
    p_flock_id, p_harvest_date, p_birds_harvested,
    ROUND(p_total_weight_kg / NULLIF(p_birds_harvested, 0), 2), p_total_weight_kg,
    p_quality_grade, p_buyer_name, p_sale_price_per_kg, v_revenue, p_notes, auth.uid())
  RETURNING harvest_id INTO v_id;

  IF v_revenue > 0 THEN
    INSERT INTO public.transactions (
      farm_id, flock_id, transaction_type, category, amount, description, date, payment_method, created_by)
    VALUES (
      v_flock.farm_id, p_flock_id, 'INCOME', 'Broiler sales', v_revenue,
      format('Batch %s: %s birds, %s kg%s', v_flock.batch_number, p_birds_harvested, p_total_weight_kg,
             CASE WHEN p_buyer_name IS NOT NULL AND p_buyer_name <> '' THEN ' to ' || p_buyer_name ELSE '' END),
      p_harvest_date, p_payment_method, auth.uid());
  END IF;

  IF p_close_batch THEN
    UPDATE public.flocks SET status = 'HARVESTED' WHERE flock_id = p_flock_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_flock_harvest(UUID, DATE, INT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_flock_harvest(UUID, DATE, INT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ============================================
-- END
-- ============================================
