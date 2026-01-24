# Production Prerequisites Checklist

This document verifies that all prerequisites are met before deploying to production with real money data.

## A) Supabase Production Readiness

### ✅ Row Level Security (RLS)

**Status**: ✅ **VERIFIED** - RLS enabled on all tables

#### Tables with RLS Enabled

All 9 tables have RLS enabled and proper policies:

1. **`monthly_overviews`** ✅
   - RLS: Enabled
   - Policies: SELECT, INSERT, UPDATE, DELETE
   - Scoping: `auth.uid() = user_id`

2. **`budgets`** ✅
   - RLS: Enabled
   - Policies: SELECT, INSERT, UPDATE, DELETE
   - Scoping: Indirect via `monthly_overviews` (EXISTS check)

3. **`expenses`** ✅
   - RLS: Enabled
   - Policies: SELECT, INSERT, UPDATE, DELETE
   - Scoping: `auth.uid() = user_id`

4. **`income_sources`** ✅
   - RLS: Enabled
   - Policies: SELECT, INSERT, UPDATE, DELETE
   - Scoping: `auth.uid() = user_id`

5. **`financial_goals`** ✅
   - RLS: Enabled
   - Policies: SELECT, INSERT, UPDATE, DELETE
   - Scoping: `auth.uid() = user_id`

6. **`financial_sub_goals`** ✅
   - RLS: Enabled
   - Policies: SELECT, INSERT, UPDATE, DELETE
   - Scoping: Indirect via `financial_goals` (EXISTS check)

7. **`subscriptions`** ✅
   - RLS: Enabled
   - Policies: SELECT, INSERT, UPDATE, DELETE
   - Scoping: `auth.uid() = user_id`

8. **`investment_holdings`** ✅
   - RLS: Enabled
   - Policies: SELECT, INSERT, UPDATE, DELETE
   - Scoping: `auth.uid() = user_id`

9. **`investment_transactions`** ✅
   - RLS: Enabled
   - Policies: SELECT, INSERT, UPDATE, DELETE
   - Scoping: `auth.uid() = user_id`

#### Verification Steps

1. **Run RLS verification script**:
   ```bash
   ./scripts/verify-rls.sh
   ```

2. **Run SQL verification query**:
   - Go to Supabase Dashboard → SQL Editor
   - Run `supabase/migrations/002_verify_rls.sql`
   - Verify all tables show "✅ Enabled"
   - Verify each table has 4 policies (SELECT, INSERT, UPDATE, DELETE)

3. **Manual verification in Supabase Dashboard**:
   - Go to **Database → Tables**
   - For each table:
     - Click the table name
     - Go to **Policies** tab
     - Verify RLS toggle is **ON** (green)
     - Verify 4 policies exist (one for each operation)
     - Click each policy to verify it uses `auth.uid() = user_id` or equivalent

4. **Test with multiple users**:
   - Create two test users in Supabase Auth
   - As User A, create a month and some data
   - As User B, verify you cannot see User A's data
   - As User B, verify you cannot modify User A's data

#### Policy Pattern Reference

**Direct ownership** (7 tables):
```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

**Indirect ownership** (2 tables):
```sql
-- Budgets
USING (EXISTS (
  SELECT 1 FROM monthly_overviews 
  WHERE id = budgets.monthly_overview_id 
  AND user_id = auth.uid()
))

