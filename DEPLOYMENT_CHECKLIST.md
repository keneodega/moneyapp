# Deployment Checklist - Savings & Reports Features

## Pre-Deployment Checklist

### 1. Database Migrations ⚠️ IMPORTANT
Before deploying, you need to run the new migration in Supabase:

**Migration File**: `supabase/migrations/add_savings_buckets.sql`

**Steps**:
1. Go to your **Production Supabase** project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/add_savings_buckets.sql`
4. Click **Run** to execute the migration
5. Verify the tables were created:
   - `savings_buckets`
   - `savings_transactions`

**Repeat for Staging** (if using staging):
- Run the same migration in your staging Supabase project

### 2. Build Verification
Run locally to ensure build succeeds:
```bash
npm run build
```

### 3. Environment Variables
Verify these are set in Vercel:

**Production Environment**:
- `NEXT_PUBLIC_SUPABASE_URL` - Production Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Production Supabase anon key
- `NEXT_PUBLIC_APP_ENV` - Set to `production`

**Preview Environment** (if using):
- `NEXT_PUBLIC_SUPABASE_URL` - Staging Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Staging Supabase anon key
- `NEXT_PUBLIC_APP_ENV` - Set to `preview`

### 4. New Features Added
✅ **Savings Page** (`/savings`)
- Savings buckets system
- Link buckets to goals
- Transaction tracking

✅ **Reports & Analytics** (`/reports`)
- Spending trends (with Recharts)
- Category breakdown (with Recharts)
- Year-over-year comparisons (with Recharts)

✅ **Navigation Updates**
- Added "Savings" link
- Added "Reports" link

### 5. Dependencies
New dependency added:
- `recharts: ^3.7.0` ✅ (already in package.json)

## Deployment Steps

### Option 1: Deploy via Git (Recommended)

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add Savings and Reports features with Recharts"
   git push origin main
   ```

2. **Vercel will automatically deploy** when you push to `main` branch

3. **Monitor deployment**:
   - Go to Vercel Dashboard
   - Watch the build logs
   - Verify deployment succeeds

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm i -g vercel
   ```

2. **Login**:
   ```bash
   vercel login
   ```

3. **Deploy to production**:
   ```bash
   vercel --prod
   ```

### Option 3: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Select your project
3. Click **Deployments** tab
4. Click **Redeploy** on latest deployment
5. Or create a new deployment from a branch

## Post-Deployment Verification

### 1. Test New Features

**Savings Page**:
- Navigate to `/savings`
- Create a new savings bucket
- Add a transaction
- Link a bucket to a goal
- Verify bucket balance updates

**Reports Page**:
- Navigate to `/reports`
- Test Spending Trends tab
- Test Category Breakdown tab
- Test Year-over-Year tab
- Verify charts render correctly
- Test date range filters

### 2. Check Navigation
- Verify "Savings" link appears in navigation
- Verify "Reports" link appears in navigation
- Test mobile menu (hamburger)

### 3. Database Verification
- Check that `savings_buckets` table exists
- Check that `savings_transactions` table exists
- Verify RLS policies are active
- Test creating a bucket via UI

### 4. Error Monitoring
- Check Vercel logs for any errors
- Check browser console for client-side errors
- Monitor Supabase logs for database errors

## Rollback Plan

If something goes wrong:

1. **Revert Git commit**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or redeploy previous version**:
   - Go to Vercel Dashboard
   - Find previous successful deployment
   - Click "Redeploy"

3. **Database rollback** (if needed):
   - Drop new tables in Supabase SQL Editor:
     ```sql
     DROP TABLE IF EXISTS savings_transactions CASCADE;
     DROP TABLE IF EXISTS savings_buckets CASCADE;
     ```

## Troubleshooting

### Build Fails
- Check `npm run build` locally first
- Review Vercel build logs
- Ensure all dependencies are in `package.json`

### Charts Not Rendering
- Check browser console for errors
- Verify `recharts` is installed
- Check if data is loading correctly

### Database Errors
- Verify migration was run successfully
- Check RLS policies are correct
- Verify environment variables point to correct Supabase project

### Navigation Links Missing
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Clear browser cache
- Check if build included latest changes

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Review browser console errors
4. Verify environment variables are correct
