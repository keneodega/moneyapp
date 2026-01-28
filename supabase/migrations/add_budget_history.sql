-- Migration: Budget History (audit log)
-- Tracks every create, update, and delete on budgets so the UI can show history and trends.

-- ============================================
-- Step 1: Create budget_history table
-- ============================================
CREATE TABLE IF NOT EXISTS budget_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID,  -- NULL only when row is lost; for deletes we store OLD.id
  master_budget_id UUID REFERENCES master_budgets(id) ON DELETE SET NULL,  -- Track which master budget this belongs to
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE SET NULL,  -- Track which month this belongs to
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  old_data JSONB,  -- full row before change (null for created)
  new_data JSONB,  -- full row after change (null for deleted)
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_budget_history_user_changed
  ON budget_history(user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_history_budget_id
  ON budget_history(budget_id) WHERE budget_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_history_master_budget_id
  ON budget_history(master_budget_id) WHERE master_budget_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_history_monthly_overview_id
  ON budget_history(monthly_overview_id) WHERE monthly_overview_id IS NOT NULL;

COMMENT ON TABLE budget_history IS 'Audit log of all changes to budgets (create/update/delete) for tracking history and trends';

-- ============================================
-- Step 2: Trigger function to record history
-- ============================================
CREATE OR REPLACE FUNCTION record_budget_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user_id from the monthly_overview
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO v_user_id
    FROM monthly_overviews
    WHERE id = NEW.monthly_overview_id;
    
    INSERT INTO budget_history (budget_id, master_budget_id, monthly_overview_id, user_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.master_budget_id, NEW.monthly_overview_id, v_user_id, 'created', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT user_id INTO v_user_id
    FROM monthly_overviews
    WHERE id = NEW.monthly_overview_id;
    
    INSERT INTO budget_history (budget_id, master_budget_id, monthly_overview_id, user_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.master_budget_id, NEW.monthly_overview_id, v_user_id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT user_id INTO v_user_id
    FROM monthly_overviews
    WHERE id = OLD.monthly_overview_id;
    
    INSERT INTO budget_history (budget_id, master_budget_id, monthly_overview_id, user_id, action, old_data, new_data)
    VALUES (OLD.id, OLD.master_budget_id, OLD.monthly_overview_id, v_user_id, 'deleted', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================
-- Step 3: Triggers on budgets
-- ============================================
DROP TRIGGER IF EXISTS budget_history_insert ON budgets;
DROP TRIGGER IF EXISTS budget_history_update ON budgets;
DROP TRIGGER IF EXISTS budget_history_delete ON budgets;

CREATE TRIGGER budget_history_insert
  AFTER INSERT ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION record_budget_history();

CREATE TRIGGER budget_history_update
  AFTER UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION record_budget_history();

CREATE TRIGGER budget_history_delete
  AFTER DELETE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION record_budget_history();

-- ============================================
-- Step 4: RLS for budget_history
-- ============================================
ALTER TABLE budget_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own history
DROP POLICY IF EXISTS "Users can view their own budget history" ON budget_history;
CREATE POLICY "Users can view their own budget history"
  ON budget_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow insert only when user_id matches (used by trigger running as app user)
DROP POLICY IF EXISTS "Triggers can insert budget history" ON budget_history;
CREATE POLICY "Triggers can insert budget history"
  ON budget_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policies: history is append-only.
