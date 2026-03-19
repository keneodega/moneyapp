-- Migration: Add Transfers Table
-- Unified table for budget-to-budget transfers, goal-to-budget transfers, and goal drawdowns (draw down and use).

-- ============================================
-- Step 1: Create transfer_type enum
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_type') THEN
    CREATE TYPE transfer_type AS ENUM ('budget_to_budget', 'goal_to_budget', 'goal_drawdown');
  END IF;
END
$$;

-- ============================================
-- Step 2: Create transfers table
-- ============================================
CREATE TABLE IF NOT EXISTS transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  transfer_type transfer_type NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  notes TEXT,
  bank bank_type,
  from_budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  to_budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  from_goal_id UUID REFERENCES financial_goals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT transfers_amount_positive CHECK (amount > 0),
  CONSTRAINT transfers_budget_to_budget CHECK (
    (transfer_type = 'budget_to_budget') = (from_budget_id IS NOT NULL AND to_budget_id IS NOT NULL AND from_goal_id IS NULL)
  ),
  CONSTRAINT transfers_goal_to_budget CHECK (
    (transfer_type = 'goal_to_budget') = (from_goal_id IS NOT NULL AND to_budget_id IS NOT NULL AND from_budget_id IS NULL)
  ),
  CONSTRAINT transfers_goal_drawdown CHECK (
    (transfer_type = 'goal_drawdown') = (from_goal_id IS NOT NULL AND from_budget_id IS NULL)
  )
);

-- ============================================
-- Step 3: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_monthly_overview_id ON transfers(monthly_overview_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date);
CREATE INDEX IF NOT EXISTS idx_transfers_from_budget_id ON transfers(from_budget_id) WHERE from_budget_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_to_budget_id ON transfers(to_budget_id) WHERE to_budget_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_from_goal_id ON transfers(from_goal_id) WHERE from_goal_id IS NOT NULL;

-- ============================================
-- Step 4: Function to update goal current_amount when transfer involves from_goal_id
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_amount_from_transfers()
RETURNS TRIGGER AS $$
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
  FROM financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_drawdowns_legacy
  FROM goal_drawdowns WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount + v_total_contributions - v_total_drawdowns_legacy - v_total_transfers_out;

  UPDATE financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 5: Triggers on transfers for goal balance
-- ============================================
DROP TRIGGER IF EXISTS update_goal_on_transfer_insert ON transfers;
CREATE TRIGGER update_goal_on_transfer_insert
  AFTER INSERT ON transfers
  FOR EACH ROW
  WHEN (NEW.from_goal_id IS NOT NULL)
  EXECUTE FUNCTION update_goal_amount_from_transfers();

DROP TRIGGER IF EXISTS update_goal_on_transfer_update ON transfers;
CREATE TRIGGER update_goal_on_transfer_update
  AFTER UPDATE ON transfers
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.from_goal_id IS DISTINCT FROM NEW.from_goal_id)
  EXECUTE FUNCTION update_goal_amount_from_transfers();

DROP TRIGGER IF EXISTS update_goal_on_transfer_delete ON transfers;
CREATE TRIGGER update_goal_on_transfer_delete
  AFTER DELETE ON transfers
  FOR EACH ROW
  WHEN (OLD.from_goal_id IS NOT NULL)
  EXECUTE FUNCTION update_goal_amount_from_transfers();

-- ============================================
-- Step 6: updated_at trigger for transfers
-- ============================================
CREATE OR REPLACE FUNCTION update_transfers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_transfers_updated_at_trigger ON transfers;
CREATE TRIGGER update_transfers_updated_at_trigger
  BEFORE UPDATE ON transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_transfers_updated_at();

-- ============================================
-- Step 7: RLS
-- ============================================
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transfers"
  ON transfers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transfers"
  ON transfers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transfers"
  ON transfers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transfers"
  ON transfers FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Step 8: Comments
-- ============================================
COMMENT ON TABLE transfers IS 'Unified transfers: budget-to-budget, goal-to-budget, and goal drawdown (draw down and use)';
COMMENT ON COLUMN transfers.transfer_type IS 'budget_to_budget, goal_to_budget, or goal_drawdown';
COMMENT ON COLUMN transfers.from_goal_id IS 'Set when source is a goal (goal_to_budget or goal_drawdown)';
COMMENT ON COLUMN transfers.to_budget_id IS 'Destination budget; for goal_drawdown app sets DrawDown budget';
