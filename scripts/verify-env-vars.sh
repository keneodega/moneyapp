#!/bin/bash

# Environment Variable Verification Script
# 
# This script helps verify that all required environment variables are set
# for production deployment.
#
# Usage:
#   chmod +x scripts/verify-env-vars.sh
#   ./scripts/verify-env-vars.sh

set -e

echo "🔐 Environment Variable Verification"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Required environment variables
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "NEXT_PUBLIC_APP_ENV"
)

# Optional but recommended
OPTIONAL_VARS=(
  "NEXT_PUBLIC_SENTRY_DSN"
  "SENTRY_ORG"
  "SENTRY_PROJECT"
)

echo "📋 Required Variables"
echo "--------------------"
echo ""

MISSING_REQUIRED=0
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${RED}❌ $var${NC} - NOT SET"
    MISSING_REQUIRED=1
  else
    # Mask sensitive values
    if [[ "$var" == *"KEY"* ]] || [[ "$var" == *"DSN"* ]]; then
      VALUE="${!var:0:20}..."
    else
      VALUE="${!var}"
    fi
    echo -e "${GREEN}✅ $var${NC} - $VALUE"
  fi
done

echo ""
echo "📋 Optional Variables (Recommended)"
echo "-----------------------------------"
echo ""

for var in "${OPTIONAL_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${YELLOW}⚠️  $var${NC} - NOT SET (optional)"
  else
    # Mask sensitive values
    if [[ "$var" == *"KEY"* ]] || [[ "$var" == *"DSN"* ]]; then
      VALUE="${!var:0:20}..."
    else
      VALUE="${!var}"
    fi
    echo -e "${GREEN}✅ $var${NC} - $VALUE"
  fi
done

echo ""
echo "🌐 Vercel Environment Variables"
echo "-------------------------------"
echo ""
echo "⚠️  Manual Verification Required"
echo ""
echo "1. Go to: https://vercel.com/dashboard"
echo "2. Select your project"
echo "3. Go to: Settings → Environment Variables"
echo ""
echo "Verify the following:"
echo ""

echo "📦 Production Environment:"
echo "  □ NEXT_PUBLIC_SUPABASE_URL (Production Supabase URL)"
echo "  □ NEXT_PUBLIC_SUPABASE_ANON_KEY (Production anon key)"
echo "  □ NEXT_PUBLIC_APP_ENV = 'production'"
echo "  □ NEXT_PUBLIC_SENTRY_DSN (if using Sentry)"
echo "  □ SENTRY_ORG (if using Sentry)"
echo "  □ SENTRY_PROJECT (if using Sentry)"
echo ""

echo "🔍 Preview Environment:"
echo "  □ NEXT_PUBLIC_SUPABASE_URL (Staging Supabase URL)"
echo "  □ NEXT_PUBLIC_SUPABASE_ANON_KEY (Staging anon key)"
echo "  □ NEXT_PUBLIC_APP_ENV = 'preview'"
echo "  □ NEXT_PUBLIC_SENTRY_DSN (if using Sentry)"
echo "  □ SENTRY_ORG (if using Sentry)"
echo "  □ SENTRY_PROJECT (if using Sentry)"
echo ""

echo "⚠️  Important Checks:"
echo "  □ Production and Preview use DIFFERENT Supabase projects"
echo "  □ Production Supabase URL contains 'production' or is clearly production"
echo "  □ Staging Supabase URL contains 'staging' or 'preview'"
echo "  □ No service role keys in environment variables"
echo ""

if [ $MISSING_REQUIRED -eq 1 ]; then
  echo -e "${RED}❌ Missing required environment variables${NC}"
  echo ""
  echo "Set missing variables:"
  echo "  export NEXT_PUBLIC_SUPABASE_URL=..."
  echo "  export NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
  echo "  export NEXT_PUBLIC_APP_ENV=production"
  exit 1
else
  echo -e "${GREEN}✅ All required environment variables are set${NC}"
  echo ""
  echo "💡 Tip: Use Vercel CLI to pull env vars: vercel env pull .env.local"
  exit 0
fi
