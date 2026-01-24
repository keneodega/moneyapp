# Deployment Guide

This guide covers deploying the Family Money Tracker to Vercel with staging and production environments.

> ⚠️ **Before deploying**: Complete the [Production Prerequisites](./production-prerequisites.md) checklist first!

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   PRODUCTION     │    │     PREVIEW      │                   │
│  │   (main branch)  │    │   (PR branches)  │                   │
│  │                  │    │                  │                   │
│  │  moneyapp.vercel │    │  pr-123.vercel   │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
└───────────┼───────────────────────┼──────────────────────────────┘
            │                       │
            ▼                       ▼
┌──────────────────────┐  ┌──────────────────────┐
│   PRODUCTION         │  │   STAGING            │
│   Supabase Project   │  │   Supabase Project   │
│                      │  │                      │
│   Real user data     │  │   Test data only     │
└──────────────────────┘  └──────────────────────┘
```

## Prerequisites

1. **GitHub Repository**: Push your code to GitHub
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **Two Supabase Projects**:
   - `family-money-staging` - For preview/development
   - `family-money-production` - For production only

## Step 1: Create Supabase Projects

### Staging Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `family-money-staging`
3. Region: Choose closest to your users (e.g., `eu-west-1` for Ireland)
4. Generate a strong password
5. Run the schema:
   - Go to SQL Editor
   - Paste contents of `supabase/schema.sql`
   - Execute

### Production Project
1. Create another project: `family-money-production`
2. Same region as staging
3. Run the same schema

### Get API Keys
For each project, go to **Settings > API** and note:
- `Project URL`
- `anon public` key

## Step 2: Deploy to Vercel

### Connect Repository
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects Next.js

### Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

#### Production Environment
| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Production |
| `NEXT_PUBLIC_APP_ENV` | `production` | Production |

#### Preview Environment (Staging)
| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yyy.supabase.co` | Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Preview |
| `NEXT_PUBLIC_APP_ENV` | `preview` | Preview |

> ⚠️ **Important**: Use DIFFERENT Supabase projects for Preview vs Production!

### Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Your app is live!

## Step 3: Set Up Git Workflow

### Branch Strategy

```
main (production)
 │
 ├── develop (staging)
 │    │
 │    ├── feature/add-goals
 │    ├── feature/edit-budget
 │    └── fix/overspend-validation
```

### Deployment Flow

| Branch | Vercel Environment | Supabase | URL |
|--------|-------------------|----------|-----|
| `main` | Production | Production | `yourapp.vercel.app` |
| `develop` | Preview | Staging | `develop-xxx.vercel.app` |
| `feature/*` | Preview | Staging | `feature-xxx.vercel.app` |
| PR #123 | Preview | Staging | `pr-123-xxx.vercel.app` |

### Recommended Workflow

1. **Create feature branch** from `develop`
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/my-feature
   ```

2. **Push and create PR** → Vercel deploys preview
   ```bash
   git push -u origin feature/my-feature
   # Create PR in GitHub
   ```

3. **Test on preview URL** with staging data

4. **Merge to develop** → Updated staging preview

5. **Merge develop to main** → Production deployment

## Step 4: Configure GitHub Integration

### Automatic Deployments
Vercel automatically deploys:
- ✅ Every push to `main` → Production
- ✅ Every PR → Preview deployment
- ✅ Every push to PR → Updated preview

### Branch Protection (Recommended)

In GitHub → Settings → Branches → Add rule for `main`:
- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ✅ Require branches to be up to date

## Environment Variables Reference

### Required Variables

```env
# Supabase (different per environment!)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# App Environment
NEXT_PUBLIC_APP_ENV=production  # or: preview, development
```

### Optional Variables

```env
# Analytics (if using)
NEXT_PUBLIC_ANALYTICS_ID=G-XXXXXXX

# Error tracking (if using)
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Local Development

Create `.env.local` (gitignored):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
NEXT_PUBLIC_APP_ENV=development
```

Run locally:
```bash
npm run dev
```

## Database Migrations

When you update `supabase/schema.sql`:

1. **Test on staging first**
   ```bash
   # Apply to staging Supabase via SQL Editor
   ```

2. **After testing, apply to production**
   ```bash
   # Apply to production Supabase via SQL Editor
   ```

> 💡 Consider using Supabase CLI for migrations in the future:
> ```bash
> supabase db push --db-url postgresql://...
> ```

## Monitoring & Debugging

### Vercel Dashboard
- **Functions tab**: Server-side logs
- **Analytics tab**: Performance metrics
- **Deployments tab**: Build logs

### Supabase Dashboard
- **Table Editor**: View/edit data
- **SQL Editor**: Run queries
- **Logs**: API request logs
- **Auth**: User sessions

### Environment Indicator

The app shows the current environment in development:

```typescript
// Check environment in code
const isProduction = process.env.NEXT_PUBLIC_APP_ENV === 'production';
const isPreview = process.env.NEXT_PUBLIC_APP_ENV === 'preview';
```

## Troubleshooting

### Build Failures
1. Check Vercel build logs
2. Ensure all env vars are set
3. Run `npm run build` locally to test

### Database Connection Issues
1. Verify Supabase URL is correct
2. Check anon key matches project
3. Ensure RLS policies allow access

### Preview Not Updating
1. Check GitHub webhook in repo settings
2. Verify branch is connected to Vercel
3. Try manual redeploy in Vercel dashboard

## Security Checklist

- [ ] Different Supabase projects for staging/production
- [ ] Production data never in staging
- [ ] RLS policies enabled on all tables
- [ ] Service role key NEVER in client code
- [ ] Branch protection on `main`
- [ ] Review PRs before merging to production
