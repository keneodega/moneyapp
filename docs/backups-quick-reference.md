# Backup & Restore Quick Reference

Quick checklist for backup setup and restore procedures.

## Initial Setup (Do This First!)

### ✅ Enable Backups

1. Go to Supabase Dashboard → Your Project
2. Settings → Database → Backups
3. Toggle **"Enable daily backups"** ON
4. Set retention: **7 days** (free) or **7-30 days** (Pro)
5. Wait 24 hours for first backup

### ✅ Verify Backups Are Running

```bash
# Run verification script
./scripts/verify-backups.sh

# Or manually check:
# Dashboard → Database → Backups
# Should see at least one backup from last 24 hours
```

## Restore Drill (Do Before Production!)

### Quick Restore Test

1. **Create test project**: `family-money-restore-test`
2. **Download backup** from production → Backups → Download
3. **Restore to test project**:
   - SQL Editor → Paste downloaded SQL
   - Execute
4. **Verify data**:
   ```sql
   SELECT COUNT(*) FROM monthly_overviews;
   SELECT COUNT(*) FROM budgets;
   SELECT COUNT(*) FROM expenses;
   ```
5. **Test app connection**:
   - Update `.env.local` to point to test project
   - Run `npm run dev`
   - Verify you can log in and see data

**Time**: ~30 minutes  
**Frequency**: Before production, then quarterly

## Emergency Restore

### If Data is Lost or Corrupted

1. **Don't panic** - backups are available
2. **Identify restore point** - when was data last good?
3. **Go to**: Dashboard → Database → Backups
4. **Download backup** closest to restore point
5. **Create new project** (don't overwrite production yet!)
6. **Restore to test project first** - verify it works
7. **If successful**, restore to production
8. **Update app** to point to restored project
9. **Notify users** of data rollback

## Backup Types

| Type | Retention | Cost | Best For |
|------|-----------|------|----------|
| **Scheduled (Daily)** | 7-30 days | Free/Included | Most use cases |
| **PITR** | 7-30 days | Pro+ ($25/mo) | Zero data loss needed |

**Recommendation**: Start with Scheduled, upgrade to PITR if needed.

## Checklist

### Before Production
- [ ] Backups enabled in Supabase
- [ ] At least one backup exists
- [ ] Restore drill completed successfully
- [ ] Restore procedure documented
- [ ] Team knows how to restore

### Quarterly Maintenance
- [ ] Verify backups are running (check dashboard)
- [ ] Perform restore drill
- [ ] Review backup retention period
- [ ] Update documentation if needed

## Quick Links

- **Full Guide**: [backups-restore.md](./backups-restore.md)
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Backups Tab**: Dashboard → Database → Backups

## Troubleshooting

**No backups showing?**
- Check backup is enabled
- Wait 24 hours for first backup
- Check project is not paused

**Restore fails?**
- Re-download backup file
- Try restoring to fresh project
- Check SQL syntax
- Contact Supabase support

---

**Last Restore Drill**: __________  
**Next Scheduled**: __________  
**Backup Status**: ✅ Enabled / ⚠️ Pending / ❌ Not Configured
