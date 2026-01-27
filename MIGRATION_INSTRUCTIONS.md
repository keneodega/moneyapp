# Database Migration Required

## Error: `base_amount` column missing

You're seeing this error because the `base_amount` column hasn't been added to the `financial_goals` table yet.

## How to Fix

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**

### Step 2: Run the Migration
Copy and paste the following SQL into the SQL Editor and click **Run**:

```sql
-- Add base_amount column to financial_goals table
-- This tracks the initial/manual amount set when creating/editing the goal
-- The total current_amount = base_amount + sum of linked expenses

DO $$
BEGIN
  -- Add base_amount column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_goals' AND column_name = 'base_amount'
  ) THEN
    ALTER TABLE financial_goals ADD COLUMN base_amount DECIMAL(12, 2) DEFAULT 0;
    
    -- Initialize base_amount for existing goals
    -- For existing goals, base_amount = current_amount - sum of linked expenses
    UPDATE financial_goals
    SET base_amount = GREATEST(0, current_amount - COALESCE((
      SELECT SUM(amount)
      FROM expenses
      WHERE expenses.financial_goal_id = financial_goals.id
    ), 0));
    
    COMMENT ON COLUMN financial_goals.base_amount IS 'Base/initial amount set manually (not from linked expenses). Total current_amount = base_amount + sum of linked expenses.';
  END IF;
END $$;
```

### Step 3: Verify
After running the migration, try creating a goal again. The error should be resolved.

## What This Migration Does

- Adds a `base_amount` column to track the initial amount set when creating/editing goals
- Initializes `base_amount` for existing goals based on their current amount minus linked expenses
- Enables the goal system to properly track: `current_amount = base_amount + sum(linked_expenses)`

## File Location

The migration file is located at:
`supabase/migrations/add_goal_base_amount.sql`
