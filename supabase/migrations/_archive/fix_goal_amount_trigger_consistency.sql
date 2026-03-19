-- Fix Goal Amount Trigger Consistency
--
-- Problem: Three trigger functions update financial_goals.current_amount with
-- INCONSISTENT formulas, causing amounts to be wrong:
--   1. update_goal_amount_from_contributions: base + contributions (IGNORES transfers)
--   2. update_goal_amount_from_drawdowns: base + contributions - legacy_drawdowns (IGNORES transfers)
--   3. update_goal_amount_from_transfers: base + contributions - legacy_drawdowns - transfers
--
-- Fix: All three functions use the SAME formula:
--   current_amount = base_amount + contributions - transfers_out
--
-- The transfers table is the single source of truth for drawdowns (goal_drawdowns is legacy).
-- Run this in Supabase SQL Editor.

-- ============================================
-- 1. Fix update_goal_amount_from_transfers()
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_amount_from_transfers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
  FROM public.financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM public.transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount + v_total_contributions - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- 2. Fix update_goal_amount_from_contributions()
--    Must also account for transfers out
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_amount_from_contributions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_goal_id UUID;
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_total_transfers_out DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  v_goal_id := COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);

  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM public.financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM public.transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount + v_total_contributions - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- 3. Fix update_goal_amount_from_drawdowns()
--    Use transfers table (not legacy goal_drawdowns)
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_amount_from_drawdowns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_goal_id UUID;
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_total_transfers_out DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  v_goal_id := COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);

  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM public.financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM public.transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount + v_total_contributions - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- 4. Fix goal_drawdown constraint to be mutually exclusive with goal_to_budget
--    Add to_budget_id IS NULL so it doesn't conflict
-- ============================================
ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_goal_drawdown;
ALTER TABLE public.transfers ADD CONSTRAINT transfers_goal_drawdown CHECK (
  (transfer_type = 'goal_drawdown') = (from_goal_id IS NOT NULL AND from_budget_id IS NULL AND to_budget_id IS NULL)
);

-- ============================================
-- 5. Recalculate all goal current_amounts
-- ============================================
UPDATE public.financial_goals g
SET current_amount = (
  COALESCE(g.base_amount, 0)
  + COALESCE((SELECT SUM(amount) FROM public.goal_contributions WHERE financial_goal_id = g.id), 0)
  - COALESCE((SELECT SUM(amount) FROM public.transfers WHERE from_goal_id = g.id), 0)
),
updated_at = NOW();
