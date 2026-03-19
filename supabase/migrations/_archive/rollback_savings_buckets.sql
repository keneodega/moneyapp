-- Rollback: Remove Savings Buckets Feature
-- This migration removes all savings buckets tables, triggers, and policies

-- ============================================
-- DROP TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_bucket_on_transaction ON savings_transactions;
DROP TRIGGER IF EXISTS update_savings_buckets_updated_at ON savings_buckets;

-- ============================================
-- DROP FUNCTIONS
-- ============================================
DROP FUNCTION IF EXISTS update_savings_bucket_amount() CASCADE;

-- ============================================
-- DROP POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own savings buckets" ON savings_buckets;
DROP POLICY IF EXISTS "Users can insert own savings buckets" ON savings_buckets;
DROP POLICY IF EXISTS "Users can update own savings buckets" ON savings_buckets;
DROP POLICY IF EXISTS "Users can delete own savings buckets" ON savings_buckets;

DROP POLICY IF EXISTS "Users can view own savings transactions" ON savings_transactions;
DROP POLICY IF EXISTS "Users can insert own savings transactions" ON savings_transactions;
DROP POLICY IF EXISTS "Users can update own savings transactions" ON savings_transactions;
DROP POLICY IF EXISTS "Users can delete own savings transactions" ON savings_transactions;

-- ============================================
-- DROP TABLES (CASCADE will drop dependent objects)
-- ============================================
DROP TABLE IF EXISTS savings_transactions CASCADE;
DROP TABLE IF EXISTS savings_buckets CASCADE;

-- ============================================
-- DROP INDEXES (if they exist separately)
-- ============================================
DROP INDEX IF EXISTS idx_savings_buckets_user_id;
DROP INDEX IF EXISTS idx_savings_buckets_goal_id;
DROP INDEX IF EXISTS idx_savings_transactions_bucket_id;
DROP INDEX IF EXISTS idx_savings_transactions_date;
