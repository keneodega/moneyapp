-- Migration: Change bank and person columns from enums to TEXT
-- This allows dynamic values from Settings instead of hardcoded enum values
-- Run this in Supabase SQL Editor

-- ============================================
-- Change bank columns from bank_type enum to TEXT
-- ============================================

-- Expenses table
ALTER TABLE expenses 
  ALTER COLUMN bank TYPE TEXT USING bank::TEXT;

-- Income sources table  
ALTER TABLE income_sources 
  ALTER COLUMN bank TYPE TEXT USING bank::TEXT;

-- Subscriptions table
ALTER TABLE subscriptions 
  ALTER COLUMN bank TYPE TEXT USING bank::TEXT;

-- ============================================
-- Change person columns from person_type enum to TEXT
-- ============================================

-- Income sources table
ALTER TABLE income_sources 
  ALTER COLUMN person TYPE TEXT USING person::TEXT;

-- Subscriptions table
ALTER TABLE subscriptions 
  ALTER COLUMN person TYPE TEXT USING person::TEXT;

-- Financial goals table (if it has person column)
-- Check if column exists first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_goals' AND column_name = 'person'
  ) THEN
    ALTER TABLE financial_goals 
      ALTER COLUMN person TYPE TEXT USING person::TEXT;
  END IF;
END $$;

-- Financial sub-goals table (if it has person column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_sub_goals' AND column_name = 'responsible_person'
  ) THEN
    ALTER TABLE financial_sub_goals 
      ALTER COLUMN responsible_person TYPE TEXT USING responsible_person::TEXT;
  END IF;
END $$;

-- ============================================
-- Note: We keep the enum types in case they're referenced elsewhere
-- They won't cause issues since we're using TEXT now
-- ============================================
