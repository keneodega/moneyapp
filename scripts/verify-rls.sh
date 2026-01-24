#!/bin/bash

# RLS Verification Script
# 
# This script helps verify that Row Level Security is properly configured
# on all tables in your Supabase database.
#
# Usage:
#   chmod +x scripts/verify-rls.sh
#   ./scripts/verify-rls.sh

set -e

echo "🔒 Row Level Security (RLS) Verification"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Tables that should have RLS enabled
TABLES=(
  "monthly_overviews"
  "budgets"
  "expenses"
  "income_sources"
  "financial_goals"
  "financial_sub_goals"
  "subscriptions"
  "investment_holdings"
  "investment_transactions"
)

echo "⚠️  Manual Verification Required"
echo "--------------------------------"
echo ""
echo "This script provides a checklist. You must verify in Supabase Dashboard:"
echo ""
echo "1. Go to: https://supabase.com/dashboard"
echo "2. Select your project"
echo "3. Go to: Database → Tables"
echo ""
echo "For each table, verify:"
echo ""

for table in "${TABLES[@]}"; do
  echo "  📋 $table"
  echo "     □ RLS is enabled (toggle in table settings)"
  echo "     □ SELECT policy exists (Users can view own data)"
  echo "     □ INSERT policy exists (Users can insert own data)"
  echo "     □ UPDATE policy exists (Users can update own data)"
  echo "     □ DELETE policy exists (Users can delete own data)"
  echo "     □ Policy uses auth.uid() = user_id (or equivalent)"
  echo ""
done

echo "📝 Policy Pattern Verification"
echo "-------------------------------"
echo ""
echo "All policies should follow this pattern:"
echo ""
echo "  Direct ownership tables:"
echo "    USING (auth.uid() = user_id)"
echo ""
echo "  Indirect ownership tables:"
echo "    Budgets: EXISTS (SELECT 1 FROM monthly_overviews ...)"
echo "    Sub-goals: EXISTS (SELECT 1 FROM financial_goals ...)"
echo ""

echo "🔍 SQL Verification Query"
echo "-------------------------"
echo ""
echo "Run this in Supabase SQL Editor to check RLS status:"
echo ""
echo "SELECT"
echo "  schemaname,"
echo "  tablename,"
echo "  CASE"
echo "    WHEN rowsecurity THEN '✅ Enabled'"
echo "    ELSE '❌ Disabled'"
echo "  END as rls_status"
echo "FROM pg_tables"
echo "WHERE schemaname = 'public'"
echo "  AND tablename IN ("
for i in "${!TABLES[@]}"; do
  if [ $i -eq $((${#TABLES[@]} - 1)) ]; then
    echo "    '${TABLES[$i]}'"
  else
    echo "    '${TABLES[$i]}',"
  fi
done
echo "  )"
echo "ORDER BY tablename;"
echo ""

echo "📋 Policy Count Verification"
echo "-----------------------------"
echo ""
echo "Run this to count policies per table:"
echo ""
echo "SELECT"
echo "  tablename,"
echo "  COUNT(*) as policy_count"
echo "FROM pg_policies"
echo "WHERE schemaname = 'public'"
echo "GROUP BY tablename"
echo "ORDER BY tablename;"
echo ""
echo "Expected: Each table should have 4 policies (SELECT, INSERT, UPDATE, DELETE)"
echo ""

echo -e "${GREEN}✅ Verification checklist complete${NC}"
echo ""
echo "💡 Tip: Test RLS by creating two test users and verifying isolation"
echo "💡 Tip: Use Supabase SQL Editor to run the verification queries above"
