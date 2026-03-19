-- Migration: Update budget_summary view to include transfers in amount_left
-- amount_left = budget_amount + transfers_in - transfers_out - amount_spent

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
  b.budget_amount
    + COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.to_budget_id = b.id), 0)
    - COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.from_budget_id = b.id), 0)
    - COALESCE(SUM(e.amount), 0) AS amount_left,
  CASE 
    WHEN (b.budget_amount
      + COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.to_budget_id = b.id), 0)
      - COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.from_budget_id = b.id), 0)) > 0
    THEN (COALESCE(SUM(e.amount), 0) / (b.budget_amount
      + COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.to_budget_id = b.id), 0)
      - COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.from_budget_id = b.id), 0))) * 100
    ELSE 0 
  END AS percent_used,
  b.description,
  b.created_at,
  b.updated_at
FROM public.budgets b
LEFT JOIN public.expenses e ON e.budget_id = b.id
GROUP BY b.id;

GRANT SELECT ON public.budget_summary TO authenticated;

COMMENT ON VIEW public.budget_summary IS 'Budget with spent amount and transfer-adjusted amount_left (security invoker)';
