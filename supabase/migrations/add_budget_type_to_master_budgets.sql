-- Migration: Add Budget Type to Master Budgets
-- Adds Fixed/Variable classification to master budgets

-- ============================================
-- Step 1: Create budget_type enum
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_type') THEN
    CREATE TYPE budget_type AS ENUM ('Fixed', 'Variable');
  END IF;
END $$;

-- ============================================
-- Step 2: Add budget_type column to master_budgets
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'master_budgets' AND column_name = 'budget_type'
  ) THEN
    ALTER TABLE master_budgets 
    ADD COLUMN budget_type budget_type NOT NULL DEFAULT 'Fixed';
  END IF;
END $$;

-- ============================================
-- Step 3: Create index for filtering by type
-- ============================================
CREATE INDEX IF NOT EXISTS idx_master_budgets_user_type 
  ON master_budgets(user_id, budget_type);

-- ============================================
-- Step 4: Migrate existing data
-- ============================================
-- Set Tithe and Offering to Variable, all others to Fixed
UPDATE master_budgets
SET budget_type = 'Variable'
WHERE name IN ('Tithe', 'Offering')
  AND budget_type = 'Fixed';

-- ============================================
-- Step 5: Add comment
-- ============================================
COMMENT ON COLUMN master_budgets.budget_type IS 'Budget type: Fixed (rarely changes) or Variable (changes month-to-month like tithe/offering)';
