-- ============================================
-- BIKE DANGLER INDUSTRIES - SECURITY & ROLES
-- Run AFTER bike_dangler_database_schema.sql, in the Supabase SQL Editor.
-- Safe to run more than once.
-- ============================================
--
-- What this does:
--   1. Locks every table with Row Level Security, so the public (anon) key
--      can no longer read or write anything.
--   2. Creates a profile row automatically for every new sign-up, with the
--      role PENDING. Pending users can log in but see nothing until the
--      owner approves them on the Team page.
--   3. Makes YOU the OWNER (set your email below first).
--
-- Who can do what afterwards:
--   OWNER   - everything
--   PARTNER - read everything (farm activity + finances), change nothing
--   WORKER  - read farm activity, add/correct daily logs, no finances
--   PENDING - nothing until approved

-- >>> CHANGE THIS to the email you log in to the app with <<<
DO $$
DECLARE
  owner_email TEXT := 'CHANGE_ME@example.com';
BEGIN
  IF owner_email = 'CHANGE_ME@example.com' THEN
    RAISE EXCEPTION 'Edit owner_email at the top of 01_security_and_roles.sql before running it.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(owner_email)) THEN
    RAISE EXCEPTION 'No account with email % yet. Sign up in the app with that email first, then run this script again.', owner_email;
  END IF;
  PERFORM set_config('bike_dangler.owner_email', lower(owner_email), false);
  -- First run = the sign-up trigger below doesn't exist yet.
  PERFORM set_config('bike_dangler.first_run',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created')
         THEN 'no' ELSE 'yes' END, false);
END $$;

-- ============================================
-- 1. ROLES
-- ============================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('OWNER', 'PARTNER', 'WORKER', 'PENDING'));
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'PENDING';

-- Role of the person making the request (NULL if not logged in / no profile).
-- SECURITY DEFINER so policies on `users` itself don't recurse.
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE user_id = auth.uid()
$$;

-- ============================================
-- 2. PROFILE FOR EVERY SIGN-UP
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (user_id, email, role)
  VALUES (NEW.id, NEW.email, 'PENDING')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Anyone who signed up before this script ran but has no profile yet.
INSERT INTO public.users (user_id, email, role)
SELECT a.id, a.email, 'PENDING'
FROM auth.users a
LEFT JOIN public.users u ON u.user_id = a.id
WHERE u.user_id IS NULL AND a.email IS NOT NULL
ON CONFLICT DO NOTHING;

