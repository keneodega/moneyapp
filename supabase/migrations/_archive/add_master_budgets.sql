-- Migration: Add Master Budgets System
-- This creates a master budget table and modifies budgets to reference it
-- Master budgets are the baseline amounts that get copied to each new month

-- ============================================
-- Step 1: Create master_budgets table
-- ============================================
-- Drop table if it exists (for clean re-run)
DROP TABLE IF EXISTS master_budgets CASCADE;

CREATE TABLE master_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- Category name (e.g., "Food", "Housing")
  budget_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE, -- Allow soft deletion
  display_order INTEGER DEFAULT 0, -- For custom ordering
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one budget per category per user
  CONSTRAINT master_budgets_user_name_unique UNIQUE (user_id, name)
);

-- ============================================
-- Step 2: Add columns to budgets table for master budget tracking
-- ============================================
-- Note: We add columns first, then the foreign key constraint separately
-- to avoid issues if master_budgets table doesn't exist yet
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'master_budget_id') THEN
    ALTER TABLE budgets ADD COLUMN master_budget_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'override_amount') THEN
    ALTER TABLE budgets ADD COLUMN override_amount DECIMAL(12, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'override_reason') THEN
    ALTER TABLE budgets ADD COLUMN override_reason TEXT;
  END IF;
END $$;

-- Clean up any invalid master_budget_id references before adding constraint
UPDATE budgets
SET master_budget_id = NULL
WHERE master_budget_id IS NOT NULL
  AND master_budget_id NOT IN (SELECT id FROM master_budgets);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'budgets_master_budget_id_fkey'
  ) THEN
    ALTER TABLE budgets
      ADD CONSTRAINT budgets_master_budget_id_fkey 
      FOREIGN KEY (master_budget_id) REFERENCES master_budgets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add constraint: override_reason is required if override_amount is set
-- Drop constraint if it already exists
ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS budgets_override_reason_required;

ALTER TABLE budgets
  ADD CONSTRAINT budgets_override_reason_required 
  CHECK (
    (override_amount IS NULL AND override_reason IS NULL) OR
    (override_amount IS NOT NULL AND override_reason IS NOT NULL AND LENGTH(TRIM(override_reason)) > 0)
  );