-- Sub-goals
USING (EXISTS (
  SELECT 1 FROM financial_goals 
  WHERE id = financial_sub_goals.financial_goal_id 
  AND user_id = auth.uid()
))
```

### ✅ Backups

**Status**: ⚠️ **REQUIRES MANUAL SETUP**

#### Backup Types

1. **Daily Backups** (Required)
   - Automatic daily snapshots
   - Retention: 7-30 days (depending on plan)
   - Recovery: Restore to point of backup

2. **Point-In-Time Recovery (PITR)** (Optional but Recommended)
   - Continuous backup
   - Recovery: Restore to any point in time
   - Required for: Critical financial data

#### Setup Instructions

**For Production Supabase Project**:

1. Go to **Supabase Dashboard → Project Settings → Database**
2. Scroll to **Backups** section
3. **Enable Daily Backups**:
   - Toggle "Daily Backups" to ON
   - Set retention period (recommended: 30 days)
4. **Enable PITR** (if available on your plan):
   - Toggle "Point-in-Time Recovery" to ON
   - Note: PITR may require Pro plan or higher
5. **Verify first backup**:
   - Wait 24 hours after enabling
   - Check that backups are being created
   - Run: `./scripts/verify-backups.sh`

#### Backup Verification

1. **Check backup status**:
   ```bash
   ./scripts/verify-backups.sh
   ```

2. **Manual verification**:
   - Go to Supabase Dashboard → Database → Backups
   - Verify backups are listed
   - Verify most recent backup is within 24 hours

3. **Test restore** (Restore Drill):
   - Follow guide in `docs/backups-restore.md`
   - Create test project
   - Restore backup to test project
   - Verify data integrity

#### Backup Checklist

- [ ] Daily backups enabled in production Supabase
- [ ] Retention period set (7-30 days)
- [ ] First backup completed (wait 24 hours)
- [ ] PITR enabled (if available and desired)
- [ ] Restore drill completed successfully
- [ ] Backup verification script tested

### Supabase Production Checklist

- [x] RLS enabled on all 9 tables
- [x] Policies enforce user scoping (`auth.uid() = user_id`)
- [x] Policies tested with multiple users
- [ ] Daily backups enabled
- [ ] PITR enabled (optional but recommended)
- [ ] First backup verified
- [ ] Restore drill completed

## B) Environment Setup

### ✅ Staging vs Production

**Status**: ✅ **CONFIGURED** - Two-project setup recommended

#### Recommended Setup

**Two Supabase Projects**:

1. **Staging Project** (`family-money-staging`)
   - Used for: Development, testing, preview deployments
   - Contains: Test data only
   - Never contains: Real user data or real money

2. **Production Project** (`family-money-production`)
   - Used for: Production deployments only
   - Contains: Real user data and real money
   - Protected: Only accessed by production deployments

#### Vercel Environment Configuration

Vercel automatically supports two environments:

1. **Preview Environment**
   - Triggers: Pull requests, feature branches
   - Supabase: Staging project
   - Environment Variable: `NEXT_PUBLIC_APP_ENV=preview`

2. **Production Environment**
   - Triggers: Pushes to `main` branch
   - Supabase: Production project
   - Environment Variable: `NEXT_PUBLIC_APP_ENV=production`

#### Environment Variables Setup

**In Vercel Dashboard → Settings → Environment Variables**:

| Variable | Preview Value | Production Value |
|----------|---------------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging project URL | Production project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key | Production anon key |
| `NEXT_PUBLIC_APP_ENV` | `preview` | `production` |
| `NEXT_PUBLIC_SENTRY_DSN` | Same (optional) | Same (optional) |
| `SENTRY_ORG` | Same (optional) | Same (optional) |
| `SENTRY_PROJECT` | Same (optional) | Same (optional) |

> ⚠️ **CRITICAL**: Use **DIFFERENT** Supabase projects for Preview vs Production!

#### Environment Verification

1. **Verify environment variables**:
   ```bash
   ./scripts/verify-env-vars.sh
   ```

2. **Check Vercel Dashboard**:
   - Go to **Settings → Environment Variables**
   - Verify Preview and Production have different Supabase URLs
   - Verify Production uses production Supabase project

3. **Test environment isolation**:
   - Create a preview deployment (open a PR)
   - Verify it connects to staging Supabase
   - Verify production deployment connects to production Supabase

#### Environment Checklist

- [ ] Staging Supabase project created
- [ ] Production Supabase project created
- [ ] Schema applied to both projects
- [ ] RLS enabled on both projects
- [ ] Preview env vars set in Vercel (staging Supabase)
- [ ] Production env vars set in Vercel (production Supabase)
- [ ] Environment isolation verified
- [ ] No production data in staging project

## C) Git Repository Setup

### ✅ Git Repository

**Status**: ⚠️ **VERIFY** - Should be in Git with GitHub connection

#### Requirements

1. **Code in Git**:
   - All code committed to Git
   - Repository pushed to GitHub (or GitLab/Bitbucket)
   - `.gitignore` properly configured

2. **Vercel Git Integration**:
   - Repository connected to Vercel
   - Automatic deployments enabled
   - Preview deployments for PRs

#### Verification Steps

1. **Check Git status**:
   ```bash
   git status
   # Should show "nothing to commit" or only expected changes
   ```

2. **Verify remote**:
   ```bash
   git remote -v
   # Should show GitHub/GitLab/Bitbucket remote
   ```

3. **Check Vercel connection**:
   - Go to Vercel Dashboard → Your Project → Settings → Git
   - Verify repository is connected
   - Verify branch is set (usually `main`)

4. **Test Git workflow**:
   - Create a test branch
   - Push to GitHub
   - Verify Vercel creates preview deployment

#### Git Checklist

- [ ] All code committed to Git
- [ ] Repository pushed to GitHub/GitLab/Bitbucket
- [ ] `.gitignore` includes sensitive files (`.env.local`, `node_modules`, etc.)
- [ ] Vercel connected to Git repository
- [ ] Automatic deployments enabled
- [ ] Preview deployments working (test with a PR)

#### Recommended Git Workflow

```
main (production)
 │
 ├── develop (staging)
 │    │
 │    ├── feature/add-goals
 │    ├── feature/edit-budget
 │    └── fix/overspend-validation
