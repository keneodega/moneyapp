-- Migration: Unify goal current_amount formula across all three trigger functions
-- Formula (single source of truth):
--   current_amount = base_amount + SUM(goal_contributions) - SUM(goal_drawdowns legacy) - SUM(transfers WHERE from_goal_id)
--
-- Bug: update_goal_amount_from_contributions used `base + contributions` only,
-- and update_goal_amount_from_drawdowns omitted transfers. Whichever trigger
-- fired last clobbered current_amount with an incomplete value.

-- ============================================
-- 1. update_goal_amount_from_contributions
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
  v_total_drawdowns_legacy DECIMAL(12, 2);
  v_total_transfers_out DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  v_goal_id := COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  IF v_goal_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM public.financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_drawdowns_legacy
  FROM public.goal_drawdowns WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM public.transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount
    + v_total_contributions
    - v_total_drawdowns_legacy
    - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- 2. update_goal_amount_from_drawdowns
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
  v_total_drawdowns_legacy DECIMAL(12, 2);
  v_total_transfers_out DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  v_goal_id := COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  IF v_goal_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM public.financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_drawdowns_legacy
  FROM public.goal_drawdowns WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM public.transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount
    + v_total_contributions
    - v_total_drawdowns_legacy
    - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- 3. update_goal_amount_from_transfers (kept identical for parity)
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
  v_total_drawdowns_legacy DECIMAL(12, 2);
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

  SELECT COALESCE(SUM(amount), 0) INTO v_total_drawdowns_legacy
  FROM public.goal_drawdowns WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM public.transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount
    + v_total_contributions
    - v_total_drawdowns_legacy
    - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- Backfill: recompute every goal's current_amount with the unified formula
-- ============================================
UPDATE public.financial_goals g
SET current_amount = COALESCE(g.base_amount, 0)
  + COALESCE((SELECT SUM(amount) FROM public.goal_contributions WHERE financial_goal_id = g.id), 0)
  - COALESCE((SELECT SUM(amount) FROM public.goal_drawdowns      WHERE financial_goal_id = g.id), 0)
  - COALESCE((SELECT SUM(amount) FROM public.transfers           WHERE from_goal_id        = g.id), 0),
  updated_at = NOW();
