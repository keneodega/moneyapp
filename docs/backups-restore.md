# Backups and Restore Plan

This guide covers setting up automated backups and performing restore drills for the Family Money Tracker database.

## Overview

**Goal**: Ensure data recovery capability if anything goes wrong.

**Strategy**: 
- Enable scheduled backups in Supabase
- Decide on Point-In-Time Recovery (PITR) based on needs
- Perform regular restore drills to verify the process works
- Document the restore procedure

## Backup Types in Supabase

Supabase offers two backup types with different capabilities:

### 1. Scheduled Backups (Daily)

**What it is**: Automated daily snapshots of your database.

**Characteristics**:
- ✅ **Free tier**: 7 days retention
- ✅ **Pro tier**: 7 days retention (configurable)
- ✅ **Team/Enterprise**: Up to 30 days retention
- ✅ Can be downloaded as SQL dump
- ✅ Can be restored to a new project
- ⚠️ Only captures data at the time of backup (not continuous)

**Best for**: 
- Daily recovery points
- Disaster recovery
- Data migration
- Testing restores

**Limitations**:
- If data is corrupted at 2 PM and your last backup was at 3 AM, you lose 11 hours of data
- Cannot restore to a specific minute/second

### 2. Point-In-Time Recovery (PITR)

**What it is**: Continuous backup with ability to restore to any point in time.

**Characteristics**:
- ✅ **Pro tier and above**: Available
- ✅ Restore to any second within retention period
- ✅ Continuous WAL (Write-Ahead Log) archiving
- ✅ No data loss (within retention window)
- ⚠️ More expensive (requires Pro plan or higher)
- ⚠️ Cannot download as SQL dump (restore only via Supabase)

**Best for**:
- Critical financial data
- Zero data loss requirements
- Compliance requirements
- High-value transactions

**Limitations**:
- Requires Pro plan ($25/month minimum)
- Restore only works within Supabase (cannot download)

## Decision Matrix

| Scenario | Recommended Backup Type |
|----------|------------------------|
| **Personal/family use** | Scheduled Backups (Daily) |
| **Small business, low transaction volume** | Scheduled Backups (Daily) |
| **Financial compliance required** | PITR (Pro plan) |
| **High transaction volume** | PITR (Pro plan) |
| **Budget-conscious** | Scheduled Backups (Daily) |

**Recommendation for Family Money Tracker**: 
- Start with **Scheduled Daily Backups** (free tier: 7 days retention)
- Upgrade to PITR if you need zero data loss or compliance

## Step 1: Enable Scheduled Backups

### For Free Tier Projects

