-- Migration: Update goal_type enum to match new UI values
-- Changes from: Emergency Fund, Vacation, Home, etc.
-- Changes to: Short Term, Medium Term, Long Term

-- Step 1: Create new enum with new values
CREATE TYPE goal_type_new AS ENUM (
  'Short Term',
  'Medium Term',
  'Long Term'
);

-- Step 2: Alter the column to use the new enum (with conversion)
ALTER TABLE financial_goals 
  ALTER COLUMN goal_type TYPE goal_type_new 
  USING CASE 
    WHEN goal_type::text IN ('Emergency Fund', 'Vacation', 'Home', 'Car', 'Education', 'Wedding', 'Retirement', 'Investment', 'Other') 
    THEN 'Short Term'::goal_type_new  -- Default existing values to Short Term
    ELSE goal_type::text::goal_type_new
  END;

-- Step 3: Drop old enum and rename new one
DROP TYPE goal_type;
ALTER TYPE goal_type_new RENAME TO goal_type;

-- Step 4: Update the enum in TypeScript types file will be done separately
-- The new values are: 'Short Term', 'Medium Term', 'Long Term'
