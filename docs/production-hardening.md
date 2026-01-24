# Production Hardening Checklist

This document ensures your Family Money Tracker app is production-ready with proper security, backups, and best practices.

## ✅ Security: Row Level Security (RLS)

### Current Status

**RLS is enabled on all 9 tables:**
- ✅ `monthly_overviews`
- ✅ `budgets`
- ✅ `expenses`
- ✅ `income_sources`
- ✅ `financial_goals`
- ✅ `financial_sub_goals`
- ✅ `subscriptions`
- ✅ `investment_holdings`
- ✅ `investment_transactions`

### Policy Verification

All policies enforce **user scoping** using `auth.uid() = user_id`:

- **Direct user ownership**: Monthly overviews, expenses, income sources, financial goals, subscriptions, investment holdings, investment transactions
- **Indirect ownership** (via parent): Budgets (via monthly_overview), Sub-goals (via financial_goal)

### Views Security

**Database views** (`monthly_overview_summary`, `budget_summary`, `investment_holding_summary`) inherit RLS from underlying tables. No additional policies needed.

### Verification Steps

1. **Run RLS verification script**:
   ```bash
   ./scripts/verify-rls.sh
   ```

2. **Manual verification in Supabase**:
   - Go to **Database → Tables**
   - Click each table → **Policies** tab
   - Verify RLS is enabled (toggle should be ON)
   - Verify policies exist for SELECT, INSERT, UPDATE, DELETE

3. **Test with different users**:
   - Create two test users
   - Verify User A cannot see User B's data
   - Verify User A cannot modify User B's data

### Security Best Practices

- ✅ **Never use service role key in client code** - Only use `anon` key
- ✅ **All client queries use authenticated user** - `auth.uid()` is always checked
- ✅ **No public access** - All tables require authentication
- ✅ **Cascade deletes** - Related data is cleaned up automatically

## ✅ Backups and Restore

### Setup Status

See [Backups & Restore Guide](./backups-restore.md) for complete setup.

### Quick Checklist

- [ ] **Scheduled backups enabled** in Supabase Dashboard
- [ ] **Retention period set** (7-30 days based on plan)
- [ ] **First backup completed** (wait 24 hours after enabling)
- [ ] **Restore drill completed** (test restore to new project)
- [ ] **Backup verification script** run weekly

### Restore Drill Procedure

1. Create test project: `family-money-restore-test`
2. Download backup from production
3. Restore to test project
4. Verify data integrity
5. Test app connection
6. Document results

**Frequency**: Before production, then quarterly

## ✅ Environment Variables

### Vercel Configuration

#### Production Environment
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Production Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Production Supabase anon key |
| `NEXT_PUBLIC_APP_ENV` | ✅ | Set to `production` |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ | Sentry DSN (if using error tracking) |
| `SENTRY_ORG` | ⚠️ | Sentry org slug (for source maps) |
| `SENTRY_PROJECT` | ⚠️ | Sentry project name |

#### Preview Environment
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Staging Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Staging Supabase anon key |
| `NEXT_PUBLIC_APP_ENV` | ✅ | Set to `preview` |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ | Sentry DSN (can use same as production) |
| `SENTRY_ORG` | ⚠️ | Sentry org slug |
| `SENTRY_PROJECT` | ⚠️ | Sentry project name |

### Verification Steps

1. **Check Vercel Dashboard**:
   - Go to **Settings → Environment Variables**
   - Verify all required variables are set
   - Verify Production and Preview have correct values

