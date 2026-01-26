-- Fix Security Definer View Errors
-- These views need to use SECURITY INVOKER to respect RLS policies
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Drop existing views
-- ============================================
DROP VIEW IF EXISTS public.monthly_overview_summary;
DROP VIEW IF EXISTS public.budget_summary;
DROP VIEW IF EXISTS public.investment_holding_summary;

-- ============================================
-- 2. Recreate Monthly Overview Summary View
-- ============================================
CREATE VIEW public.monthly_overview_summary
WITH (security_invoker = true)
AS
SELECT 
  mo.id,
  mo.user_id,
  mo.name,
  mo.start_date,
  mo.end_date,
  mo.notes,
  (mo.start_date <= CURRENT_DATE AND mo.end_date >= CURRENT_DATE) AS is_active,
  COALESCE((
    SELECT SUM(inc.amount) 
    FROM public.income_sources inc 
    WHERE inc.monthly_overview_id = mo.id
  ), 0) AS total_income,
  COALESCE((
    SELECT SUM(b.budget_amount) 
    FROM public.budgets b 
    WHERE b.monthly_overview_id = mo.id
  ), 0) AS total_budgeted,
  COALESCE((
    SELECT SUM(inc.amount) 
    FROM public.income_sources inc 
    WHERE inc.monthly_overview_id = mo.id
  ), 0) - COALESCE((
    SELECT SUM(b.budget_amount) 
    FROM public.budgets b 
    WHERE b.monthly_overview_id = mo.id
  ), 0) AS amount_unallocated,
  mo.created_at,
  mo.updated_at
FROM public.monthly_overviews mo;

-- ============================================
-- 3. Recreate Budget Summary View
-- ============================================
CREATE VIEW public.budget_summary
WITH (security_invoker = true)
AS
SELECT 
  b.id,
  b.monthly_overview_id,
  b.name,
  b.budget_amount,
  b.master_budget_id,
  b.override_amount,
  b.override_reason,
  COALESCE(SUM(e.amount), 0) AS amount_spent,
  b.budget_amount - COALESCE(SUM(e.amount), 0) AS amount_left,
  CASE 
    WHEN b.budget_amount > 0 THEN (COALESCE(SUM(e.amount), 0) / b.budget_amount) * 100
    ELSE 0 
  END AS percent_used,
  b.description,
  b.created_at,
  b.updated_at
FROM public.budgets b
LEFT JOIN public.expenses e ON e.budget_id = b.id
GROUP BY b.id;

-- ============================================
-- 4. Recreate Investment Holding Summary View
-- ============================================
CREATE VIEW public.investment_holding_summary
WITH (security_invoker = true)
AS
SELECT 
  ih.id,
  ih.user_id,
  ih.name,
  ih.investment_type,
  ih.current_value,
  ih.last_valued_on,
  COALESCE(SUM(CASE WHEN it.transaction_type IN ('Buy', 'Deposit') THEN it.amount ELSE 0 END), 0) AS total_invested,
  COALESCE(SUM(CASE WHEN it.transaction_type IN ('Sell', 'Withdrawal') THEN it.amount ELSE 0 END), 0) AS total_withdrawn,
  COALESCE(SUM(CASE WHEN it.transaction_type IN ('Buy', 'Deposit') THEN it.amount ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN it.transaction_type IN ('Sell', 'Withdrawal') THEN it.amount ELSE 0 END), 0) AS net_invested,
  ih.current_value - (
    COALESCE(SUM(CASE WHEN it.transaction_type IN ('Buy', 'Deposit') THEN it.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN it.transaction_type IN ('Sell', 'Withdrawal') THEN it.amount ELSE 0 END), 0)
  ) AS gain_loss,
  ih.notes,
  ih.created_at,
  ih.updated_at
FROM public.investment_holdings ih
LEFT JOIN public.investment_transactions it ON it.investment_holding_id = ih.id
GROUP BY ih.id;

-- ============================================
-- 5. Grant access to authenticated users
-- ============================================
GRANT SELECT ON public.monthly_overview_summary TO authenticated;
GRANT SELECT ON public.budget_summary TO authenticated;
GRANT SELECT ON public.investment_holding_summary TO authenticated;

-- ============================================
-- Add comments
-- ============================================
COMMENT ON VIEW public.monthly_overview_summary IS 'Monthly overview with computed totals (security invoker)';
COMMENT ON VIEW public.budget_summary IS 'Budget with spent amount calculations and master budget references (security invoker)';
COMMENT ON VIEW public.investment_holding_summary IS 'Investment holding with transaction totals (security invoker)';
