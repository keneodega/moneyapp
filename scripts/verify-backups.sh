#!/bin/bash

# Backup Verification Script
# 
# This script helps verify that Supabase backups are running correctly.
# Run this weekly to ensure your backups are working.
#
# Usage:
#   chmod +x scripts/verify-backups.sh
#   ./scripts/verify-backups.sh

set -e

echo "🔍 Supabase Backup Verification"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase URL is set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}❌ Error: NEXT_PUBLIC_SUPABASE_URL not set${NC}"
    echo "   Set it in your .env.local or export it:"
    echo "   export NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co"
    exit 1
fi

PROJECT_URL="$NEXT_PUBLIC_SUPABASE_URL"
PROJECT_REF=$(echo "$PROJECT_URL" | sed 's|https://||' | sed 's|\.supabase\.co||')

echo "📋 Project: $PROJECT_REF"
echo "🌐 URL: $PROJECT_URL"
echo ""

echo "⚠️  Manual Verification Required"
echo "--------------------------------"
echo ""
echo "Supabase backups are managed via the dashboard."
echo "Please verify the following:"
echo ""
echo "1. ✅ Go to: https://supabase.com/dashboard/project/$PROJECT_REF/database/backups"
echo ""
echo "2. ✅ Check that backups are enabled:"
echo "   - Settings → Database → Backups → 'Enable daily backups' = ON"
echo ""
echo "3. ✅ Verify recent backups exist:"
echo "   - At least one backup from the last 24 hours"
echo "   - Backup status shows 'Success'"
echo ""
echo "4. ✅ Check backup retention:"
echo "   - Free tier: 7 days"
echo "   - Pro tier: 7-30 days (configurable)"
echo ""
echo "5. ✅ Verify backup size is reasonable:"
echo "   - Should be > 0 KB"
echo "   - Should match your database size"
echo ""

# Check if we can connect to the database
echo "🔌 Testing Database Connection..."
if command -v psql &> /dev/null; then
    echo "   psql is available, but connection requires service role key."
    echo "   Skipping direct database check (security)."
else
    echo "   psql not available, skipping connection test."
fi

echo ""
echo "📝 Backup Checklist"
echo "-------------------"
echo ""
echo "□ Backups enabled in Supabase dashboard"
echo "□ At least one backup from last 24 hours"
echo "□ Backup retention period configured"
echo "□ Last restore drill completed (date: __________)"
echo "□ Restore procedure documented"
echo ""

echo -e "${GREEN}✅ Verification script complete${NC}"
echo ""
echo "💡 Tip: Set a calendar reminder to run this weekly"
echo "💡 Tip: Perform a restore drill quarterly"
