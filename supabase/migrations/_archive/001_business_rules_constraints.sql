-- Business Rules Constraints Migration
-- These provide database-level enforcement of business rules
-- The service layer is the primary enforcement, these are backup protection

-- ============================================
-- RULE 1: Auto-create default budgets when monthly overview is created
-- (Already implemented via trigger in main schema)
-- ============================================

-- Verify the trigger exists, recreate if not
CREATE OR REPLACE FUNCTION create_default_budgets()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budgets (monthly_overview_id, name, budget_amount, description)
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_default_budgets_trigger ON monthly_overviews;
CREATE TRIGGER create_default_budgets_trigger
  AFTER INSERT ON monthly_overviews
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budgets();

-- ============================================
-- RULE 2: Expense date must be within monthly overview date range
-- Replicates Salesforce validation rule: ExpenseDate_WithinMonthlyOverview
-- ============================================

CREATE OR REPLACE FUNCTION validate_expense_date()
RETURNS TRIGGER AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_month_name TEXT;
BEGIN
  -- Get the monthly overview date range through the budget
  SELECT mo.start_date, mo.end_date, mo.name
  INTO v_start_date, v_end_date, v_month_name
  FROM budgets b
  JOIN monthly_overviews mo ON mo.id = b.monthly_overview_id
  WHERE b.id = NEW.budget_id;

  -- Validate the expense date is within range
  IF NEW.date < v_start_date OR NEW.date > v_end_date THEN
    RAISE EXCEPTION 'The Expense Date (%) must be between the Start Date (%) and End Date (%) of the associated Monthly Overview (%).',
      NEW.date, v_start_date, v_end_date, v_month_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_expense_date_trigger ON expenses;
CREATE TRIGGER validate_expense_date_trigger
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION validate_expense_date();

-- ============================================
-- RULE 3: Prevent overspending (no negative amount left)
-- Replicates Salesforce validation rule: Prevent_Overspending
-- ============================================

CREATE OR REPLACE FUNCTION validate_no_overspending()
RETURNS TRIGGER AS $$
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
  FROM budgets
  WHERE id = NEW.budget_id;

  -- Get existing expense amount if updating
  IF TG_OP = 'UPDATE' AND OLD.budget_id = NEW.budget_id THEN
    v_existing_amount := OLD.amount;
  END IF;

  -- Calculate current spent (excluding the current expense being updated)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_current_spent
  FROM expenses
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_no_overspending_trigger ON expenses;
CREATE TRIGGER validate_no_overspending_trigger
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION validate_no_overspending();

-- ============================================
-- Additional helpful constraints
-- ============================================

-- Ensure expense amount is positive
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_amount_positive;
ALTER TABLE expenses ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);

-- Ensure budget amount is non-negative
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_budget_amount_non_negative;
ALTER TABLE budgets ADD CONSTRAINT budgets_budget_amount_non_negative CHECK (budget_amount >= 0);

-- Ensure income amount is positive
ALTER TABLE income_sources DROP CONSTRAINT IF EXISTS income_sources_amount_positive;
ALTER TABLE income_sources ADD CONSTRAINT income_sources_amount_positive CHECK (amount > 0);

-- Ensure monthly overview end date is after start date
ALTER TABLE monthly_overviews DROP CONSTRAINT IF EXISTS monthly_overviews_date_range_valid;
ALTER TABLE monthly_overviews ADD CONSTRAINT monthly_overviews_date_range_valid CHECK (end_date >= start_date);

-- ============================================
-- Comment for documentation
-- ============================================
COMMENT ON FUNCTION validate_expense_date() IS 'Enforces Salesforce validation rule: ExpenseDate_WithinMonthlyOverview';
COMMENT ON FUNCTION validate_no_overspending() IS 'Enforces Salesforce validation rule: Prevent_Overspending';
COMMENT ON FUNCTION create_default_budgets() IS 'Replicates Salesforce Flow: Budget_Automation - creates 12 default budget categories';
