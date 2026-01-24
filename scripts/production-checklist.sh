#!/bin/bash

# Production Hardening Checklist Script
# 
# Runs all verification scripts and provides a comprehensive checklist.
#
# Usage:
#   chmod +x scripts/production-checklist.sh
#   ./scripts/production-checklist.sh

set -e

echo "🚀 Production Hardening Checklist"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Running verification scripts...${NC}"
echo ""

# Run RLS verification
echo "1️⃣  Row Level Security (RLS)"
echo "----------------------------"
./scripts/verify-rls.sh
echo ""

# Run backup verification
echo "2️⃣  Backups"
echo "-----------"
./scripts/verify-backups.sh
echo ""

# Run environment variable verification
echo "3️⃣  Environment Variables"
echo "--------------------------"
./scripts/verify-env-vars.sh
echo ""

echo -e "${BLUE}📋 Manual Checklist${NC}"
echo "===================="
echo ""
echo "Complete these items manually:"
echo ""

echo -e "${YELLOW}Security${NC}"
echo "  □ RLS enabled on all 9 tables (verified in Supabase Dashboard)"
echo "  □ Policies tested with multiple users"
echo "  □ Service role key NOT in client code"
echo "  □ HTTPS enforced (automatic on Vercel)"
echo ""

echo -e "${YELLOW}Backups${NC}"
echo "  □ Scheduled backups enabled in Supabase"
echo "  □ First backup completed (wait 24 hours)"
echo "  □ Restore drill completed successfully"
echo "  □ Backup retention period set"
echo ""

echo -e "${YELLOW}Environment Variables${NC}"
echo "  □ Production env vars set in Vercel"
echo "  □ Preview env vars set in Vercel"
echo "  □ Different Supabase projects for staging/production"
echo "  □ Sentry DSN configured (if using)"
echo ""

echo -e "${YELLOW}Next.js Production${NC}"
echo "  □ Production build tested locally"
echo "  □ Lighthouse audit run (score > 90)"
echo "  □ Bundle size reviewed"
echo "  □ Error boundaries added (optional)"
echo ""

echo -e "${YELLOW}Testing${NC}"
echo "  □ All unit tests passing"
echo "  □ All E2E tests passing"
echo "  □ Manual testing of critical flows"
echo "  □ Tested with real Supabase project"
echo ""

echo -e "${YELLOW}Monitoring${NC}"
echo "  □ Sentry configured and tested"
echo "  □ Error tracking verified"
echo "  □ Event logging verified"
echo "  □ Performance monitoring enabled (optional)"
echo ""

echo -e "${GREEN}✅ Checklist complete${NC}"
echo ""
echo "📚 Documentation:"
echo "  - Production Hardening: docs/production-hardening.md"
echo "  - Backups & Restore: docs/backups-restore.md"
echo "  - Next.js Checklist: docs/nextjs-production-checklist.md"
echo "  - Deployment Guide: docs/deployment.md"
echo ""
