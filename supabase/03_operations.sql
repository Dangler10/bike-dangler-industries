-- ============================================
-- BIKE DANGLER INDUSTRIES - PARTNER ROI, TASKS, EQUIPMENT, INVENTORY, CROPS
-- Run AFTER 02_poultry_and_farm_setup.sql, in the Supabase SQL Editor.
-- Safe to run more than once.
-- ============================================

-- ============================================
-- 1. PARTNER PROFIT SHARE & ROI
-- ============================================

-- The % of farm profit each partner is owed (DYLAN_PARTNER_SETUP.md: 50/50 by default).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profit_share_pct NUMERIC(5,2) DEFAULT 50;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_profit_share_range') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_profit_share_range
      CHECK (profit_share_pct IS NULL OR (profit_share_pct >= 0 AND profit_share_pct <= 100));
  END IF;
END $$;

-- People may edit their own name/phone; role, email and profit share are owner-only.
CREATE OR REPLACE FUNCTION public.guard_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.app_role() IS DISTINCT FROM 'OWNER'
     AND (NEW.role IS DISTINCT FROM OLD.role
          OR NEW.email IS DISTINCT FROM OLD.email
          OR NEW.profit_share_pct IS DISTINCT FROM OLD.profit_share_pct) THEN
    RAISE EXCEPTION 'Only the owner can change roles, emails or profit shares';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- The original partner_roi_summary multiplied every contribution by every
-- transaction (wrong totals). Replaced by partner_position below.
DROP VIEW IF EXISTS public.partner_roi_summary;

-- One row per PARTNER: capital put in, their share of all-time profit, ROI.
DROP VIEW IF EXISTS public.partner_position;
CREATE VIEW public.partner_position WITH (security_invoker = true) AS
WITH totals AS (
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'INCOME'), 0) AS farm_income,
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'EXPENSE'), 0) AS farm_expenses,
    MIN(date) AS first_transaction_date
  FROM public.transactions
),
contrib AS (
  SELECT partner_id,
         SUM(contribution_amount) AS total_contributed,
         COUNT(*) AS contributions,
         MIN(contribution_date) AS first_contribution_date
  FROM public.partner_contributions
  GROUP BY partner_id
)
SELECT
  u.user_id AS partner_id,
  COALESCE(u.full_name, u.email) AS partner_name,
  u.email,
  COALESCE(u.profit_share_pct, 0) AS profit_share_pct,
  COALESCE(c.total_contributed, 0) AS total_contributed,
  COALESCE(c.contributions, 0) AS contributions,
  c.first_contribution_date,
  t.first_transaction_date,
  t.farm_income,
  t.farm_expenses,
  t.farm_income - t.farm_expenses AS net_profit,
  ROUND((t.farm_income - t.farm_expenses) * COALESCE(u.profit_share_pct, 0) / 100, 2) AS profit_share,
  ROUND(100 * ((t.farm_income - t.farm_expenses) * COALESCE(u.profit_share_pct, 0) / 100)
        / NULLIF(c.total_contributed, 0), 1) AS roi_pct
FROM public.users u
CROSS JOIN totals t
LEFT JOIN contrib c ON c.partner_id = u.user_id
WHERE u.role = 'PARTNER';

REVOKE ALL ON public.partner_position FROM anon;
GRANT SELECT ON public.partner_position TO authenticated;

-- ============================================
-- 2. TASKS & REMINDERS
-- ============================================
-- `reminders` holds the task (one-off or repeating); `task_logs` holds one
-- row each time it's done. For repeating tasks `due_date` is the start date
-- (WEEKLY repeats on that weekday, MONTHLY on that day of the month).

ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS due_time TIME;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,2);
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(user_id);
UPDATE public.reminders SET due_date = created_at::date WHERE due_date IS NULL;
ALTER TABLE public.reminders ALTER COLUMN due_date SET DEFAULT CURRENT_DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_logs_once_per_day') THEN
    ALTER TABLE public.task_logs ADD CONSTRAINT task_logs_once_per_day UNIQUE (reminder_id, completed_date);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_task_logs_completed_date ON public.task_logs(completed_date);

-- Ticking a task off by mistake must be undoable by whoever can tick it.
DROP POLICY IF EXISTS bd_delete ON public.task_logs;
CREATE POLICY bd_delete ON public.task_logs FOR DELETE TO authenticated
  USING (public.app_role() IN ('OWNER', 'WORKER'));

