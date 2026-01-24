#!/bin/bash

# Production Prerequisites Verification Script
# 
# This script helps verify that all production prerequisites are met.
#
# Usage:
#   chmod +x scripts/verify-prerequisites.sh
#   ./scripts/verify-prerequisites.sh

set -e

echo "🚀 Production Prerequisites Verification"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}A) Supabase Production Readiness${NC}"
echo "--------------------------------"
echo ""

echo "1️⃣  Row Level Security (RLS)"
echo "----------------------------"
echo ""
echo "⚠️  Manual verification required in Supabase Dashboard"
echo ""
echo "For each table, verify:"
echo "  □ RLS is enabled (toggle ON)"
echo "  □ 4 policies exist (SELECT, INSERT, UPDATE, DELETE)"
echo "  □ Policies use auth.uid() = user_id or equivalent"
echo ""
echo "Run SQL verification:"
echo "  - Go to Supabase SQL Editor"
echo "  - Run: supabase/migrations/002_verify_rls.sql"
echo ""
echo "Or run: ./scripts/verify-rls.sh"
echo ""

echo "2️⃣  Backups"
echo "-----------"
echo ""
echo "⚠️  Manual setup required in Supabase Dashboard"
echo ""
echo "For PRODUCTION Supabase project:"
echo "  1. Go to: Settings → Database → Backups"
echo "  2. Enable Daily Backups"
echo "  3. Set retention period (7-30 days)"
echo "  4. Enable PITR (optional but recommended)"
echo "  5. Wait 24 hours for first backup"
echo ""
echo "Verify backups:"
echo "  - Run: ./scripts/verify-backups.sh"
echo "  - Or check: Supabase Dashboard → Database → Backups"
echo ""

echo -e "${BLUE}B) Environment Setup${NC}"
echo "------------------------"
echo ""

echo "1️⃣  Supabase Projects"
echo "---------------------"
echo ""
echo "Required:"
echo "  □ Staging Supabase project created"
echo "  □ Production Supabase project created"
echo "  □ Schema applied to both projects"
echo "  □ RLS enabled on both projects"
echo ""

echo "2️⃣  Vercel Environment Variables"
echo "---------------------------------"
echo ""
echo "⚠️  Manual verification required in Vercel Dashboard"
echo ""
echo "Go to: Vercel Dashboard → Project → Settings → Environment Variables"
echo ""
echo "Preview Environment:"
echo "  □ NEXT_PUBLIC_SUPABASE_URL (staging project)"
echo "  □ NEXT_PUBLIC_SUPABASE_ANON_KEY (staging key)"
echo "  □ NEXT_PUBLIC_APP_ENV = 'preview'"
echo ""
echo "Production Environment:"
echo "  □ NEXT_PUBLIC_SUPABASE_URL (production project)"
echo "  □ NEXT_PUBLIC_SUPABASE_ANON_KEY (production key)"
echo "  □ NEXT_PUBLIC_APP_ENV = 'production'"
echo ""
echo "⚠️  CRITICAL: Preview and Production must use DIFFERENT Supabase projects!"
echo ""
echo "Verify:"
echo "  - Run: ./scripts/verify-env-vars.sh"
echo ""

echo -e "${BLUE}C) Git Repository Setup${NC}"
echo "-------------------------"
echo ""

echo "1️⃣  Git Repository"
echo "------------------"
echo ""

# Check if in a git repository
if [ -d .git ]; then
  echo -e "${GREEN}✅ Git repository detected${NC}"
  echo ""
  
  # Check for remote
  if git remote -v | grep -q .; then
    echo -e "${GREEN}✅ Git remote configured${NC}"
    echo ""
    echo "Remotes:"
    git remote -v | sed 's/^/  /'
    echo ""
  else
    echo -e "${YELLOW}⚠️  No Git remote configured${NC}"
    echo ""
    echo "To add remote:"
    echo "  git remote add origin https://github.com/yourusername/yourrepo.git"
    echo "  git push -u origin main"
    echo ""
  fi
  
  # Check for uncommitted changes
  if [ -z "$(git status --porcelain)" ]; then
    echo -e "${GREEN}✅ No uncommitted changes${NC}"
  else
    echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
    echo ""
    echo "Files with changes:"
    git status --short | sed 's/^/  /'
    echo ""
  fi
else
  echo -e "${RED}❌ Not in a Git repository${NC}"
  echo ""
  echo "To initialize:"
  echo "  git init"
  echo "  git add ."
  echo "  git commit -m 'Initial commit'"
  echo "  git remote add origin https://github.com/yourusername/yourrepo.git"
  echo "  git push -u origin main"
  echo ""
fi

echo "2️⃣  Vercel Git Integration"
echo "-------------------------"
echo ""
echo "⚠️  Manual verification required in Vercel Dashboard"
echo ""
echo "Go to: Vercel Dashboard → Project → Settings → Git"
echo ""
echo "Verify:"
echo "  □ Repository is connected"
echo "  □ Branch is set (usually 'main')"
echo "  □ Automatic deployments enabled"
echo "  □ Preview deployments enabled"
echo ""

echo "📋 Complete Checklist"
echo "===================="
echo ""
echo "Supabase:"
echo "  □ RLS enabled on all 9 tables"
echo "  □ Policies enforce user scoping"
echo "  □ Daily backups enabled (production)"
echo "  □ PITR enabled (optional, production)"
echo "  □ First backup verified"
echo "  □ Restore drill completed"
echo ""
echo "Environments:"
echo "  □ Staging Supabase project created"
echo "  □ Production Supabase project created"
echo "  □ Preview env vars configured (staging)"
echo "  □ Production env vars configured (production)"
echo "  □ Environment isolation verified"
echo ""
echo "Git:"
echo "  □ Code in Git repository"
echo "  □ Repository pushed to GitHub/GitLab/Bitbucket"
echo "  □ Vercel connected to Git repository"
echo "  □ Automatic deployments enabled"
echo ""

echo -e "${GREEN}✅ Verification complete${NC}"
echo ""
echo "📚 Next Steps:"
echo "  1. Complete manual verification steps above"
echo "  2. Review: docs/production-prerequisites.md"
echo "  3. Run: ./scripts/production-checklist.sh"
echo "  4. Deploy: Follow docs/deployment.md"
echo ""
