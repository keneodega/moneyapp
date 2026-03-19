-- Fix Function Search Path Mutable Security Warnings for Master Budget Functions
-- This sets search_path to empty string to prevent security issues
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Fix get_effective_budget_amount()
-- ============================================
CREATE OR REPLACE FUNCTION get_effective_budget_amount(budget_row budgets)
RETURNS DECIMAL(12, 2)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF budget_row.override_amount IS NOT NULL THEN
    RETURN budget_row.override_amount;
  ELSIF budget_row.master_budget_id IS NOT NULL THEN
    RETURN (SELECT budget_amount FROM public.master_budgets WHERE id = budget_row.master_budget_id);
  ELSE
    RETURN budget_row.budget_amount;
  END IF;
END;
$$;

-- ============================================
-- 2. Fix get_budget_deviation()
-- ============================================
CREATE OR REPLACE FUNCTION get_budget_deviation(budget_row budgets)
RETURNS DECIMAL(12, 2)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  master_amount DECIMAL(12, 2);
  effective_amount DECIMAL(12, 2);
BEGIN
  IF budget_row.master_budget_id IS NULL THEN
    RETURN NULL; -- No master to compare against
  END IF;
  
  -- Get master budget amount
  SELECT budget_amount INTO master_amount
  FROM public.master_budgets
  WHERE id = budget_row.master_budget_id;
  
  -- Get effective amount (override or master)
  IF budget_row.override_amount IS NOT NULL THEN
    effective_amount := budget_row.override_amount;
  ELSE
    effective_amount := master_amount;
  END IF;
  
  -- Return deviation (positive = over, negative = under)
  RETURN effective_amount - master_amount;
END;
$$;

-- ============================================
-- Update comments
-- ============================================
COMMENT ON FUNCTION get_effective_budget_amount(budgets) IS 'Returns override_amount if set, otherwise master budget_amount';
COMMENT ON FUNCTION get_budget_deviation(budgets) IS 'Calculates deviation from master budget (positive = over, negative = under)';
