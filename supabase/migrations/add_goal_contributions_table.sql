-- Migration: Add Goal Contributions Table
-- Creates a dedicated table for tracking goal contributions separate from expenses

-- ============================================
-- Step 1: Create goal_contributions table
-- ============================================
CREATE TABLE IF NOT EXISTS goal_contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  financial_goal_id UUID REFERENCES financial_goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  bank bank_type,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT goal_contributions_amount_positive CHECK (amount > 0)
);

-- ============================================
-- Step 2: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id ON goal_contributions(financial_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_id ON goal_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_monthly_overview ON goal_contributions(monthly_overview_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_date ON goal_contributions(date);

-- ============================================
-- Step 3: Create function to update goal current_amount
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_amount_from_contributions()
RETURNS TRIGGER AS $$
DECLARE
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  -- Get base_amount from goal
  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM financial_goals
  WHERE id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  -- Calculate total contributions for this goal
  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM goal_contributions
  WHERE financial_goal_id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  -- New current_amount = base_amount + total contributions
  v_new_current_amount := v_base_amount + v_total_contributions;
  
  -- Update the goal's current_amount
  UPDATE financial_goals
  SET 
    current_amount = v_new_current_amount,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 4: Create triggers to update goal amount
-- ============================================
DROP TRIGGER IF EXISTS update_goal_on_contribution_insert ON goal_contributions;
CREATE TRIGGER update_goal_on_contribution_insert
  AFTER INSERT ON goal_contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_amount_from_contributions();

DROP TRIGGER IF EXISTS update_goal_on_contribution_update ON goal_contributions;
CREATE TRIGGER update_goal_on_contribution_update
  AFTER UPDATE ON goal_contributions
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.financial_goal_id IS DISTINCT FROM NEW.financial_goal_id)
  EXECUTE FUNCTION update_goal_amount_from_contributions();

DROP TRIGGER IF EXISTS update_goal_on_contribution_delete ON goal_contributions;
CREATE TRIGGER update_goal_on_contribution_delete
  AFTER DELETE ON goal_contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_amount_from_contributions();

-- ============================================
-- Step 5: Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_contributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_goal_contributions_updated_at_trigger ON goal_contributions;
CREATE TRIGGER update_goal_contributions_updated_at_trigger
  BEFORE UPDATE ON goal_contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_contributions_updated_at();

-- ============================================
-- Step 6: Add RLS policies
-- ============================================
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own contributions
CREATE POLICY "Users can view their own goal contributions"
  ON goal_contributions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own contributions
CREATE POLICY "Users can insert their own goal contributions"
  ON goal_contributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own contributions
CREATE POLICY "Users can update their own goal contributions"
  ON goal_contributions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own contributions
CREATE POLICY "Users can delete their own goal contributions"
  ON goal_contributions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Step 7: Add comments
-- ============================================
COMMENT ON TABLE goal_contributions IS 'Tracks contributions made to financial goals, separate from expenses';
COMMENT ON COLUMN goal_contributions.monthly_overview_id IS 'The month when this contribution was made';
COMMENT ON COLUMN goal_contributions.amount IS 'Amount contributed to the goal';
