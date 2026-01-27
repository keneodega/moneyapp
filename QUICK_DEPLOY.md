# Quick Deployment Guide

## ⚠️ CRITICAL: Run Database Migration First!

Before deploying, you MUST run the savings buckets migration in Supabase:

### Step 1: Run Migration in Supabase

1. **Go to your Production Supabase Dashboard**
   - URL: https://supabase.com/dashboard
   - Select your production project (`family-money-production`)

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar

3. **Run the Migration**
   - Open the file: `supabase/migrations/add_savings_buckets.sql`
   - Copy ALL contents
   - Paste into SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

4. **Verify Success**
   - Check for "Success" message
   - Verify tables exist: Go to Table Editor → You should see `savings_buckets` and `savings_transactions`

### Step 2: Commit and Push Changes

```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "Add Savings buckets, Reports & Analytics with Recharts, and UX improvements"

# Push to trigger Vercel deployment
git push origin main
```

### Step 3: Monitor Deployment

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Watch the deployment build logs
4. Wait for "Ready" status

### Step 4: Test After Deployment

1. **Test Savings Page**:
   - Navigate to `/savings`
   - Create a bucket
   - Add a transaction

2. **Test Reports Page**:
   - Navigate to `/reports`
   - Check all three tabs work
   - Verify charts render

3. **Check Navigation**:
   - Verify "Savings" and "Reports" links appear

## If Deployment Fails

1. Check Vercel build logs for errors
2. Verify environment variables are set correctly
3. Ensure migration was run successfully
4. Check browser console for runtime errors

## Need Help?

- Check `DEPLOYMENT_CHECKLIST.md` for detailed troubleshooting
- Review Vercel deployment logs
- Check Supabase logs for database errors