1. **Go to Supabase Dashboard**
   - Navigate to your project: [supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project (staging or production)

2. **Navigate to Database Settings**
   - Click **Settings** → **Database**
   - Scroll to **Backups** section

3. **Enable Daily Backups**
   - Toggle **"Enable daily backups"** to ON
   - Retention: 7 days (free tier default)
   - Backups run automatically at 2 AM UTC

4. **Verify Backup Status**
   - Go to **Database** → **Backups** tab
   - You should see a list of backups with timestamps
   - Wait 24 hours for the first backup to appear

### For Pro Tier and Above

1. **Follow steps 1-2 above**

2. **Configure Retention Period**
   - Set retention to 7, 14, or 30 days (based on plan)
   - Longer retention = more storage costs

3. **Enable PITR (Optional)**
   - Toggle **"Point-In-Time Recovery"** to ON
   - Requires Pro plan ($25/month) or higher
   - Enables continuous backup with second-level restore

## Step 2: Verify Backup Configuration

### Check Backup Status

```sql
-- Run in Supabase SQL Editor
-- Check if backups are configured
SELECT 
  setting,
  current_setting(setting) as value
FROM pg_settings
WHERE setting LIKE '%backup%' OR setting LIKE '%archive%';
```

### View Backup History

In Supabase Dashboard:
1. Go to **Database** → **Backups**
2. You should see a list of backups with:
   - Timestamp
   - Size
   - Status (Success/Failed)
   - Download link (for scheduled backups)

## Step 3: Perform a Restore Drill

**Goal**: Verify you can successfully restore from a backup.

**Frequency**: Perform this drill **before going live with real money**, then quarterly.

### Prerequisites

- ✅ Backups enabled and at least one backup exists
- ✅ A test Supabase project (or use staging)
- ✅ 30-60 minutes of time

### Restore Drill Procedure

#### Option A: Restore to New Project (Recommended for Testing)

1. **Create a Test Restore Project**
   ```bash
   # In Supabase Dashboard
   # Click "New Project"
   # Name: "family-money-restore-test"
   # Region: Same as production
   # Password: Generate strong password
   ```

2. **Download Backup from Production**
   - Go to **Production Project** → **Database** → **Backups**
   - Click **Download** on the most recent backup
   - Save the `.sql` file locally
   - Note the backup timestamp

3. **Restore to Test Project**
   - Go to **Test Project** → **SQL Editor**
   - Click **"Restore from backup"** (if available)
   - OR manually:
     ```sql
     -- In SQL Editor of test project
     -- Paste the downloaded SQL file contents
     -- Execute
     ```

4. **Verify Data Integrity**
   ```sql
   -- Run in restored test project
   
   -- Check table counts
   SELECT 
     'monthly_overviews' as table_name, 
     COUNT(*) as row_count 
   FROM monthly_overviews
   UNION ALL
   SELECT 'budgets', COUNT(*) FROM budgets
   UNION ALL
   SELECT 'expenses', COUNT(*) FROM expenses
   UNION ALL
   SELECT 'income_sources', COUNT(*) FROM income_sources;
   
   -- Verify a specific record exists
   SELECT * FROM monthly_overviews LIMIT 1;
   
   -- Check RLS policies are intact
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

5. **Test Application Connection**
   - Update `.env.local` to point to test project:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://restore-test-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=test-project-anon-key
     ```
   - Run `npm run dev`
   - Verify you can:
     - ✅ Log in
     - ✅ View months
     - ✅ See budgets
     - ✅ View expenses/income

6. **Document Results**
   - ✅ Backup timestamp used
   - ✅ Restore time taken
   - ✅ Any issues encountered
   - ✅ Data verification results

#### Option B: Restore via Supabase Dashboard (PITR)

If using PITR:

1. **Go to Database → Backups**
2. **Click "Restore"** on a backup
3. **Select Restore Point**
   - Choose date/time from calendar
   - Or use slider to select exact time
4. **Choose Destination**
   - Restore to current project (overwrites!)
   - OR create new project from restore
5. **Confirm and Wait**
   - Restore takes 10-30 minutes
   - You'll receive email when complete

## Step 4: Document Restore Procedure

Create a runbook for your team:

### Emergency Restore Checklist

```
□ Identify the issue and determine restore point needed
□ Check available backups (Dashboard → Database → Backups)
□ Choose backup closest to desired restore point
□ Create new Supabase project for restore (don't overwrite production!)
□ Download backup SQL file
□ Restore to test project first (verify it works)
□ Update application environment variables
□ Test critical user flows
□ If successful, restore to production project
□ Notify users of data rollback
□ Document what was lost/restored
```

## Step 5: Automated Backup Verification

### Create a Monitoring Script

Create a script to verify backups are running:

```typescript
// scripts/verify-backups.ts
// Run this weekly to ensure backups are working

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Service role key

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBackups() {
  // Check if backups exist (via Supabase Management API or dashboard)
  // This is a placeholder - actual implementation depends on Supabase API
  
  console.log('✅ Backup verification script');
  console.log('⚠️  Manual check required: Go to Dashboard → Database → Backups');
  console.log('   Verify at least one backup exists from the last 24 hours');
}

verifyBackups();
```

## Backup Retention Strategy

### Recommended Retention Periods

| Environment | Retention | Reason |
|-------------|-----------|--------|
| **Production** | 30 days | Allows recovery from month-end issues |
| **Staging** | 7 days | Sufficient for testing, lower cost |

### Cost Considerations

- **Free tier**: 7 days retention (included)
- **Pro tier**: 7-30 days retention (included)
- **Storage**: Backups don't count against database storage quota
- **PITR**: Additional cost on Pro+ plans

## Testing Restore Scenarios

### Scenario 1: Accidental Data Deletion

**Test**: Delete a month and restore from backup

1. Create test month in staging
2. Add test data (income, expenses)
3. Note the timestamp
4. Delete the month
5. Restore from backup before deletion
6. Verify month and data are restored

### Scenario 2: Data Corruption

**Test**: Corrupt data and restore

1. Manually corrupt a record via SQL:
   ```sql
   UPDATE monthly_overviews 
   SET name = 'CORRUPTED' 
   WHERE id = 'test-id';
   ```
2. Restore from backup before corruption
3. Verify data is correct

### Scenario 3: Schema Migration Rollback

**Test**: Restore to before a migration

1. Apply a test migration
2. Restore from backup before migration
3. Verify schema is reverted

## Best Practices

### ✅ DO

- **Enable backups before production use**
- **Test restore process quarterly**
- **Document restore procedures**
- **Keep backups for at least 7 days**
- **Verify backups are running weekly**
- **Test restores in staging first**

### ❌ DON'T

- **Don't disable backups to save costs** (data loss risk)
- **Don't restore to production without testing first**
- **Don't rely solely on backups** (also use version control for schema)
- **Don't store backups only in Supabase** (download critical backups)
- **Don't skip restore drills** (you need to know the process works)

## Troubleshooting

### Backup Not Appearing

**Issue**: No backups showing after 24 hours

**Solutions**:
1. Check backup is enabled in Settings → Database
2. Verify project is not paused
3. Check Supabase status page for issues
4. Contact Supabase support

### Restore Fails

**Issue**: Restore process errors out

**Solutions**:
1. Check backup file is not corrupted (re-download)
2. Verify target project has sufficient resources
3. Check SQL syntax in backup file
4. Try restoring to a fresh project
5. Contact Supabase support with error details

### Restored Data Missing

**Issue**: After restore, some data is missing

**Solutions**:
1. Verify you restored the correct backup timestamp
2. Check if data was created after backup time
3. Verify RLS policies are restored correctly
4. Check if restore was partial (check logs)

## Next Steps

1. ✅ **Enable scheduled backups** in both staging and production
2. ✅ **Wait 24 hours** for first backup
3. ✅ **Perform restore drill** to test project
4. ✅ **Document results** and update this guide
5. ✅ **Set calendar reminder** for quarterly restore drills
6. ✅ **Consider PITR** if zero data loss is required

## Resources

- [Supabase Backups Documentation](https://supabase.com/docs/guides/platform/backups)
- [Supabase PITR Guide](https://supabase.com/docs/guides/platform/backups#point-in-time-recovery)
- [PostgreSQL Backup Best Practices](https://www.postgresql.org/docs/current/backup.html)

---

**Last Updated**: [Date]
**Next Review**: [Date + 3 months]
**Tested By**: [Name]
**Status**: ✅ Backups Enabled / ⚠️ Pending / ❌ Not Configured
