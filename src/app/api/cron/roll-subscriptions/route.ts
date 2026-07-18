import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { SubscriptionService } from '@/lib/services/subscription.service';

/**
 * Nightly cron: roll every Active subscription whose next_collection_date is in
 * the past forward to its next future occurrence (and clear paid_this_period).
 *
 * Display bookkeeping only — it does NOT assert any payment was made. Configure
 * in vercel.json; Vercel sends `Authorization: Bearer ${CRON_SECRET}` when
 * CRON_SECRET is set, which is the only thing that authorises this route.
 *
 * This is a deliberate service-role surface: the cron has no user session, so it
 * uses SUPABASE_SERVICE_ROLE_KEY to update every user's subscriptions. The route
 * performs a fixed, side-effect-bounded operation and never reads user input.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const service = new SubscriptionService(supabase);

  try {
    const rolled = await service.rollForwardStaleCollectionDates();
    return NextResponse.json({ ok: true, rolled });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
