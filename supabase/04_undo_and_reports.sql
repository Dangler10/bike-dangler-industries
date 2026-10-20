-- ============================================
-- BIKE DANGLER INDUSTRIES - CLEAN DELETES & BATCH REPORTING
-- Run AFTER 03_operations.sql, in the Supabase SQL Editor.
-- Safe to run more than once.
-- ============================================
--
-- Before this, deleting a sale's income on the Partner Dashboard left the
-- harvest behind (batch/crop profit still counted it), and deleting a stock
-- delivery's expense left the stock in place. Money entries now remember what
-- created them, and deleting either side undoes both.

-- ============================================
-- 1. LINK MONEY ENTRIES TO WHAT CREATED THEM
-- ============================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS flock_harvest_id UUID REFERENCES public.flock_harvesting(harvest_id) ON DELETE CASCADE;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS crop_harvest_id UUID REFERENCES public.crop_harvests(harvest_id) ON DELETE CASCADE;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(item_id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(12,2);

-- Link sales recorded before this script (same batch/crop, date and amount).
UPDATE public.transactions t
SET flock_harvest_id = h.harvest_id
FROM public.flock_harvesting h
WHERE t.flock_harvest_id IS NULL AND t.transaction_type = 'INCOME' AND t.category = 'Broiler sales'
  AND t.flock_id = h.flock_id AND t.date = h.harvest_date AND t.amount = h.total_revenue
  AND NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.flock_harvest_id = h.harvest_id);

UPDATE public.transactions t
SET crop_harvest_id = h.harvest_id
FROM public.crop_harvests h
WHERE t.crop_harvest_id IS NULL AND t.transaction_type = 'INCOME' AND t.category = 'Crop sales'
  AND t.planting_id = h.planting_id AND t.date = h.harvest_date AND t.amount = h.total_revenue
  AND NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.crop_harvest_id = h.harvest_id);

