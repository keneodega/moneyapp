-- ============================================
-- Remove the expense blocking rules
--
-- Drops the two BEFORE INSERT OR UPDATE triggers on `expenses` that reject
-- writes: `validate_no_overspending_trigger` and `validate_expense_date_trigger`
-- (both from 001_business_rules_constraints.sql, ported from Salesforce
-- validation rules Prevent_Overspending and ExpenseDate_WithinMonthlyOverview).
--
-- NOTE: verified 2026-07-17 that neither trigger actually exists in production —
-- 001_business_rules_constraints.sql was never applied. This migration is
-- therefore a no-op against the live database and exists as a safety net for any
-- environment where that file WAS run. The real block was client-side.
--
-- Why:
--
-- 1. Overspending is information, not an error. The money has already left the
--    account by the time it is recorded; refusing the row does not prevent the
--    spend, it only prevents knowing about it. In practice the only way past
--    the block was to edit the budget up to match actuals, which turned
--    `budgets.budget_amount` from a plan into a receipt (February 2026: 11 of
--    11 categories where spent equals budget to the cent).
--
-- 2. validate_no_overspending computed amount left as
--    `budget_amount - spent - NEW.amount`, ignoring `transfers` entirely, while
--    `budget_summary.amount_left` adds transfers in. The two could never agree
--    once a budget had been topped up by a transfer: the UI would permit the
--    expense and this trigger would then reject it. Dropping the trigger leaves
--    `budget_summary` as the single definition of "left", which is the correct
--    one.
--
-- 3. Expense dates are policed against the month reached via budget_id, but the
--    household's real cycle does not line up with calendar months (salaries land
--    ~27th and ~7th; rent is paid on the 27th for the following month). A month
--    is now the bucket a row is assigned to, not a range that rejects it. The
--    ~40 existing out-of-range expenses become valid rather than latent errors.
--
-- Retains `expenses_amount_positive` and the goal-balance triggers untouched.
-- ============================================

DROP TRIGGER IF EXISTS validate_no_overspending_trigger ON expenses;
DROP FUNCTION IF EXISTS validate_no_overspending();

DROP TRIGGER IF EXISTS validate_expense_date_trigger ON expenses;
DROP FUNCTION IF EXISTS validate_expense_date();

-- Verification: both should return zero rows.
--
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'expenses'::regclass AND NOT tgisinternal;
--
--   SELECT proname FROM pg_proc
--   WHERE proname IN ('validate_no_overspending', 'validate_expense_date');
