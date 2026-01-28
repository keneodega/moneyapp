-- Migration: Master Budget History (audit log)
-- Tracks every create, update, and delete on master_budgets so the UI can show history.

-- ============================================
-- Step 1: Create master_budget_history table
-- ============================================
CREATE TABLE IF NOT EXISTS master_budget_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  master_budget_id UUID,  -- NULL only when row is lost; for deletes we store OLD.id
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  old_data JSONB,  -- full row before change (null for created)
  new_data JSONB,  -- full row after change (null for deleted)
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_budget_history_user_changed
  ON master_budget_history(user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_budget_history_master_budget_id
  ON master_budget_history(master_budget_id) WHERE master_budget_id IS NOT NULL;

COMMENT ON TABLE master_budget_history IS 'Audit log of all changes to master budgets (create/update/delete)';

-- ============================================
-- Step 2: Trigger function to record history
-- ============================================
CREATE OR REPLACE FUNCTION record_master_budget_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO master_budget_history (master_budget_id, user_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.user_id, 'created', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO master_budget_history (master_budget_id, user_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.user_id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO master_budget_history (master_budget_id, user_id, action, old_data, new_data)
    VALUES (OLD.id, OLD.user_id, 'deleted', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================
-- Step 3: Triggers on master_budgets
-- ============================================
DROP TRIGGER IF EXISTS master_budget_history_insert ON master_budgets;
DROP TRIGGER IF EXISTS master_budget_history_update ON master_budgets;
DROP TRIGGER IF EXISTS master_budget_history_delete ON master_budgets;

CREATE TRIGGER master_budget_history_insert
  AFTER INSERT ON master_budgets
  FOR EACH ROW
  EXECUTE FUNCTION record_master_budget_history();

CREATE TRIGGER master_budget_history_update
  AFTER UPDATE ON master_budgets
  FOR EACH ROW
  EXECUTE FUNCTION record_master_budget_history();

CREATE TRIGGER master_budget_history_delete
  AFTER DELETE ON master_budgets
  FOR EACH ROW
  EXECUTE FUNCTION record_master_budget_history();

-- ============================================
-- Step 4: RLS for master_budget_history
-- ============================================
ALTER TABLE master_budget_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own history
DROP POLICY IF EXISTS "Users can view their own master budget history" ON master_budget_history;
CREATE POLICY "Users can view their own master budget history"
  ON master_budget_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow insert only when user_id matches (used by trigger running as app user)
DROP POLICY IF EXISTS "Triggers can insert master budget history" ON master_budget_history;
CREATE POLICY "Triggers can insert master budget history"
  ON master_budget_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policies: history is append-only.
