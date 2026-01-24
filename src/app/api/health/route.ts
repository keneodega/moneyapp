import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Health check endpoint for uptime monitoring
 * 
 * Returns 200 OK if the app and database are healthy.
 * Used by external monitoring services (UptimeRobot, etc.)
 */
export async function GET() {
  try {
    // Optional: Check database connection
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('monthly_overviews')
      .select('id')
      .limit(1);

    if (error) {
      // Database connection issue
      return NextResponse.json(
        {
          status: 'degraded',
          database: 'unavailable',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    // Unexpected error
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
