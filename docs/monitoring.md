# Monitoring and Error Tracking

This guide covers Sentry setup and monitoring for the Family Money Tracker application.

## Overview

**Goal**: See failures immediately, rather than discovering them days later.

**Tools**:
- **Sentry**: Error tracking and performance monitoring
- **Custom Logging**: Lightweight logging for key money events

## Sentry Setup

### 1. Create Sentry Account and Project

1. **Sign up for Sentry**
   - Go to [sentry.io](https://sentry.io)
   - Create a free account (or use existing)
   - Free tier includes: 5,000 events/month

2. **Create a Project**
   - Click "Create Project"
   - Platform: **Next.js**
   - Project Name: `money-app` (or your choice)
   - Team: Select or create a team

3. **Get Your DSN**
   - After creating the project, you'll see your DSN
   - Format: `https://xxx@xxx.ingest.sentry.io/xxx`
   - Copy this - you'll need it for environment variables

### 2. Configure Environment Variables

Add to your `.env.local` (development):

```env
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=money-app
```

Add to **Vercel Environment Variables**:

#### Production
| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Your Sentry DSN | Production |
| `SENTRY_ORG` | Your org slug | Production |
| `SENTRY_PROJECT` | `money-app` | Production |

#### Preview
| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Your Sentry DSN | Preview |
| `SENTRY_ORG` | Your org slug | Preview |
| `SENTRY_PROJECT` | `money-app` | Preview |

> **Note**: You can use the same Sentry project for all environments, or create separate projects for staging/production.

### 3. Configure Sentry Org and Project

Update `.sentryclirc`:

```json
{
  "defaults": {
    "org": "your-org-slug",
    "project": "money-app"
  }
}
```

### 4. Verify Setup

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Visit the test error page**:
   ```
   http://localhost:3000/test-error
   ```

3. **Trigger a test error**:
   - Click "Trigger Client Error"
   - Check your Sentry dashboard
   - You should see the error appear within seconds

## What Gets Tracked

### Automatic Error Tracking

Sentry automatically captures:
- ✅ **Unhandled exceptions** (client and server)
- ✅ **API route errors**
- ✅ **React component errors**
- ✅ **Async errors**
- ✅ **Network errors**

### Custom Money Event Logging

The app logs key money events:

1. **Expense Created** (`expense.created`)
   - Expense ID, amount, budget, date
   - User ID, monthly overview ID

2. **Income Created** (`income.created`)
   - Income ID, amount, source, person
   - User ID, monthly overview ID
   - Tithe deduction flag

3. **Month Created** (`month.created`)
   - Monthly overview ID, name, date range
   - User ID, number of budgets created

### Error Context

All errors include:
- User ID (if authenticated)
- Environment (development/preview/production)
- Request metadata
- Breadcrumbs (user actions leading to error)

## Monitoring Key Events

### View Events in Sentry

1. **Go to Sentry Dashboard**
   - Navigate to your project
   - Click "Issues" to see errors
   - Click "Performance" to see transactions

2. **Filter by Event Type**
   - Search: `event_type:money_event`
   - See all money events (expense/income/month created)

3. **Set Up Alerts**
   - Go to **Alerts** → **Create Alert Rule**
   - Example: Alert if error rate > 5% in last hour
   - Example: Alert if no income events in 24 hours (unusual)

### Key Metrics to Monitor

| Metric | What It Means | Alert Threshold |
|--------|---------------|-----------------|
| **Error Rate** | % of requests that error | > 1% |
| **Expense Events** | Number of expenses created | < 10/day (unusual) |
| **Income Events** | Number of income entries | < 1/day (unusual) |
| **Month Events** | Number of months created | > 1/day (unusual) |

## Testing Error Tracking

### Test Page

Visit `/test-error` to test different error types:

1. **Client Error**: Synchronous error in browser
2. **Async Error**: Error in async function
3. **Server Error**: Error in API route
4. **Money Event**: Test money event logging

### Manual Testing

```typescript
// In any component or API route
import * as Sentry from '@sentry/nextjs';

// Test error capture
try {
  throw new Error('Test error');
} catch (error) {
  Sentry.captureException(error);
}
```

## Production Best Practices

### 1. Sample Rates

Current configuration:
- **Development**: 100% of errors captured
- **Production**: 10% of errors captured (to stay within free tier)

Adjust in `sentry.client.config.ts`:
```typescript
tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 0.1 : 1.0,
```

### 2. Source Maps

Source maps are automatically uploaded during build:
- Helps debug minified production code
- Shows original file names and line numbers

### 3. Session Replay

Session Replay is enabled:
- Records user sessions when errors occur
- Helps understand what led to the error
- Masked for privacy (text and media hidden)

### 4. Error Filtering

Filter out known/expected errors:

```typescript
// In sentry.client.config.ts
beforeSend(event, hint) {
  // Filter out expected errors
  if (event.exception?.values?.[0]?.value?.includes('Expected error')) {
    return null; // Don't send to Sentry
  }
  return event;
}
```

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN is set**:
   ```bash
   echo $NEXT_PUBLIC_SENTRY_DSN
   ```

2. **Check Sentry is initialized**:
   - Look for Sentry logs in console (development)
   - Check `sentry.client.config.ts` is imported

3. **Check network requests**:
   - Open browser DevTools → Network
   - Look for requests to `sentry.io`
   - Check for CORS or network errors

### Too Many Events

If you're hitting rate limits:
- Reduce `tracesSampleRate` in production
- Add error filtering in `beforeSend`
- Upgrade Sentry plan

### Source Maps Not Working

1. **Check build includes source maps**:
   ```bash
   npm run build
   # Check for .map files in .next/
   ```

2. **Verify Sentry upload**:
   - Check Sentry dashboard → Settings → Source Maps
   - Should see uploaded source maps

## Integration with CI/CD

Sentry uploads source maps during build. This happens automatically in:
- ✅ Local builds (`npm run build`)
- ✅ Vercel deployments
- ✅ GitHub Actions (if configured)

## Cost Considerations

### Free Tier Limits

- **5,000 events/month**
- **1,000 performance transactions/month**
- **1,000 replay sessions/month**

### Staying Within Limits

- Use sample rates (10% in production)
- Filter expected errors
- Monitor usage in Sentry dashboard

### Upgrading

If you exceed limits:
- **Team Plan**: $26/month (50K events)
- **Business Plan**: $80/month (250K events)

## Next Steps

1. ✅ **Set up Sentry account and project**
2. ✅ **Add DSN to environment variables**
3. ✅ **Test error capture** (visit `/test-error`)
4. ✅ **Verify events in Sentry dashboard**
5. ✅ **Set up alerts** for critical errors
6. ✅ **Monitor money events** to track usage

## Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io)
- [Error Tracking Best Practices](https://docs.sentry.io/product/best-practices/)

---

**Last Updated**: [Date]
**Sentry Project**: [Your Project Name]
**Status**: ✅ Configured / ⚠️ Pending Setup / ❌ Not Configured
