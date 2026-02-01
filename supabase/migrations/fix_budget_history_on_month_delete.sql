-- Fix: Allow deleting monthly overviews (single or bulk) when budget_history trigger runs.
-- 1. When a monthly_overview is deleted, cascade deletes budgets. The budget_history
--    AFTER DELETE trigger runs but monthly_overviews row is already gone, so we use auth.uid().
-- 2. In that context RLS can block the trigger's INSERT (auth.uid() may not match). So we
--    run the trigger as DEFINER and allow the function owner to insert into budget_history.

CREATE OR REPLACE FUNCTION record_budget_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_mo_id UUID;  -- monthly_overview_id to insert (NULL when month was cascade-deleted)
BEGIN
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

    -- When monthly_overview was cascade-deleted first, it no longer exists: use current user
    -- and insert NULL for monthly_overview_id to avoid FK violation; old_data still has the id.
    IF v_user_id IS NULL THEN
      v_user_id := auth.uid();
      v_mo_id := NULL;
    ELSE
      v_mo_id := OLD.monthly_overview_id;
    END IF;

    INSERT INTO budget_history (budget_id, master_budget_id, monthly_overview_id, user_id, action, old_data, new_data)
    VALUES (OLD.id, OLD.master_budget_id, v_mo_id, v_user_id, 'deleted', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Allow the trigger (running as function owner) to insert into budget_history.
-- Normal inserts still require auth.uid() = user_id; owner can insert for audit.
DROP POLICY IF EXISTS "Triggers can insert budget history" ON budget_history;
CREATE POLICY "Triggers can insert budget history"
  ON budget_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR current_user IN ('postgres', 'supabase_admin'));
