-- Migration: Update Goal Amount Trigger to Account for Drawdowns
-- Updates the contribution trigger function to also consider drawdowns when calculating goal current_amount

-- ============================================
-- Step 1: Update the contribution trigger function to account for drawdowns
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_amount_from_contributions()
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
