-- ============================================
-- BIKE DANGLER INDUSTRIES - INVESTORS & AUDIT TRAIL
-- Run AFTER 05 (or 04), in the Supabase SQL Editor.
-- Safe to run more than once.
-- ============================================

-- ============================================
-- 1. INVESTORS (separate from role)
-- ============================================
-- Profit share / ROI used to apply only to the PARTNER role. An investor can
-- now also be an OWNER (full access) and still get a Partner Dashboard card.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_investor BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing partners are investors (first run only, so a later "not an
-- investor" choice on the Team page isn't undone by re-running this).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_users') THEN
    UPDATE public.users SET is_investor = TRUE WHERE role = 'PARTNER';
  END IF;
END $$;

-- People may edit their own name/phone; role, email, investor status and
-- profit share are owner-only.
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
          OR NEW.profit_share_pct IS DISTINCT FROM OLD.profit_share_pct
          OR NEW.is_investor IS DISTINCT FROM OLD.is_investor) THEN
    RAISE EXCEPTION 'Only an owner can change roles, emails, investor status or profit shares';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Same as in 03, but for investors (any role) instead of PARTNER only.
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
  u.role,
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
WHERE u.is_investor AND u.role <> 'PENDING';

REVOKE ALL ON public.partner_position FROM anon;
GRANT SELECT ON public.partner_position TO authenticated;

-- ============================================
-- 2. AUDIT TRAIL
-- ============================================
-- Every insert, change and delete on every farm table is written here by a
-- database trigger: who, when, what table/row, and the values before and
-- after. The app can only READ it (owners only); nobody can edit or delete
-- entries from the app. Changes made in the SQL Editor show with no user.

CREATE TABLE IF NOT EXISTS public.audit_log (
  audit_id BIGSERIAL PRIMARY KEY,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[]
);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log (table_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log (user_id, changed_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
DROP POLICY IF EXISTS bd_select ON public.audit_log;
CREATE POLICY bd_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.app_role() = 'OWNER');
-- No insert/update/delete policies or grants: only the trigger below writes.

-- TG_ARGV[0] = the table's primary-key column, stored as record_id.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old     JSONB;
  v_new     JSONB;
  v_changed TEXT[];
  v_email   TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(k ORDER BY k) INTO v_changed
    FROM jsonb_object_keys(v_new) AS k
    WHERE v_new -> k IS DISTINCT FROM v_old -> k
      AND k NOT IN ('updated_at', 'last_updated');
    IF v_changed IS NULL THEN
      RETURN NULL;  -- nothing meaningful changed
    END IF;
  END IF;

  SELECT email INTO v_email FROM public.users WHERE user_id = auth.uid();

  INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, old_data, new_data, changed_fields)
  VALUES (auth.uid(), v_email, TG_OP, TG_TABLE_NAME,
          COALESCE(v_new, v_old) ->> TG_ARGV[0], v_old, v_new, v_changed);
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM anon, authenticated, public;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('users', 'user_id'), ('farms', 'farm_id'), ('fields', 'field_id'), ('buildings', 'building_id'),
    ('flocks', 'flock_id'), ('flock_daily_logs', 'log_id'), ('flock_harvesting', 'harvest_id'),
    ('crop_varieties', 'variety_id'), ('plantings', 'planting_id'), ('crop_daily_logs', 'log_id'),
    ('crop_harvests', 'harvest_id'), ('crop_calendar', 'calendar_id'), ('seasonal_plans', 'plan_id'),
    ('inventory_items', 'item_id'), ('inventory_stock', 'stock_id'), ('inventory_usage', 'usage_id'),
    ('equipment', 'equipment_id'), ('maintenance_logs', 'log_id'), ('reminders', 'reminder_id'),
    ('task_logs', 'task_id'), ('transactions', 'transaction_id'),
    ('partner_contributions', 'contribution_id'), ('financial_summaries', 'summary_id')
  ) AS t(tbl, pk)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'audit_' || r.tbl, r.tbl);
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(%L)', 'audit_' || r.tbl, r.tbl, r.pk);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- END
-- ============================================
