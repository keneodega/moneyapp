-- Add base_amount column to financial_goals table
-- This tracks the initial/manual amount set when creating/editing the goal
-- The total current_amount = base_amount + sum of linked expenses

DO $$
BEGIN
  -- Add base_amount column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_goals' AND column_name = 'base_amount'
  ) THEN
    ALTER TABLE financial_goals ADD COLUMN base_amount DECIMAL(12, 2) DEFAULT 0;
    
    -- Initialize base_amount for existing goals
    -- For existing goals, base_amount = current_amount - sum of linked expenses
    UPDATE financial_goals
    SET base_amount = GREATEST(0, current_amount - COALESCE((
      SELECT SUM(amount)
      FROM expenses
      WHERE expenses.financial_goal_id = financial_goals.id
    ), 0));
    
    COMMENT ON COLUMN financial_goals.base_amount IS 'Base/initial amount set manually (not from linked expenses). Total current_amount = base_amount + sum of linked expenses.';
  END IF;
END $$;
