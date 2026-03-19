-- Migration: Change subscription_type column from enum to TEXT
-- This allows dynamic values from Settings instead of hardcoded enum values
-- Run this in Supabase SQL Editor
-- This migration is idempotent - safe to run multiple times

-- ============================================
-- Change subscription_type column from enum to TEXT
-- ============================================

DO $$
BEGIN
  -- Check if subscriptions.subscription_type is already TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    AND column_name = 'subscription_type' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'subscriptions.subscription_type is already TEXT, skipping';
  ELSE
    ALTER TABLE subscriptions 
      ALTER COLUMN subscription_type TYPE TEXT USING subscription_type::TEXT;
    RAISE NOTICE 'Updated subscriptions.subscription_type to TEXT';
  END IF;
END $$;

-- ============================================
-- Note: We keep the enum type in case it's referenced elsewhere
-- It won't cause issues since we're using TEXT now
-- ============================================
