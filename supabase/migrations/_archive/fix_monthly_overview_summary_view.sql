-- Migration: Fix monthly_overview_summary view calculation
-- The original view used SUM(DISTINCT ...) which can cause incorrect totals
-- This uses subqueries to properly aggregate income and budgets separately

DROP VIEW IF EXISTS public.monthly_overview_summary;

CREATE VIEW public.monthly_overview_summary
WITH (security_invoker = true) AS
SELECT 
  mo.id,
  mo.user_id,
  mo.name,
  mo.start_date,
  mo.end_date,
  mo.notes,
  (mo.start_date <= CURRENT_DATE AND mo.end_date >= CURRENT_DATE) AS is_active,
  COALESCE(income_totals.total_income, 0) AS total_income,
  COALESCE(budget_totals.total_budgeted, 0) AS total_budgeted,
  COALESCE(expense_totals.total_spent, 0) AS total_spent,
  COALESCE(income_totals.total_income, 0) - COALESCE(budget_totals.total_budgeted, 0) AS amount_unallocated,
  mo.created_at,
  mo.updated_at
FROM monthly_overviews mo
LEFT JOIN (
  SELECT 
    monthly_overview_id,
    SUM(amount) AS total_income
  FROM income_sources
  GROUP BY monthly_overview_id
) income_totals ON income_totals.monthly_overview_id = mo.id
LEFT JOIN (
  SELECT 
    monthly_overview_id,
    SUM(budget_amount) AS total_budgeted
  FROM budgets
  GROUP BY monthly_overview_id
) budget_totals ON budget_totals.monthly_overview_id = mo.id
LEFT JOIN (
  SELECT 
    b.monthly_overview_id,
    SUM(e.amount) AS total_spent
  FROM budgets b
  LEFT JOIN expenses e ON e.budget_id = b.id
  GROUP BY b.monthly_overview_id
) expense_totals ON expense_totals.monthly_overview_id = mo.id;

-- Grant access
GRANT SELECT ON public.monthly_overview_summary TO authenticated;

-- Add comment
COMMENT ON VIEW public.monthly_overview_summary IS 'Monthly overview with computed totals (security invoker) - Fixed calculation using subqueries';