-- ============================================
-- 2. RECORDING FUNCTIONS NOW SET THE LINKS
-- ============================================

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
      farm_id, flock_id, flock_harvest_id, transaction_type, category, amount, description, date, payment_method, created_by)
    VALUES (
      v_flock.farm_id, p_flock_id, v_id, 'INCOME', 'Broiler sales', v_revenue,
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

CREATE OR REPLACE FUNCTION public.record_crop_harvest(
  p_planting_id UUID,
  p_harvest_date DATE,
  p_quantity_kg NUMERIC,
  p_price_per_kg NUMERIC DEFAULT 0,
  p_buyer_name TEXT DEFAULT NULL,
  p_quality_grade TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_finished BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_p       public.plantings%ROWTYPE;
  v_farm    UUID;
  v_revenue NUMERIC;
  v_id      UUID;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'Only the owner can record harvests';
  END IF;
  IF COALESCE(p_quantity_kg, 0) <= 0 THEN
    RAISE EXCEPTION 'Quantity must be more than 0';
  END IF;
  SELECT * INTO v_p FROM public.plantings WHERE planting_id = p_planting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planting not found';
  END IF;
  SELECT farm_id INTO v_farm FROM public.fields WHERE field_id = v_p.field_id;

  v_revenue := ROUND(p_quantity_kg * COALESCE(p_price_per_kg, 0), 2);

  INSERT INTO public.crop_harvests (
    planting_id, harvest_date, quantity_harvested_kg, quality_grade, market_price_per_kg,
    total_revenue, buyer_name, notes, created_by)
  VALUES (
    p_planting_id, p_harvest_date, p_quantity_kg, p_quality_grade, p_price_per_kg,
    v_revenue, p_buyer_name, p_notes, auth.uid())
  RETURNING harvest_id INTO v_id;

  IF v_revenue > 0 THEN
    INSERT INTO public.transactions (
      farm_id, planting_id, crop_harvest_id, transaction_type, category, amount, description, date, payment_method, created_by)
    VALUES (
      v_farm, p_planting_id, v_id, 'INCOME', 'Crop sales', v_revenue,
      format('%s: %s kg%s', v_p.crop_name, p_quantity_kg,
             CASE WHEN COALESCE(p_buyer_name, '') <> '' THEN ' to ' || p_buyer_name ELSE '' END),
      p_harvest_date, p_payment_method, auth.uid());
  END IF;

  UPDATE public.plantings
  SET current_status = CASE WHEN p_finished THEN 'HARVESTED' ELSE 'READY_FOR_HARVEST' END
  WHERE planting_id = p_planting_id AND current_status <> 'HARVESTED';

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_stock(
  p_item_id UUID,
  p_quantity NUMERIC,
  p_total_cost NUMERIC DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_payment_method TEXT DEFAULT NULL,
  p_flock_id UUID DEFAULT NULL,
  p_planting_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item public.inventory_items%ROWTYPE;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'Only the owner can record deliveries';
  END IF;
  IF COALESCE(p_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Quantity must be more than 0';
  END IF;
  SELECT * INTO v_item FROM public.inventory_items WHERE item_id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  INSERT INTO public.inventory_stock (item_id, quantity_in_stock) VALUES (p_item_id, p_quantity)
  ON CONFLICT (item_id) DO UPDATE
    SET quantity_in_stock = public.inventory_stock.quantity_in_stock + EXCLUDED.quantity_in_stock,
        last_updated = NOW();

  IF COALESCE(p_total_cost, 0) > 0 THEN
    UPDATE public.inventory_items SET unit_cost = ROUND(p_total_cost / p_quantity, 2) WHERE item_id = p_item_id;
    INSERT INTO public.transactions (
      farm_id, flock_id, planting_id, inventory_item_id, stock_quantity,
      transaction_type, category, amount, description, date, payment_method, created_by)
    VALUES (
      v_item.farm_id, p_flock_id, p_planting_id, p_item_id, p_quantity,
      'EXPENSE', initcap(v_item.item_type), p_total_cost,
      format('%s %s %s%s', p_quantity, COALESCE(v_item.unit_of_measure, ''), v_item.item_name,
             CASE WHEN COALESCE(p_notes, '') <> '' THEN ' - ' || p_notes ELSE '' END),
      p_date, p_payment_method, auth.uid());
  END IF;
END;
$$;

-- ============================================
-- 3. UNDO A SALE / HARVEST
-- ============================================
-- Deletes the harvest; its income entry goes with it (ON DELETE CASCADE).
-- A batch closed by sales is reopened if birds are left; a crop goes back
-- to Growing / Harvesting depending on whether other harvests remain.

CREATE OR REPLACE FUNCTION public.delete_harvest(p_kind TEXT, p_harvest_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_parent UUID;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'Only the owner can delete sales';
  END IF;

  IF p_kind = 'flock' THEN
    DELETE FROM public.flock_harvesting WHERE harvest_id = p_harvest_id RETURNING flock_id INTO v_parent;
    IF v_parent IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
    UPDATE public.flocks f SET status = 'ACTIVE'
    WHERE f.flock_id = v_parent AND f.status = 'HARVESTED'
      AND (SELECT birds_alive FROM public.flock_summary s WHERE s.flock_id = v_parent) > 0;
  ELSIF p_kind = 'crop' THEN
    DELETE FROM public.crop_harvests WHERE harvest_id = p_harvest_id RETURNING planting_id INTO v_parent;
    IF v_parent IS NULL THEN RAISE EXCEPTION 'Harvest not found'; END IF;
    UPDATE public.plantings SET current_status =
      CASE WHEN EXISTS (SELECT 1 FROM public.crop_harvests WHERE planting_id = v_parent)
           THEN 'READY_FOR_HARVEST' ELSE 'GROWING' END
    WHERE planting_id = v_parent AND current_status IN ('HARVESTED', 'READY_FOR_HARVEST');
  ELSE
    RAISE EXCEPTION 'Unknown kind %', p_kind;
  END IF;
END;
$$;

-- Deletes a money entry and whatever it stands for: a sale's harvest record,
-- or a delivery's stock (taken back out, never below zero).
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_t public.transactions%ROWTYPE;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'Only the owner can delete transactions';
  END IF;
  SELECT * INTO v_t FROM public.transactions WHERE transaction_id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_t.flock_harvest_id IS NOT NULL THEN
    PERFORM public.delete_harvest('flock', v_t.flock_harvest_id);
  ELSIF v_t.crop_harvest_id IS NOT NULL THEN
    PERFORM public.delete_harvest('crop', v_t.crop_harvest_id);
  ELSE
    IF v_t.inventory_item_id IS NOT NULL AND COALESCE(v_t.stock_quantity, 0) > 0 THEN
      UPDATE public.inventory_stock
      SET quantity_in_stock = GREATEST(0, quantity_in_stock - v_t.stock_quantity), last_updated = NOW()
      WHERE item_id = v_t.inventory_item_id;
    END IF;
    DELETE FROM public.transactions WHERE transaction_id = p_transaction_id;
  END IF;
END;
$$;

-- ============================================
-- 4. BATCH SUMMARY: ADD SALE DATES
-- ============================================
-- Same as 02, plus first/last sale date (for days-to-sale and batch comparison).

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
  h.first_sale_date,
  h.last_sale_date,
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
         SUM(total_revenue) AS revenue,
         MIN(harvest_date) AS first_sale_date,
         MAX(harvest_date) AS last_sale_date
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
-- 5. PERMISSIONS
-- ============================================

REVOKE EXECUTE ON FUNCTION public.delete_harvest(TEXT, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_harvest(TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_transaction(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_transaction(UUID) TO authenticated;

-- ============================================
-- END
-- ============================================
