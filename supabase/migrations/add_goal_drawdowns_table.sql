-- Migration: Add Goal Drawdowns Table
-- Creates a dedicated table for tracking goal drawdowns (withdrawals) separate from contributions

-- ============================================
-- Step 1: Create goal_drawdowns table
-- ============================================
CREATE TABLE IF NOT EXISTS goal_drawdowns (
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
  
  CONSTRAINT goal_drawdowns_amount_positive CHECK (amount > 0)
);

-- ============================================
-- Step 2: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_goal_drawdowns_goal_id ON goal_drawdowns(financial_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_drawdowns_user_id ON goal_drawdowns(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_drawdowns_monthly_overview ON goal_drawdowns(monthly_overview_id);
CREATE INDEX IF NOT EXISTS idx_goal_drawdowns_date ON goal_drawdowns(date);

-- ============================================
-- Step 3: Create function to update goal current_amount from drawdowns
-- This function calculates: current_amount = base_amount + sum(contributions) - sum(drawdowns)
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_amount_from_drawdowns()
RETURNS TRIGGER AS $$
DECLARE
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_total_drawdowns DECIMAL(12, 2);
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
  
  -- Calculate total drawdowns for this goal
  SELECT COALESCE(SUM(amount), 0) INTO v_total_drawdowns
  FROM goal_drawdowns
  WHERE financial_goal_id = COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);
  
  -- New current_amount = base_amount + total contributions - total drawdowns
  v_new_current_amount := v_base_amount + v_total_contributions - v_total_drawdowns;
  
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
DROP TRIGGER IF EXISTS update_goal_on_drawdown_insert ON goal_drawdowns;
CREATE TRIGGER update_goal_on_drawdown_insert
  AFTER INSERT ON goal_drawdowns
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_amount_from_drawdowns();

DROP TRIGGER IF EXISTS update_goal_on_drawdown_update ON goal_drawdowns;
CREATE TRIGGER update_goal_on_drawdown_update
  AFTER UPDATE ON goal_drawdowns
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.financial_goal_id IS DISTINCT FROM NEW.financial_goal_id)
  EXECUTE FUNCTION update_goal_amount_from_drawdowns();

DROP TRIGGER IF EXISTS update_goal_on_drawdown_delete ON goal_drawdowns;
CREATE TRIGGER update_goal_on_drawdown_delete
  AFTER DELETE ON goal_drawdowns
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_amount_from_drawdowns();

-- ============================================
-- Step 5: Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_drawdowns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_goal_drawdowns_updated_at_trigger ON goal_drawdowns;
CREATE TRIGGER update_goal_drawdowns_updated_at_trigger
  BEFORE UPDATE ON goal_drawdowns
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_drawdowns_updated_at();

-- ============================================
-- Step 6: Add RLS policies
-- ============================================
ALTER TABLE goal_drawdowns ENABLE ROW LEVEL SECURITY;

-- Users can only see their own drawdowns
CREATE POLICY "Users can view their own goal drawdowns"
  ON goal_drawdowns FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own drawdowns
CREATE POLICY "Users can insert their own goal drawdowns"
  ON goal_drawdowns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own drawdowns
CREATE POLICY "Users can update their own goal drawdowns"
  ON goal_drawdowns FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own drawdowns
CREATE POLICY "Users can delete their own goal drawdowns"
  ON goal_drawdowns FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Step 7: Add comments
-- ============================================
COMMENT ON TABLE goal_drawdowns IS 'Tracks drawdowns (withdrawals) from financial goals, separate from contributions';
COMMENT ON COLUMN goal_drawdowns.monthly_overview_id IS 'The month when this drawdown was made';
COMMENT ON COLUMN goal_drawdowns.amount IS 'Amount withdrawn from the goal';
