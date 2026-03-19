-- Migration: Copy existing goal_drawdowns into transfers, then use only transfers for goal balance
-- 1. Copy rows (historical to_budget_id left NULL)
-- 2. Update trigger function to use only transfers (not goal_drawdowns)
-- 3. Recalculate all goal current_amount from base + contributions - transfers
-- goal_drawdowns table is kept read-only for history; no more inserts

INSERT INTO public.transfers (
  user_id,
  monthly_overview_id,
  transfer_type,
  amount,
  date,
  description,
  notes,
  bank,
  from_goal_id
)
SELECT 
  gd.user_id,
  gd.monthly_overview_id,
  'goal_drawdown'::transfer_type,
  gd.amount,
  gd.date,
  gd.description,
  gd.notes,
  gd.bank,
  gd.financial_goal_id
FROM public.goal_drawdowns gd
WHERE NOT EXISTS (
  SELECT 1 FROM public.transfers t
  WHERE t.from_goal_id = gd.financial_goal_id
    AND t.amount = gd.amount
    AND t.date = gd.date
    AND t.monthly_overview_id = gd.monthly_overview_id
    AND t.transfer_type = 'goal_drawdown'
);

-- Use only transfers (not goal_drawdowns) for goal balance from now on
CREATE OR REPLACE FUNCTION update_goal_amount_from_transfers()
RETURNS TRIGGER AS $$
DECLARE
  v_goal_id UUID;
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_total_transfers_out DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  v_goal_id := COALESCE(NEW.from_goal_id, OLD.from_goal_id);
  IF v_goal_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount + v_total_contributions - v_total_transfers_out;

  UPDATE financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- One-time recalc so current_amount matches base + contributions - transfers
UPDATE financial_goals g
SET current_amount = (
  COALESCE(g.base_amount, 0)
  + COALESCE((SELECT SUM(amount) FROM goal_contributions WHERE financial_goal_id = g.id), 0)
  - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_goal_id = g.id), 0)
),
updated_at = NOW();