-- ============================================
-- Step 3: Create index for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_master_budgets_user ON master_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_master_budgets_user_active ON master_budgets(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_budgets_master_budget ON budgets(master_budget_id);

-- ============================================
-- Step 4: Create function to get effective budget amount
-- ============================================
-- This function returns override_amount if set, otherwise master budget_amount
CREATE OR REPLACE FUNCTION get_effective_budget_amount(budget_row budgets)
RETURNS DECIMAL(12, 2) AS $$
BEGIN
  IF budget_row.override_amount IS NOT NULL THEN
    RETURN budget_row.override_amount;
  ELSIF budget_row.master_budget_id IS NOT NULL THEN
    RETURN (SELECT budget_amount FROM master_budgets WHERE id = budget_row.master_budget_id);
  ELSE
    RETURN budget_row.budget_amount;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Step 5: Create function to calculate deviation from master
-- ============================================
CREATE OR REPLACE FUNCTION get_budget_deviation(budget_row budgets)
RETURNS DECIMAL(12, 2) AS $$
DECLARE
  master_amount DECIMAL(12, 2);
  effective_amount DECIMAL(12, 2);
BEGIN
  IF budget_row.master_budget_id IS NULL THEN
    RETURN NULL; -- No master to compare against
  END IF;
  
  master_amount := (SELECT budget_amount FROM master_budgets WHERE id = budget_row.master_budget_id);
  effective_amount := COALESCE(budget_row.override_amount, master_amount);
  
  RETURN effective_amount - master_amount;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Step 6: Disable automatic budget creation
-- ============================================
-- Remove the trigger that automatically creates budgets
-- Users will now manually select which master budgets to include
DROP TRIGGER IF EXISTS create_default_budgets_trigger ON monthly_overviews;

-- Keep the function for backwards compatibility, but it won't be triggered automatically
-- Users can manually select budgets from master budgets
CREATE OR REPLACE FUNCTION create_default_budgets()
RETURNS TRIGGER AS $$
BEGIN
  -- This function is kept for backwards compatibility
  -- But budgets are now manually selected from master budgets
  -- No automatic creation happens
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================
-- Step 7: Create RLS policies for master_budgets
-- ============================================
ALTER TABLE master_budgets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own master budgets" ON master_budgets;
DROP POLICY IF EXISTS "Users can insert their own master budgets" ON master_budgets;
DROP POLICY IF EXISTS "Users can update their own master budgets" ON master_budgets;
DROP POLICY IF EXISTS "Users can delete their own master budgets" ON master_budgets;

-- Users can only see their own master budgets
CREATE POLICY "Users can view their own master budgets"
  ON master_budgets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own master budgets
CREATE POLICY "Users can insert their own master budgets"
  ON master_budgets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own master budgets
CREATE POLICY "Users can update their own master budgets"
  ON master_budgets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own master budgets
CREATE POLICY "Users can delete their own master budgets"
  ON master_budgets
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Step 8: Create trigger to update updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_master_budgets_updated_at ON master_budgets;

CREATE TRIGGER update_master_budgets_updated_at
  BEFORE UPDATE ON master_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Step 9: Insert default master budgets for existing users
-- ============================================
-- This migrates existing users to have master budgets
-- Uses the same default categories that were hardcoded before
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT DISTINCT user_id FROM monthly_overviews LOOP
    -- Insert default master budgets if they don't exist
    INSERT INTO master_budgets (user_id, name, budget_amount, description, display_order)
    VALUES 
      (user_record.user_id, 'Tithe', 350.00, '10% of all income - giving back to God', 1),
      (user_record.user_id, 'Offering', 175.00, '5% of main income - additional giving', 2),
      (user_record.user_id, 'Housing', 2228.00, 'Rent, Electricity', 3),
      (user_record.user_id, 'Food', 350.00, 'Groceries & Snacks', 4),
      (user_record.user_id, 'Transport', 200.00, 'Toll, Parking, Fuel', 5),
      (user_record.user_id, 'Personal Care', 480.00, 'Personal allowances, Nails', 6),
      (user_record.user_id, 'Household', 130.00, 'Household items, Cleaning', 7),
      (user_record.user_id, 'Savings', 300.00, 'Monthly savings', 8),
      (user_record.user_id, 'Investments', 100.00, '401K, Stocks, Retirement contributions', 9),
      (user_record.user_id, 'Subscriptions', 75.00, 'Netflix, Spotify, and other recurring subscriptions', 10),
      (user_record.user_id, 'Health', 50.00, 'Medicine or health related', 11),
      (user_record.user_id, 'Travel', 50.00, 'Travel Allowance', 12),
      (user_record.user_id, 'Miscellaneous', 100.00, 'Unexpected expenses and other items', 13)
    ON CONFLICT (user_id, name) DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- Step 10: Link existing budgets to master budgets (optional migration)
-- ============================================
-- This attempts to link existing budgets to master budgets by name
-- Only links if name matches exactly and master budget exists
UPDATE budgets b
SET master_budget_id = mb.id
FROM master_budgets mb
WHERE mb.user_id = (SELECT user_id FROM monthly_overviews WHERE id = b.monthly_overview_id)
  AND mb.name = b.name
  AND b.master_budget_id IS NULL;

-- Add comment
COMMENT ON TABLE master_budgets IS 'Master budget categories that serve as baseline for monthly budgets';
COMMENT ON COLUMN budgets.master_budget_id IS 'Reference to master budget this monthly budget is based on';
COMMENT ON COLUMN budgets.override_amount IS 'Override amount for this specific month (if different from master)';
COMMENT ON COLUMN budgets.override_reason IS 'Reason for overriding master budget amount (required if override_amount is set)';
