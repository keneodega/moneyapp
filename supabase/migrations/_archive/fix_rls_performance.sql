-- Fix RLS Performance: Wrap auth.uid() in (select ...) for better performance
-- Run this in Supabase SQL Editor to fix the linter warnings
-- This prevents auth.uid() from being re-evaluated for every row

-- ============================================
-- MONTHLY OVERVIEWS
-- ============================================
DROP POLICY IF EXISTS "Users can view own monthly overviews" ON monthly_overviews;
DROP POLICY IF EXISTS "Users can insert own monthly overviews" ON monthly_overviews;
DROP POLICY IF EXISTS "Users can update own monthly overviews" ON monthly_overviews;
DROP POLICY IF EXISTS "Users can delete own monthly overviews" ON monthly_overviews;

CREATE POLICY "Users can view own monthly overviews"
  ON monthly_overviews FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own monthly overviews"
  ON monthly_overviews FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own monthly overviews"
  ON monthly_overviews FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own monthly overviews"
  ON monthly_overviews FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- INCOME SOURCES
-- ============================================
DROP POLICY IF EXISTS "Users can view own income sources" ON income_sources;
DROP POLICY IF EXISTS "Users can insert own income sources" ON income_sources;
DROP POLICY IF EXISTS "Users can update own income sources" ON income_sources;
DROP POLICY IF EXISTS "Users can delete own income sources" ON income_sources;

CREATE POLICY "Users can view own income sources"
  ON income_sources FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own income sources"
  ON income_sources FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own income sources"
  ON income_sources FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own income sources"
  ON income_sources FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- BUDGETS
-- ============================================
DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- EXPENSES
-- ============================================
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;

CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- FINANCIAL GOALS
-- ============================================
DROP POLICY IF EXISTS "Users can view own financial goals" ON financial_goals;
DROP POLICY IF EXISTS "Users can insert own financial goals" ON financial_goals;
DROP POLICY IF EXISTS "Users can update own financial goals" ON financial_goals;
DROP POLICY IF EXISTS "Users can delete own financial goals" ON financial_goals;

CREATE POLICY "Users can view own financial goals"
  ON financial_goals FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own financial goals"
  ON financial_goals FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own financial goals"
  ON financial_goals FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own financial goals"
  ON financial_goals FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- FINANCIAL SUB GOALS
-- ============================================
DROP POLICY IF EXISTS "Users can view own sub goals" ON financial_sub_goals;
DROP POLICY IF EXISTS "Users can insert own sub goals" ON financial_sub_goals;
DROP POLICY IF EXISTS "Users can update own sub goals" ON financial_sub_goals;
DROP POLICY IF EXISTS "Users can delete own sub goals" ON financial_sub_goals;

CREATE POLICY "Users can view own sub goals"
  ON financial_sub_goals FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own sub goals"
  ON financial_sub_goals FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own sub goals"
  ON financial_sub_goals FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own sub goals"
  ON financial_sub_goals FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON subscriptions;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own subscriptions"
  ON subscriptions FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- INVESTMENT HOLDINGS
-- ============================================
DROP POLICY IF EXISTS "Users can view own holdings" ON investment_holdings;
DROP POLICY IF EXISTS "Users can insert own holdings" ON investment_holdings;
DROP POLICY IF EXISTS "Users can update own holdings" ON investment_holdings;
DROP POLICY IF EXISTS "Users can delete own holdings" ON investment_holdings;

CREATE POLICY "Users can view own holdings"
  ON investment_holdings FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own holdings"
  ON investment_holdings FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own holdings"
  ON investment_holdings FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own holdings"
  ON investment_holdings FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- INVESTMENT TRANSACTIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view own transactions" ON investment_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON investment_transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON investment_transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON investment_transactions;

CREATE POLICY "Users can view own transactions"
  ON investment_transactions FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own transactions"
  ON investment_transactions FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own transactions"
  ON investment_transactions FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own transactions"
  ON investment_transactions FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- APP SETTINGS (if exists)
-- ============================================
DROP POLICY IF EXISTS "Users can view their own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can create their own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can manage their own settings" ON app_settings;

CREATE POLICY "Users can view their own settings"
  ON app_settings FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create their own settings"
  ON app_settings FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own settings"
  ON app_settings FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own settings"
  ON app_settings FOR DELETE
  USING (user_id = (select auth.uid()));
