# Uptime Monitoring Setup

This guide covers setting up external uptime monitoring to ensure your production app is always available.

## Why Uptime Monitoring?

While Vercel provides excellent monitoring, external uptime monitoring provides:
- **Independent verification** of your app's availability
- **Alerting** when your app goes down (even if Vercel dashboard is down)
- **Historical uptime statistics** for SLA reporting
- **Multiple monitoring locations** to catch regional issues

## Recommended Services

### 1. UptimeRobot (Free Tier)

**Best for**: Small to medium applications, free tier available

**Setup**:
1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Create a new monitor:
   - **Monitor Type**: HTTP(s)
   - **URL**: Your production URL (e.g., `https://yourapp.vercel.app`)
   - **Monitoring Interval**: 5 minutes (free tier)
   - **Alert Contacts**: Add your email/SMS/Slack
3. Configure alerts:
   - Email notifications
   - SMS (paid plans)
   - Slack integration (paid plans)
   - PagerDuty integration (paid plans)

**Free Tier Limits**:
- 50 monitors
- 5-minute check interval
- Email alerts only

### 2. Pingdom (Paid)

**Best for**: Enterprise applications, detailed reporting

**Features**:
- 1-minute check intervals
- Multiple monitoring locations
- Transaction monitoring
- Real user monitoring
- Detailed analytics

**Pricing**: Starts at $10/month

### 3. StatusCake (Free Tier)

**Best for**: Multiple sites, advanced features

**Free Tier**:
- 10 uptime tests
- 5-minute intervals
- Email/SMS alerts
- Status pages

### 4. Better Uptime (Paid)

**Best for**: Modern apps, beautiful status pages

**Features**:
- 30-second check intervals
- Beautiful status pages
- Incident management
- Team collaboration

**Pricing**: Starts at $10/month

## Recommended Setup: UptimeRobot

### Step 1: Create Account

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up for a free account
3. Verify your email

### Step 2: Add Monitor

1. Click **"Add New Monitor"**
2. Configure:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: "Family Money Tracker - Production"
   - **URL**: `https://yourapp.vercel.app`
   - **Monitoring Interval**: 5 minutes
   - **Alert Contacts**: Select your email

3. Click **"Create Monitor"**

### Step 3: Configure Alerts

1. Go to **My Settings → Alert Contacts**
2. Add alert contacts:
   - **Email**: Your primary email
   - **SMS** (optional, paid): Your phone number
   - **Slack** (optional, paid): Webhook URL

3. Go to **My Monitors → [Your Monitor] → Edit**
4. Select alert contacts for:
   - **When Up**: Optional (notify when recovered)
   - **When Down**: Required (notify immediately)

### Step 4: Test Alert

1. Temporarily break your app (or use a test URL)
2. Verify you receive an alert
3. Fix the issue
4. Verify you receive a recovery alert

## Advanced Configuration

### Multiple Monitoring Locations

For better coverage, set up monitors from different regions:

1. **Primary Monitor**: Your main production URL
2. **Health Check Endpoint**: Create a dedicated health check route

### Health Check Endpoint

Create a simple health check endpoint:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Optional: Check database connection
  // const supabase = await createSupabaseServerClient();
  // const { error } = await supabase.from('monthly_overviews').select('id').limit(1);
  
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
```

Then monitor: `https://yourapp.vercel.app/api/health`

### Status Page

UptimeRobot provides a free status page:

1. Go to **My Settings → Public Status Pages**
2. Create a new status page
3. Add your monitors
4. Share the public URL with your team

## Alerting Best Practices

### Alert Channels

1. **Email**: Primary channel for all alerts
2. **SMS**: Critical alerts only (paid plans)
3. **Slack**: Team notifications (paid plans)
4. **PagerDuty**: On-call rotation (enterprise)

### Alert Frequency

- **Down Alert**: Immediate (as soon as detected)
- **Up Alert**: Optional (notify when recovered)
- **Avoid Alert Fatigue**: Don't alert on every check, only on state changes

### Alert Content

Configure alerts to include:
- Monitor name
- URL being monitored
- Status (Up/Down)
- Response time
- Timestamp

## Monitoring Checklist

- [ ] Uptime monitor configured for production URL
- [ ] Health check endpoint created (optional)
- [ ] Email alerts configured
- [ ] Test alert received and verified
- [ ] Status page created (optional)
- [ ] Team notified of monitoring setup
- [ ] Monitoring dashboard bookmarked

## Integration with Vercel

### Vercel Analytics

Vercel provides built-in analytics:
- Go to **Vercel Dashboard → Project → Analytics**
- Enable **Web Analytics**
- View real-time metrics

### Combining Both

- **UptimeRobot**: External availability monitoring
- **Vercel Analytics**: Performance and usage metrics
- **Sentry**: Error tracking and performance

## Troubleshooting

### False Positives

If you get false positive alerts:
1. Check if your app is actually down
2. Verify DNS is resolving correctly
3. Check if monitoring location can reach your app
4. Review alert thresholds

### Missing Alerts

If you're not receiving alerts:
1. Check spam folder
2. Verify email address in alert contacts
3. Check alert contact is selected for the monitor
4. Test alert manually

## Cost Comparison

| Service | Free Tier | Paid Plans |
|---------|-----------|------------|
| UptimeRobot | ✅ 50 monitors, 5-min intervals | $7/month for 1-min intervals |
| StatusCake | ✅ 10 tests, 5-min intervals | $20/month for advanced |
| Pingdom | ❌ | $10/month |
| Better Uptime | ❌ | $10/month |

## Recommended Setup for This App

1. **Start with UptimeRobot** (free tier)
   - Monitor production URL
   - Set up email alerts
   - Create status page

2. **Upgrade if needed**:
   - If you need 1-minute checks → Upgrade UptimeRobot
   - If you need multiple locations → Consider Pingdom
   - If you need beautiful status page → Consider Better Uptime

## Resources

- [UptimeRobot Documentation](https://uptimerobot.com/api/)
- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Status Page Best Practices](https://www.atlassian.com/incident-management/status-pages/best-practices)

---

**Last Updated**: [Date]
**Status**: ✅ Ready to Configure
