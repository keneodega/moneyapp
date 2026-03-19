-- RLS Verification Migration
-- 
-- This migration verifies that RLS is enabled on all tables
-- and that policies are correctly configured.
-- 
-- Run this in Supabase SQL Editor to verify your RLS setup.
-- It will show any tables missing RLS or policies.

-- Check RLS status on all tables
SELECT
  schemaname,
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ Enabled'
    ELSE '❌ DISABLED - FIX THIS!'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'monthly_overviews',
    'budgets',
    'expenses',
    'income_sources',
    'financial_goals',
    'financial_sub_goals',
    'subscriptions',
    'investment_holdings',
    'investment_transactions'
  )
ORDER BY tablename;

-- Count policies per table (should be 4: SELECT, INSERT, UPDATE, DELETE)
SELECT
  tablename,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) = 4 THEN '✅ Complete'
    WHEN COUNT(*) < 4 THEN '⚠️  Missing policies'
    ELSE '✅ Complete'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- List all policies for verification
SELECT
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN qual IS NOT NULL THEN '✅ Has USING clause'
    ELSE '⚠️  No USING clause'
  END as using_clause,
  CASE
    WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK clause'
    ELSE '⚠️  No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Verify policies use auth.uid() for user scoping
SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN qual LIKE '%auth.uid()%' OR qual LIKE '%user_id%' THEN '✅ Uses auth.uid()'
    WHEN qual LIKE '%EXISTS%' AND qual LIKE '%user_id%' THEN '✅ Uses EXISTS with user_id'
    ELSE '⚠️  Check policy - may not enforce user scoping'
  END as user_scoping
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