2. **Pull env vars locally** (for testing):
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login
   vercel login
   
   # Pull env vars
   vercel env pull .env.local
   ```

3. **Verify in code**:
   - Check `src/lib/config/env.ts` validates all required vars
   - App should fail fast if vars are missing

### Environment Variable Security

- ✅ **Never commit `.env.local`** - Already in `.gitignore`
- ✅ **Use different Supabase projects** for staging/production
- ✅ **Rotate keys periodically** - Update Supabase keys if compromised
- ✅ **Use Vercel's environment variable encryption** - Variables are encrypted at rest

## ✅ Next.js Production Checklist

### Performance

- [x] **Image Optimization**: Using Next.js Image component (when needed)
- [x] **Font Optimization**: Using `next/font` for DM Sans and JetBrains Mono
- [x] **Code Splitting**: Automatic with Next.js App Router
- [x] **Static Generation**: Using Server Components where possible
- [ ] **Bundle Analysis**: Run `npm run build` and check bundle size
- [ ] **Lighthouse Audit**: Run Lighthouse on production URL

### Security

- [x] **HTTPS Only**: Enforced by Vercel
- [x] **Security Headers**: Configured in `vercel.json`
- [x] **Environment Variables**: Not exposed to client (only `NEXT_PUBLIC_*`)
- [x] **RLS Enabled**: All database tables protected
- [x] **Input Validation**: Service layer validates all inputs
- [ ] **Rate Limiting**: Consider adding for API routes (if needed)
- [ ] **CSP Headers**: Consider adding Content Security Policy

### Correctness

- [x] **TypeScript**: Full type checking (`npm run typecheck`)
- [x] **Linting**: ESLint configured (`npm run lint`)
- [x] **Error Handling**: Custom error classes and Sentry integration
- [x] **Testing**: Unit tests (Vitest) and E2E tests (Playwright)
- [x] **Business Rules**: Enforced at service layer and database level
- [ ] **Error Boundaries**: Consider adding React error boundaries

### Monitoring

- [x] **Sentry Integration**: Error tracking configured
- [x] **Event Logging**: Key money events logged to Sentry
- [ ] **Performance Monitoring**: Consider Sentry Performance
- [ ] **Uptime Monitoring**: Consider external service (UptimeRobot, etc.)

### Build & Deployment

- [x] **Build Scripts**: Separate for preview/production
- [x] **CI/CD**: GitHub Actions configured
- [x] **Type Checking**: Runs in CI
- [x] **Tests**: Run in CI before deployment
- [ ] **Build Time**: Monitor and optimize if > 5 minutes

## Pre-Production Checklist

Before going live with real money:

### Security
- [ ] ✅ RLS verified on all tables
- [ ] ✅ Policies tested with multiple users
- [ ] ✅ Service role key NOT in client code
- [ ] ✅ Environment variables set correctly
- [ ] ✅ HTTPS enforced (automatic on Vercel)

### Backups
- [ ] ✅ Scheduled backups enabled
- [ ] ✅ Restore drill completed successfully
- [ ] ✅ Backup verification script tested
- [ ] ✅ Backup retention period set appropriately

### Testing
- [ ] ✅ All unit tests passing
- [ ] ✅ All E2E tests passing
- [ ] ✅ Manual testing of critical flows
- [ ] ✅ Tested with real Supabase project

### Monitoring
- [ ] ✅ Sentry configured and tested
- [ ] ✅ Error tracking verified (test error page works)
- [ ] ✅ Event logging verified

### Documentation
- [ ] ✅ Deployment guide reviewed
- [ ] ✅ Backup guide reviewed
- [ ] ✅ Environment setup documented
- [ ] ✅ Team knows how to restore

## Post-Deployment Verification

After deploying to production:

1. **Verify Environment**:
   - Check environment badge shows "Production"
   - Verify correct Supabase project is connected

2. **Test Critical Flows**:
   - Create a month
   - Add income
   - Add expense
   - Create a goal
   - Link expense to goal

3. **Check Monitoring**:
   - Verify Sentry is receiving events
   - Check for any errors in Sentry dashboard
   - Verify money events are being logged

4. **Performance Check**:
   - Run Lighthouse audit
   - Check Vercel Analytics
   - Monitor build times

## Ongoing Maintenance

### Weekly
- [ ] Run backup verification script
- [ ] Check Sentry for new errors
- [ ] Review error rates

### Monthly
- [ ] Review backup retention
- [ ] Check environment variable usage
- [ ] Review security policies
- [ ] Update dependencies (if needed)

### Quarterly
- [ ] Perform restore drill
- [ ] Review and update documentation
- [ ] Security audit
- [ ] Performance optimization review

## ✅ Additional Enhancements (Completed)

### 1. React Error Boundary
- ✅ **Implemented**: `src/components/ErrorBoundary.tsx`
- ✅ **Integrated**: Wraps root layout to catch React errors
- ✅ **Features**:
  - Catches React component errors
  - Reports to Sentry automatically
  - User-friendly error UI
  - Reload and go home options
  - Shows error details in development mode

### 2. Vercel Analytics
- ✅ **Installed**: `@vercel/analytics` package
- ✅ **Integrated**: Added `<Analytics />` component to root layout
- ✅ **Usage**: Automatically tracks page views and performance
- 📝 **Enable in Vercel**: Go to Vercel Dashboard → Project → Analytics → Enable Web Analytics

### 3. Sentry Performance Monitoring
- ✅ **Enabled**: Browser tracing integration
- ✅ **Features**:
  - Performance tracing (10% sample rate in production)
  - Interaction to Next Paint (INP) tracking
  - Long task detection
  - Session replay on errors
  - Server-side performance monitoring

### 4. Content Security Policy (CSP)
- ✅ **Added**: CSP headers in `vercel.json`
- ✅ **Configuration**:
  - Allows scripts from self, Vercel, and Sentry
  - Allows styles from self and Google Fonts
  - Allows connections to Supabase and Sentry
  - Blocks frame embedding
  - Restricts form actions and base URI

### 5. Uptime Monitoring
- ✅ **Documented**: Complete guide in `docs/uptime-monitoring.md`
- ✅ **Health Check Endpoint**: `/api/health` route created
- 📝 **Next Step**: Set up UptimeRobot or similar service

## Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Production Deployment](https://nextjs.org/docs/deployment)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Uptime Monitoring Guide](./uptime-monitoring.md)

---

**Last Verified**: [Date]
**Verified By**: [Name]
**Status**: ✅ Ready for Production
