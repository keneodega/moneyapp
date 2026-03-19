-- Fix Remaining Function Search Path Mutable Security Warnings
-- This sets search_path to empty string to prevent security issues
-- Run this in Supabase SQL Editor
--
-- This migration fixes functions that were added in later migrations:
-- - Loan functions
-- - Transfer functions  
-- - Savings bucket functions
-- - Goal contribution functions
-- - Goal drawdown functions

-- ============================================
-- 1. Fix update_loan_balance_after_payment()
-- ============================================
CREATE OR REPLACE FUNCTION update_loan_balance_after_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Update the loan's current balance when a payment is made
  UPDATE public.loans
  SET 
    current_balance = GREATEST(0, current_balance - NEW.principal_amount),
    last_payment_date = NEW.payment_date,
    next_payment_date = CASE 
      WHEN payment_frequency = 'Monthly' THEN NEW.payment_date + INTERVAL '1 month'
      WHEN payment_frequency = 'Bi-Weekly' THEN NEW.payment_date + INTERVAL '14 days'
      WHEN payment_frequency = 'Weekly' THEN NEW.payment_date + INTERVAL '7 days'
      WHEN payment_frequency = 'Quarterly' THEN NEW.payment_date + INTERVAL '3 months'
      ELSE NEW.payment_date + INTERVAL '1 month'
    END,
    status = CASE 
      WHEN current_balance - NEW.principal_amount <= 0 THEN 'Paid Off'::public.loan_status_type
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = NEW.loan_id;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Fix update_loans_updated_at()
-- ============================================
CREATE OR REPLACE FUNCTION update_loans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- 3. Fix update_savings_bucket_amount()
-- ============================================
CREATE OR REPLACE FUNCTION update_savings_bucket_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.savings_buckets
    SET current_amount = current_amount + 
      CASE 
        WHEN NEW.transaction_type IN ('deposit', 'transfer_in') THEN NEW.amount
        WHEN NEW.transaction_type IN ('withdrawal', 'transfer_out') THEN -NEW.amount
        ELSE 0
      END
    WHERE id = NEW.savings_bucket_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Remove old transaction impact
    UPDATE public.savings_buckets
    SET current_amount = current_amount - 
      CASE 
        WHEN OLD.transaction_type IN ('deposit', 'transfer_in') THEN OLD.amount
        WHEN OLD.transaction_type IN ('withdrawal', 'transfer_out') THEN -OLD.amount
        ELSE 0
      END
    WHERE id = OLD.savings_bucket_id;
    -- Add new transaction impact
    UPDATE public.savings_buckets
    SET current_amount = current_amount + 
      CASE 
        WHEN NEW.transaction_type IN ('deposit', 'transfer_in') THEN NEW.amount
        WHEN NEW.transaction_type IN ('withdrawal', 'transfer_out') THEN -NEW.amount
        ELSE 0
      END
    WHERE id = NEW.savings_bucket_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Remove transaction impact
    UPDATE public.savings_buckets
    SET current_amount = current_amount - 
      CASE 
        WHEN OLD.transaction_type IN ('deposit', 'transfer_in') THEN OLD.amount
        WHEN OLD.transaction_type IN ('withdrawal', 'transfer_out') THEN -OLD.amount
        ELSE 0
      END
    WHERE id = OLD.savings_bucket_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================
-- 4. Fix update_transfers_updated_at()
-- ============================================
CREATE OR REPLACE FUNCTION update_transfers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- 5. Fix update_goal_amount_from_transfers()
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

  v_new_current_amount := v_base_amount + v_total_contributions - v_total_drawdowns_legacy - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- 6. Fix update_goal_contributions_updated_at()
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_contributions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- 7. Fix update_goal_amount_from_contributions()
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_amount_from_contributions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  -- Get base_amount from goal
  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM public.financial_goals
  WHERE id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  -- Calculate total contributions for this goal
  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions
  WHERE financial_goal_id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  -- New current_amount = base_amount + total contributions
  v_new_current_amount := v_base_amount + v_total_contributions;
  
  -- Update the goal's current_amount
  UPDATE public.financial_goals
  SET 
    current_amount = v_new_current_amount,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- 8. Fix update_goal_amount_from_drawdowns()
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_amount_from_drawdowns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_total_drawdowns DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  -- Get base_amount from goal
  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM public.financial_goals
  WHERE id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  -- Calculate total contributions for this goal
  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions
  WHERE financial_goal_id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  -- Calculate total drawdowns for this goal
  SELECT COALESCE(SUM(amount), 0) INTO v_total_drawdowns
  FROM public.goal_drawdowns
  WHERE financial_goal_id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  -- New current_amount = base_amount + total contributions - total drawdowns
  v_new_current_amount := v_base_amount + v_total_contributions - v_total_drawdowns;
  
  -- Update the goal's current_amount
  UPDATE public.financial_goals
  SET 
    current_amount = v_new_current_amount,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- 9. Fix update_goal_drawdowns_updated_at()
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_drawdowns_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- Add comments
-- ============================================
COMMENT ON FUNCTION update_loan_balance_after_payment() IS 'Updates loan balance and status when a payment is made';
COMMENT ON FUNCTION update_loans_updated_at() IS 'Auto-updates updated_at timestamp on loans table';
COMMENT ON FUNCTION update_savings_bucket_amount() IS 'Updates savings bucket current_amount when transactions are added/updated/deleted';
COMMENT ON FUNCTION update_transfers_updated_at() IS 'Auto-updates updated_at timestamp on transfers table';
COMMENT ON FUNCTION update_goal_amount_from_transfers() IS 'Recalculates goal current_amount when transfers involving the goal occur';
COMMENT ON FUNCTION update_goal_contributions_updated_at() IS 'Auto-updates updated_at timestamp on goal_contributions table';
COMMENT ON FUNCTION update_goal_amount_from_contributions() IS 'Recalculates goal current_amount when contributions are added/updated/deleted';
COMMENT ON FUNCTION update_goal_amount_from_drawdowns() IS 'Recalculates goal current_amount when drawdowns are added/updated/deleted';
COMMENT ON FUNCTION update_goal_drawdowns_updated_at() IS 'Auto-updates updated_at timestamp on goal_drawdowns table';
