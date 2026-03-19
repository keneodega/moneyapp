-- Update budget_summary view to include master budget columns
-- This fixes the issue where budgets with master_budget_id aren't showing up
-- Run this in Supabase SQL Editor

-- ============================================
-- Drop and recreate budget_summary view with master budget columns
-- ============================================
DROP VIEW IF EXISTS public.budget_summary;

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
-- Grant access to authenticated users
-- ============================================
GRANT SELECT ON public.budget_summary TO authenticated;

-- ============================================
-- Add comment
-- ============================================
COMMENT ON VIEW public.budget_summary IS 'Budget with spent amount calculations and master budget references (security invoker)';
