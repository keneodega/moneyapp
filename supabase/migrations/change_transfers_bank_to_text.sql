-- Migration: Change remaining bank columns from bank_type ENUM to TEXT
-- The original change_bank_person_to_text.sql missed these tables:
--   transfers, goal_contributions, goal_drawdowns, loans
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers'
    AND column_name = 'bank'
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'transfers.bank is already TEXT, skipping';
  ELSE
    ALTER TABLE transfers
      ALTER COLUMN bank TYPE TEXT USING bank::TEXT;
    RAISE NOTICE 'Updated transfers.bank to TEXT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goal_contributions'
    AND column_name = 'bank'
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'goal_contributions.bank is already TEXT, skipping';
  ELSE
    ALTER TABLE goal_contributions
      ALTER COLUMN bank TYPE TEXT USING bank::TEXT;
    RAISE NOTICE 'Updated goal_contributions.bank to TEXT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goal_drawdowns'
    AND column_name = 'bank'
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'goal_drawdowns.bank is already TEXT, skipping';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goal_drawdowns'
    AND column_name = 'bank'
  ) THEN
    ALTER TABLE goal_drawdowns
      ALTER COLUMN bank TYPE TEXT USING bank::TEXT;
    RAISE NOTICE 'Updated goal_drawdowns.bank to TEXT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loans'
    AND column_name = 'bank'
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'loans.bank is already TEXT, skipping';
  ELSE
    ALTER TABLE loans
      ALTER COLUMN bank TYPE TEXT USING bank::TEXT;
    RAISE NOTICE 'Updated loans.bank to TEXT';
  END IF;
END $$;
