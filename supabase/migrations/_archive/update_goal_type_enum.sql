-- Migration: Update goal_type enum to match new UI values
-- Changes from: Emergency Fund, Vacation, Home, etc.
-- Changes to: Short Term, Medium Term, Long Term
-- This migration is idempotent - safe to run multiple times

DO $$
BEGIN
  -- Check if enum already has the new values
  IF EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'goal_type' 
    AND e.enumlabel = 'Medium Term'
  ) THEN
    RAISE NOTICE 'goal_type enum already updated, skipping migration';
    RETURN;
  END IF;

  -- Step 1: Create new enum with new values (if it doesn't exist)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_type_new') THEN
    CREATE TYPE goal_type_new AS ENUM (
      'Short Term',
      'Medium Term',
      'Long Term'
    );
  END IF;

  -- Step 2: Alter the column to use the new enum (with conversion)
  ALTER TABLE financial_goals 
    ALTER COLUMN goal_type TYPE goal_type_new 
    USING CASE 
      WHEN goal_type::text IN ('Emergency Fund', 'Vacation', 'Home', 'Car', 'Education', 'Wedding', 'Retirement', 'Investment', 'Other') 
      THEN 'Short Term'::goal_type_new  -- Default existing values to Short Term
      WHEN goal_type::text IN ('Short Term', 'Medium Term', 'Long Term')
      THEN goal_type::text::goal_type_new
      ELSE 'Short Term'::goal_type_new  -- Fallback for any unexpected values
    END;

  -- Step 3: Drop old enum and rename new one
  DROP TYPE IF EXISTS goal_type;
  ALTER TYPE goal_type_new RENAME TO goal_type;

  RAISE NOTICE 'goal_type enum successfully updated to: Short Term, Medium Term, Long Term';
END $$;

-- The new values are: 'Short Term', 'Medium Term', 'Long Term'
