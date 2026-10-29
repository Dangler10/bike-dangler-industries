-- ============================================
-- BIKE DANGLER INDUSTRIES - PER-PARTNER TRACKING
-- Run AFTER 06_investors_and_audit.sql, in the Supabase SQL Editor.
-- Safe to run more than once.
-- ============================================
--
-- Each partner gets a personal dashboard. To track the costs a partner paid
-- out of their own pocket, a money entry can now say WHO PAID it.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES public.users(user_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_paid_by ON public.transactions(paid_by);

-- Entries typed before this existed say "(paid by NAME)" at the end of their
-- description (the 20 expenses from Expenses.xlsx). Link them to the partner.
-- No match = nothing changes, so this is harmless on any other database.
UPDATE public.transactions t
SET paid_by = u.user_id
FROM public.users u
WHERE t.paid_by IS NULL
  AND t.transaction_type = 'EXPENSE'
  AND (
    (lower(u.email) = 'kanyandut@africau.edu' AND t.description ILIKE '%(paid by Tapiwa Dave Kanyandu)%')
    OR
    (lower(u.email) = 'dtbasikoro@gmail.com' AND t.description ILIKE '%(paid by Dylan Basikoro)%')
  );

-- Show real names instead of email addresses where a name hasn't been set.
UPDATE public.users SET full_name = 'Dylan Basikoro'
WHERE lower(email) = 'dtbasikoro@gmail.com' AND full_name IS NULL;

-- ============================================
-- END
-- ============================================