```

**Deployment Flow**:
- `main` branch → Production deployment → Production Supabase
- `develop` branch → Preview deployment → Staging Supabase
- Feature branches → Preview deployment → Staging Supabase
- Pull requests → Preview deployment → Staging Supabase

## Complete Production Prerequisites Checklist

### Supabase
- [x] RLS enabled on all 9 tables
- [x] Policies enforce user scoping
- [x] Policies tested with multiple users
- [ ] Daily backups enabled (production project)
- [ ] PITR enabled (optional, production project)
- [ ] First backup verified
- [ ] Restore drill completed

### Environments
- [ ] Staging Supabase project created
- [ ] Production Supabase project created
- [ ] Schema applied to both projects
- [ ] RLS enabled on both projects
- [ ] Preview env vars configured (staging)
- [ ] Production env vars configured (production)
- [ ] Environment isolation verified

### Git
- [ ] Code in Git repository
- [ ] Repository pushed to GitHub/GitLab/Bitbucket
- [ ] Vercel connected to Git repository
- [ ] Automatic deployments enabled
- [ ] Preview deployments tested

## Quick Verification Commands

```bash
# Verify RLS
./scripts/verify-rls.sh

# Verify backups
./scripts/verify-backups.sh

# Verify environment variables
./scripts/verify-env-vars.sh

# Run complete production checklist
./scripts/production-checklist.sh
```

## Next Steps

Once all prerequisites are met:

1. **Review this checklist** - Ensure all items are checked
2. **Run verification scripts** - Confirm everything is working
3. **Test restore drill** - Know how to recover from backup
4. **Deploy to production** - Follow [Deployment Guide](./deployment.md)
5. **Monitor** - Set up [Uptime Monitoring](./uptime-monitoring.md)

## Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Backups](https://supabase.com/docs/guides/platform/backups)
- [Vercel Git Integration](https://vercel.com/docs/concepts/git)
- [Production Hardening Guide](./production-hardening.md)
- [Backups & Restore Guide](./backups-restore.md)

---

**Last Verified**: [Date]
**Status**: ⚠️ Requires Manual Setup / ✅ Ready for Production
