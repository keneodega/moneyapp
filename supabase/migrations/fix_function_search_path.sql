-- Fix Function Search Path Mutable Security Warnings
-- This sets search_path to empty string to prevent security issues
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Fix update_updated_at_column()
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
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
-- 2. Fix create_default_budgets()
-- ============================================
CREATE OR REPLACE FUNCTION create_default_budgets()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.budgets (monthly_overview_id, name, budget_amount, description)
  VALUES 
    (NEW.id, 'Tithe', 350.00, '10% of all income - giving back to God'),
    (NEW.id, 'Offering', 175.00, '5% of main income - additional giving'),
    (NEW.id, 'Housing', 2228.00, 'Rent, Electricity'),
    (NEW.id, 'Food', 350.00, 'Groceries & Snacks'),
    (NEW.id, 'Transport', 200.00, 'Toll, Parking, Fuel'),
    (NEW.id, 'Personal Care', 480.00, 'Personal allowances, Nails'),
    (NEW.id, 'Household', 130.00, 'Household items, Cleaning'),
    (NEW.id, 'Savings', 300.00, 'Monthly savings'),
    (NEW.id, 'Investments', 100.00, '401K, Stocks, Retirement contributions'),
    (NEW.id, 'Subscriptions', 75.00, 'Netflix, Spotify, and other recurring subscriptions'),
    (NEW.id, 'Health', 50.00, 'Medicine or health related'),
    (NEW.id, 'Travel', 50.00, 'Travel Allowance'),
    (NEW.id, 'Miscellaneous', 100.00, 'Unexpected expenses and other items')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================
-- 3. Fix validate_expense_date()
-- ============================================
CREATE OR REPLACE FUNCTION validate_expense_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_month_name TEXT;
BEGIN
  -- Get the monthly overview date range through the budget
  SELECT mo.start_date, mo.end_date, mo.name
  INTO v_start_date, v_end_date, v_month_name
  FROM public.budgets b
  JOIN public.monthly_overviews mo ON mo.id = b.monthly_overview_id
  WHERE b.id = NEW.budget_id;

  -- Validate the expense date is within range
  IF NEW.date < v_start_date OR NEW.date > v_end_date THEN
    RAISE EXCEPTION 'The Expense Date (%) must be between the Start Date (%) and End Date (%) of the associated Monthly Overview (%).',
      NEW.date, v_start_date, v_end_date, v_month_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- 4. Fix validate_no_overspending()
-- ============================================
CREATE OR REPLACE FUNCTION validate_no_overspending()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_budget_amount DECIMAL(12, 2);
  v_current_spent DECIMAL(12, 2);
  v_budget_name TEXT;
  v_amount_left DECIMAL(12, 2);
  v_existing_amount DECIMAL(12, 2) := 0;
BEGIN
  -- Get budget details
  SELECT budget_amount, name
  INTO v_budget_amount, v_budget_name
  FROM public.budgets
  WHERE id = NEW.budget_id;

  -- Get existing expense amount if updating
  IF TG_OP = 'UPDATE' AND OLD.budget_id = NEW.budget_id THEN
    v_existing_amount := OLD.amount;
  END IF;

  -- Calculate current spent (excluding the current expense being updated)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_current_spent
  FROM public.expenses
  WHERE budget_id = NEW.budget_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  -- Calculate what amount left would be with the new expense
  v_amount_left := v_budget_amount - v_current_spent - NEW.amount;

  -- Check for overspending
  IF v_amount_left < 0 THEN
    RAISE EXCEPTION 'Cannot add expense of €%.2f to "%" budget. Budget would be negative by €%.2f. Available: €%.2f',
      NEW.amount, v_budget_name, ABS(v_amount_left), (v_budget_amount - v_current_spent)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- Update comments
-- ============================================
COMMENT ON FUNCTION update_updated_at_column() IS 'Auto-updates updated_at timestamp on row changes';
COMMENT ON FUNCTION create_default_budgets() IS 'Creates 12 default budget categories when a new monthly overview is created';
COMMENT ON FUNCTION validate_expense_date() IS 'Enforces Salesforce validation rule: ExpenseDate_WithinMonthlyOverview';
COMMENT ON FUNCTION validate_no_overspending() IS 'Enforces Salesforce validation rule: Prevent_Overspending';
