-- Quick verification script to check if master_budget_id column exists
-- Run this in Supabase SQL Editor to verify the migration status

-- Check if master_budget_id column exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'budgets' 
  AND column_name IN ('master_budget_id', 'override_amount', 'override_reason')
ORDER BY column_name;

-- Check if master_budgets table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'master_budgets';

-- If the above queries return no rows, the migration hasn't been run yet.
-- Run: supabase/migrations/add_master_budgets.sql
