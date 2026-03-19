-- Migration: Add is_essential field to subscriptions
-- Allows users to categorize subscriptions as essential or non-essential

-- ============================================
-- Step 1: Add is_essential column
-- ============================================
DO $$
BEGIN
  -- Add is_essential column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'is_essential'
  ) THEN
    ALTER TABLE subscriptions 
    ADD COLUMN is_essential BOOLEAN DEFAULT true NOT NULL;
    
    COMMENT ON COLUMN subscriptions.is_essential IS 'Whether this subscription is essential (true) or non-essential (false)';
  END IF;
END $$;

-- ============================================
-- Step 2: Create index for filtering
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_essential 
  ON subscriptions(user_id, is_essential) 
  WHERE status = 'Active';

COMMENT ON INDEX idx_subscriptions_is_essential IS 'Index for filtering active subscriptions by essential status';
