-- Migration: Change bank and person columns from enums to TEXT
-- This allows dynamic values from Settings instead of hardcoded enum values
-- Run this in Supabase SQL Editor
-- This migration is idempotent - safe to run multiple times

-- ============================================
-- Change bank columns from bank_type enum to TEXT
-- ============================================

DO $$
BEGIN
  -- Check if expenses.bank is already TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' 
    AND column_name = 'bank' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'expenses.bank is already TEXT, skipping';
  ELSE
    ALTER TABLE expenses 
      ALTER COLUMN bank TYPE TEXT USING bank::TEXT;
    RAISE NOTICE 'Updated expenses.bank to TEXT';
  END IF;
END $$;

DO $$
BEGIN
  -- Check if income_sources.bank is already TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'income_sources' 
    AND column_name = 'bank' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'income_sources.bank is already TEXT, skipping';
  ELSE
    ALTER TABLE income_sources 
      ALTER COLUMN bank TYPE TEXT USING bank::TEXT;
    RAISE NOTICE 'Updated income_sources.bank to TEXT';
  END IF;
END $$;

DO $$
BEGIN
  -- Check if subscriptions.bank is already TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    AND column_name = 'bank' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'subscriptions.bank is already TEXT, skipping';
  ELSE
    ALTER TABLE subscriptions 
      ALTER COLUMN bank TYPE TEXT USING bank::TEXT;
    RAISE NOTICE 'Updated subscriptions.bank to TEXT';
  END IF;
END $$;

-- ============================================
-- Change person columns from person_type enum to TEXT
-- ============================================

DO $$
BEGIN
  -- Check if income_sources.person is already TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'income_sources' 
    AND column_name = 'person' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'income_sources.person is already TEXT, skipping';
  ELSE
    ALTER TABLE income_sources 
      ALTER COLUMN person TYPE TEXT USING person::TEXT;
    RAISE NOTICE 'Updated income_sources.person to TEXT';
  END IF;
END $$;

DO $$
BEGIN
  -- Check if subscriptions.person is already TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    AND column_name = 'person' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'subscriptions.person is already TEXT, skipping';
  ELSE
    ALTER TABLE subscriptions 
      ALTER COLUMN person TYPE TEXT USING person::TEXT;
    RAISE NOTICE 'Updated subscriptions.person to TEXT';
  END IF;
END $$;

-- Financial goals table (if it has person column)
DO $$
BEGIN
  -- Check if financial_goals.person is already TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_goals' 
    AND column_name = 'person' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'financial_goals.person is already TEXT, skipping';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_goals' 
    AND column_name = 'person'
  ) THEN
    ALTER TABLE financial_goals 
      ALTER COLUMN person TYPE TEXT USING person::TEXT;
    RAISE NOTICE 'Updated financial_goals.person to TEXT';
  END IF;
END $$;

-- Financial sub-goals table (if it has person column)
DO $$
BEGIN
  -- Check if financial_sub_goals.responsible_person is already TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_sub_goals' 
    AND column_name = 'responsible_person' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'financial_sub_goals.responsible_person is already TEXT, skipping';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_sub_goals' 
    AND column_name = 'responsible_person'
  ) THEN
    ALTER TABLE financial_sub_goals 
      ALTER COLUMN responsible_person TYPE TEXT USING responsible_person::TEXT;
    RAISE NOTICE 'Updated financial_sub_goals.responsible_person to TEXT';
  END IF;
END $$;

-- ============================================
-- Note: We keep the enum types in case they're referenced elsewhere
-- They won't cause issues since we're using TEXT now
-- ============================================