-- The old app gave every sign-up PARTNER automatically, so nobody's PARTNER
-- role can be trusted. Reset them (first run only, so re-running this script
-- doesn't undo approvals); approve the real ones on the Team page.
UPDATE public.users SET role = 'PENDING'
WHERE role = 'PARTNER' AND current_setting('bike_dangler.first_run') = 'yes';

-- Make the owner.
UPDATE public.users
SET role = 'OWNER', updated_at = NOW()
WHERE lower(email) = current_setting('bike_dangler.owner_email');

-- Only the owner may change anyone's role (including their own).
CREATE OR REPLACE FUNCTION public.guard_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND public.app_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'Only the owner can change roles';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_role_change ON public.users;
CREATE TRIGGER users_guard_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_role_change();

-- ============================================
-- 3. ROW LEVEL SECURITY
-- ============================================

DO $$
DECLARE
  t TEXT;
  pol RECORD;
  -- Farm setup & activity: members read, owner writes.
  operational TEXT[] := ARRAY[
    'farms', 'fields', 'buildings', 'flocks', 'flock_harvesting',
    'crop_varieties', 'plantings', 'crop_harvests', 'crop_calendar', 'seasonal_plans',
    'inventory_items', 'inventory_stock', 'equipment', 'reminders'];
  -- Daily logs: members read, owner + workers add and correct, owner deletes.
  logs TEXT[] := ARRAY[
    'flock_daily_logs', 'crop_daily_logs', 'task_logs', 'inventory_usage', 'maintenance_logs'];
  -- Money: owner + partner read, owner writes.
  finance TEXT[] := ARRAY['transactions', 'partner_contributions', 'financial_summaries'];
BEGIN
  FOREACH t IN ARRAY operational || logs || finance || ARRAY['users'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;

  -- Remove EVERY existing policy on these tables, not just ours. Policies are
  -- OR'ed together, so any leftover "allow all signed-in users" rule (the
  -- live project had some on users, farms and transactions) would silently
  -- override the role rules below.
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY (operational || logs || finance || ARRAY['users'])
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;

  FOREACH t IN ARRAY operational LOOP
    EXECUTE format($p$CREATE POLICY bd_select ON public.%I FOR SELECT TO authenticated
      USING (public.app_role() IN ('OWNER', 'PARTNER', 'WORKER'))$p$, t);
    EXECUTE format($p$CREATE POLICY bd_insert ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.app_role() = 'OWNER')$p$, t);
    EXECUTE format($p$CREATE POLICY bd_update ON public.%I FOR UPDATE TO authenticated
      USING (public.app_role() = 'OWNER') WITH CHECK (public.app_role() = 'OWNER')$p$, t);
    EXECUTE format($p$CREATE POLICY bd_delete ON public.%I FOR DELETE TO authenticated
      USING (public.app_role() = 'OWNER')$p$, t);
  END LOOP;

  FOREACH t IN ARRAY logs LOOP
    EXECUTE format($p$CREATE POLICY bd_select ON public.%I FOR SELECT TO authenticated
      USING (public.app_role() IN ('OWNER', 'PARTNER', 'WORKER'))$p$, t);
    EXECUTE format($p$CREATE POLICY bd_insert ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.app_role() IN ('OWNER', 'WORKER'))$p$, t);
    EXECUTE format($p$CREATE POLICY bd_update ON public.%I FOR UPDATE TO authenticated
      USING (public.app_role() IN ('OWNER', 'WORKER'))
      WITH CHECK (public.app_role() IN ('OWNER', 'WORKER'))$p$, t);
    EXECUTE format($p$CREATE POLICY bd_delete ON public.%I FOR DELETE TO authenticated
      USING (public.app_role() = 'OWNER')$p$, t);
  END LOOP;

  FOREACH t IN ARRAY finance LOOP
    EXECUTE format($p$CREATE POLICY bd_select ON public.%I FOR SELECT TO authenticated
      USING (public.app_role() IN ('OWNER', 'PARTNER'))$p$, t);
    EXECUTE format($p$CREATE POLICY bd_insert ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.app_role() = 'OWNER')$p$, t);
    EXECUTE format($p$CREATE POLICY bd_update ON public.%I FOR UPDATE TO authenticated
      USING (public.app_role() = 'OWNER') WITH CHECK (public.app_role() = 'OWNER')$p$, t);
    EXECUTE format($p$CREATE POLICY bd_delete ON public.%I FOR DELETE TO authenticated
      USING (public.app_role() = 'OWNER')$p$, t);
  END LOOP;
END $$;

-- users: everyone sees their own row; approved members see the team
-- (needed for "assigned to" names); only the owner edits others.
-- Rows are created by the sign-up trigger, never by the app.
CREATE POLICY bd_select ON public.users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.app_role() IN ('OWNER', 'PARTNER', 'WORKER'));
CREATE POLICY bd_update ON public.users FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.app_role() = 'OWNER')
  WITH CHECK (user_id = auth.uid() OR public.app_role() = 'OWNER');
CREATE POLICY bd_delete ON public.users FOR DELETE TO authenticated
  USING (public.app_role() = 'OWNER' AND user_id <> auth.uid());

-- ============================================
-- 4. VIEWS
-- ============================================
-- By default a view runs as its creator and skips RLS. Make the existing
-- views run as the person asking, so the rules above apply to them too.

ALTER VIEW IF EXISTS public.farm_dashboard_summary  SET (security_invoker = true);
ALTER VIEW IF EXISTS public.equipment_maintenance_due SET (security_invoker = true);
ALTER VIEW IF EXISTS public.task_checklist          SET (security_invoker = true);
ALTER VIEW IF EXISTS public.flock_profitability     SET (security_invoker = true);
ALTER VIEW IF EXISTS public.partner_roi_summary     SET (security_invoker = true);

DO $$
DECLARE v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY['farm_dashboard_summary', 'equipment_maintenance_due',
                           'task_checklist', 'flock_profitability', 'partner_roi_summary'] LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.app_role() FROM anon;

-- ============================================
-- END
-- ============================================
