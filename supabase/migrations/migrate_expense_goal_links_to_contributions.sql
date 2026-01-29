-- Migration: Migrate Expense-Goal Links to Goal Contributions
-- Moves existing expenses linked to goals into the new goal_contributions table

-- ============================================
-- Step 1: Migrate existing expense-goal links to goal_contributions
-- ============================================
INSERT INTO goal_contributions (
  financial_goal_id,
  user_id,
  monthly_overview_id,
  amount,
  date,
  description,
  bank,
  notes,
  created_at,
  updated_at
)
SELECT 
  e.financial_goal_id,
  e.user_id,
  b.monthly_overview_id,
  e.amount,
  e.date,
  e.description,
  e.bank::bank_type as bank, -- Explicit cast to bank_type enum
  NULL as notes, -- Expenses don't have notes, but we preserve description
  e.created_at,
  e.updated_at
FROM expenses e
INNER JOIN budgets b ON b.id = e.budget_id
WHERE e.financial_goal_id IS NOT NULL;

-- ============================================
-- Step 2: Recalculate all goals' current_amount based on contributions
-- ============================================
-- This ensures goals reflect the new contribution-based system
DO $$
DECLARE
  goal_record RECORD;
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  FOR goal_record IN SELECT id FROM financial_goals LOOP
    -- Get base_amount (or default to 0)
    SELECT COALESCE(base_amount, 0) INTO v_base_amount
    FROM financial_goals
    WHERE id = goal_record.id;
    
    -- Calculate total contributions
    SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
    FROM goal_contributions
    WHERE financial_goal_id = goal_record.id;
    
    -- Calculate new current_amount
    v_new_current_amount := v_base_amount + v_total_contributions;
    
    -- Update the goal
    UPDATE financial_goals
    SET 
      current_amount = v_new_current_amount,
      updated_at = NOW()
    WHERE id = goal_record.id;
  END LOOP;
END $$;

-- ============================================
-- Step 3: Remove financial_goal_id from expenses
-- ============================================
-- Set all financial_goal_id to NULL (we keep the column for backward compatibility)
UPDATE expenses
SET financial_goal_id = NULL
WHERE financial_goal_id IS NOT NULL;

-- ============================================
-- Step 4: Add comment
-- ============================================
COMMENT ON COLUMN expenses.financial_goal_id IS 'DEPRECATED: Goal linking has been moved to goal_contributions table. This column is kept for backward compatibility but should not be used.';