-- ============================================
-- 3. EQUIPMENT SERVICE (one step)
-- ============================================
-- Logs the service, moves the next due date on by the equipment's
-- maintenance frequency and, for the owner, books the cost as an expense.
-- Workers can log services too (they don't get the expense entry).

CREATE OR REPLACE FUNCTION public.log_equipment_service(
  p_equipment_id UUID,
  p_date DATE,
  p_maintenance_type TEXT DEFAULT NULL,
  p_cost NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT := public.app_role();
  v_eq   public.equipment%ROWTYPE;
  v_next DATE;
  v_id   UUID;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('OWNER', 'WORKER') THEN
    RAISE EXCEPTION 'Only the owner or a worker can log a service';
  END IF;
  SELECT * INTO v_eq FROM public.equipment WHERE equipment_id = p_equipment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found';
  END IF;

  v_next := CASE WHEN COALESCE(v_eq.maintenance_frequency_months, 0) > 0
                 THEN (p_date + make_interval(months => v_eq.maintenance_frequency_months))::date END;

  INSERT INTO public.maintenance_logs (equipment_id, maintenance_date, maintenance_type, cost, notes, next_due_date)
  VALUES (p_equipment_id, p_date, p_maintenance_type, p_cost, p_notes, v_next)
  RETURNING log_id INTO v_id;

  UPDATE public.equipment
  SET next_maintenance_date = COALESCE(v_next, next_maintenance_date),
      current_status = CASE WHEN current_status = 'MAINTENANCE' THEN 'ACTIVE' ELSE current_status END
  WHERE equipment_id = p_equipment_id;

  IF v_role = 'OWNER' AND COALESCE(p_cost, 0) > 0 THEN
    INSERT INTO public.transactions (farm_id, transaction_type, category, amount, description, date, payment_method, created_by)
    VALUES (v_eq.farm_id, 'EXPENSE', 'Maintenance', p_cost,
            format('%s: %s', v_eq.equipment_name, COALESCE(NULLIF(p_maintenance_type, ''), 'service')),
            p_date, p_payment_method, auth.uid());
  END IF;

  RETURN v_id;
END;
$$;

-- ============================================
-- 4. INVENTORY
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_stock_one_per_item') THEN
    ALTER TABLE public.inventory_stock ADD CONSTRAINT inventory_stock_one_per_item UNIQUE (item_id);
  END IF;
END $$;
ALTER TABLE public.inventory_usage ADD COLUMN IF NOT EXISTS flock_id UUID REFERENCES public.flocks(flock_id);

-- Which feed bag the daily feed came from, so logging feed draws stock down.
ALTER TABLE public.flock_daily_logs ADD COLUMN IF NOT EXISTS feed_item_id UUID REFERENCES public.inventory_items(item_id);

-- Keeps feed stock in step with poultry daily logs (insert, correct, delete).
-- SECURITY DEFINER because workers log feed but can't edit stock directly.
-- Stock is allowed to go negative here: a log must never be refused because
-- a delivery wasn't entered yet.
CREATE OR REPLACE FUNCTION public.sync_feed_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.feed_item_id IS NOT NULL AND COALESCE(OLD.feed_given_kg, 0) <> 0 THEN
    INSERT INTO public.inventory_stock (item_id, quantity_in_stock) VALUES (OLD.feed_item_id, OLD.feed_given_kg)
    ON CONFLICT (item_id) DO UPDATE
      SET quantity_in_stock = public.inventory_stock.quantity_in_stock + EXCLUDED.quantity_in_stock,
          last_updated = NOW();
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.feed_item_id IS NOT NULL AND COALESCE(NEW.feed_given_kg, 0) <> 0 THEN
    INSERT INTO public.inventory_stock (item_id, quantity_in_stock) VALUES (NEW.feed_item_id, -NEW.feed_given_kg)
    ON CONFLICT (item_id) DO UPDATE
      SET quantity_in_stock = public.inventory_stock.quantity_in_stock + EXCLUDED.quantity_in_stock,
          last_updated = NOW();
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS flock_daily_logs_sync_feed_stock ON public.flock_daily_logs;
CREATE TRIGGER flock_daily_logs_sync_feed_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.flock_daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_feed_stock();

-- Delivery / purchase: adds stock, updates unit cost, books the expense.
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
      farm_id, flock_id, planting_id, transaction_type, category, amount, description, date, payment_method, created_by)
    VALUES (
      v_item.farm_id, p_flock_id, p_planting_id, 'EXPENSE', initcap(v_item.item_type), p_total_cost,
      format('%s %s %s%s', p_quantity, COALESCE(v_item.unit_of_measure, ''), v_item.item_name,
             CASE WHEN COALESCE(p_notes, '') <> '' THEN ' - ' || p_notes ELSE '' END),
      p_date, p_payment_method, auth.uid());
  END IF;
END;
$$;

-- Using stock outside the feed log (fertiliser, chemicals, vaccines...).
CREATE OR REPLACE FUNCTION public.use_stock(
  p_item_id UUID,
  p_quantity NUMERIC,
  p_date DATE DEFAULT CURRENT_DATE,
  p_reason TEXT DEFAULT NULL,
  p_flock_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_have NUMERIC;
BEGIN
  IF public.app_role() IS NULL OR public.app_role() NOT IN ('OWNER', 'WORKER') THEN
    RAISE EXCEPTION 'Only the owner or a worker can use stock';
  END IF;
  IF COALESCE(p_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Quantity must be more than 0';
  END IF;
  SELECT quantity_in_stock INTO v_have FROM public.inventory_stock WHERE item_id = p_item_id FOR UPDATE;
  IF COALESCE(v_have, 0) < p_quantity THEN
    RAISE EXCEPTION 'Only % in stock', COALESCE(v_have, 0);
  END IF;

  UPDATE public.inventory_stock
  SET quantity_in_stock = quantity_in_stock - p_quantity, last_updated = NOW()
  WHERE item_id = p_item_id;

  INSERT INTO public.inventory_usage (item_id, quantity_used, usage_date, reason, used_by, flock_id)
  VALUES (p_item_id, p_quantity, p_date, p_reason, auth.uid(), p_flock_id);
END;
$$;

-- Stock on hand, recent daily use and days left, per item.
DROP VIEW IF EXISTS public.inventory_levels;
CREATE VIEW public.inventory_levels WITH (security_invoker = true) AS
SELECT
  i.item_id,
  i.farm_id,
  i.item_name,
  i.item_type,
  i.unit_of_measure,
  i.unit_cost,
  i.supplier_name,
  COALESCE(s.quantity_in_stock, 0) AS quantity_in_stock,
  s.reorder_level,
  s.last_updated,
  COALESCE(u.used_7d, 0) + COALESCE(f.fed_7d, 0) AS used_last_7_days,
  CASE WHEN COALESCE(u.used_7d, 0) + COALESCE(f.fed_7d, 0) > 0
       THEN ROUND(COALESCE(s.quantity_in_stock, 0) / ((COALESCE(u.used_7d, 0) + COALESCE(f.fed_7d, 0)) / 7.0), 1)
  END AS days_left,
  (s.reorder_level IS NOT NULL AND COALESCE(s.quantity_in_stock, 0) <= s.reorder_level) AS is_low
FROM public.inventory_items i
LEFT JOIN public.inventory_stock s ON s.item_id = i.item_id
LEFT JOIN (
  SELECT item_id, SUM(quantity_used) AS used_7d
  FROM public.inventory_usage
  WHERE usage_date > CURRENT_DATE - 7
  GROUP BY item_id
) u ON u.item_id = i.item_id
LEFT JOIN (
  SELECT feed_item_id AS item_id, SUM(feed_given_kg) AS fed_7d
  FROM public.flock_daily_logs
  WHERE log_date > CURRENT_DATE - 7 AND feed_item_id IS NOT NULL
  GROUP BY feed_item_id
) f ON f.item_id = i.item_id;

REVOKE ALL ON public.inventory_levels FROM anon;
GRANT SELECT ON public.inventory_levels TO authenticated;

-- ============================================
-- 5. CROPS
-- ============================================

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS planting_id UUID REFERENCES public.plantings(planting_id);
CREATE INDEX IF NOT EXISTS idx_transactions_planting_id ON public.transactions(planting_id);
ALTER TABLE public.crop_daily_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.crop_daily_logs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(user_id);
ALTER TABLE public.crop_harvests ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(user_id);
ALTER TABLE public.plantings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crop_daily_logs_one_per_day') THEN
    ALTER TABLE public.crop_daily_logs ADD CONSTRAINT crop_daily_logs_one_per_day UNIQUE (planting_id, log_date);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_crop_daily_logs_planting_id ON public.crop_daily_logs(planting_id);
CREATE INDEX IF NOT EXISTS idx_crop_harvests_planting_id ON public.crop_harvests(planting_id);

-- Starter crop data from the original schema (its sample block never ran).
INSERT INTO public.crop_varieties (crop_name, typical_cycle_days, typical_yield_kg_per_sqm)
SELECT v.* FROM (VALUES ('Green Pepper', 75, 1.5), ('Tsunga', 45, 1.2), ('Cabbage', 90, 2.0))
  AS v(crop_name, typical_cycle_days, typical_yield_kg_per_sqm)
WHERE NOT EXISTS (SELECT 1 FROM public.crop_varieties x WHERE x.crop_name = v.crop_name);

INSERT INTO public.crop_calendar (farm_id, crop_name, optimal_planting_month, nursery_start_month, nursery_duration_days,
                                  transplant_month, days_to_harvest, harvest_start_month, expected_yield_kg_per_sqm, peak_season_price_per_kg)
SELECT f.farm_id, v.* FROM public.farms f
CROSS JOIN (VALUES ('Green Pepper', 9, 8, 30, 9, 75, 12, 1.5, NULL::NUMERIC), ('Tsunga', 9, 8, 20, 9, 45, 10, 1.2, NULL::NUMERIC))
  AS v(crop_name, optimal_planting_month, nursery_start_month, nursery_duration_days, transplant_month,
       days_to_harvest, harvest_start_month, expected_yield_kg_per_sqm, peak_season_price_per_kg)
WHERE NOT EXISTS (SELECT 1 FROM public.crop_calendar c WHERE c.farm_id = f.farm_id);

-- One row per planting with harvest and money totals.
DROP VIEW IF EXISTS public.planting_summary;
CREATE VIEW public.planting_summary WITH (security_invoker = true) AS
SELECT
  p.planting_id,
  fl.farm_id,
  p.field_id,
  fl.field_name,
  fl.field_type,
  p.crop_name,
  p.planting_date,
  p.expected_harvest_date,
  p.area_planted_sqm,
  p.expected_yield_kg,
  p.current_status,
  p.notes,
  (CURRENT_DATE - p.planting_date) AS age_days,
  (p.expected_harvest_date - CURRENT_DATE) AS days_to_harvest,
  l.last_log_date,
  COALESCE(h.harvested_kg, 0) AS harvested_kg,
  COALESCE(h.revenue, 0) AS revenue,
  COALESCE(x.expenses, 0) AS expenses,
  COALESCE(h.revenue, 0) - COALESCE(x.expenses, 0) AS profit
FROM public.plantings p
JOIN public.fields fl ON fl.field_id = p.field_id
LEFT JOIN (
  SELECT planting_id, MAX(log_date) AS last_log_date FROM public.crop_daily_logs GROUP BY planting_id
) l ON l.planting_id = p.planting_id
LEFT JOIN (
  SELECT planting_id, SUM(quantity_harvested_kg) AS harvested_kg, SUM(total_revenue) AS revenue
  FROM public.crop_harvests GROUP BY planting_id
) h ON h.planting_id = p.planting_id
LEFT JOIN (
  SELECT planting_id, SUM(amount) AS expenses
  FROM public.transactions
  WHERE transaction_type = 'EXPENSE' AND planting_id IS NOT NULL
  GROUP BY planting_id
) x ON x.planting_id = p.planting_id;

REVOKE ALL ON public.planting_summary FROM anon;
GRANT SELECT ON public.planting_summary TO authenticated;

-- Harvest / sale of a crop in one step (owner only), like record_flock_harvest.
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
      farm_id, planting_id, transaction_type, category, amount, description, date, payment_method, created_by)
    VALUES (
      v_farm, p_planting_id, 'INCOME', 'Crop sales', v_revenue,
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

-- ============================================
-- 6. PERMISSIONS FOR THE NEW FUNCTIONS
-- ============================================

REVOKE EXECUTE ON FUNCTION public.log_equipment_service(UUID, DATE, TEXT, NUMERIC, TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_equipment_service(UUID, DATE, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.receive_stock(UUID, NUMERIC, NUMERIC, DATE, TEXT, UUID, UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.receive_stock(UUID, NUMERIC, NUMERIC, DATE, TEXT, UUID, UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.use_stock(UUID, NUMERIC, DATE, TEXT, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.use_stock(UUID, NUMERIC, DATE, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_crop_harvest(UUID, DATE, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_crop_harvest(UUID, DATE, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
-- Trigger-only; nobody calls it directly.
REVOKE EXECUTE ON FUNCTION public.sync_feed_stock() FROM anon, authenticated, public;

-- ============================================
-- END
-- ============================================
