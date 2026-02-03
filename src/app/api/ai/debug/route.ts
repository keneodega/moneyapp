import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'No authenticated user found',
        userError: userError?.message
      }, { status: 401 });
    }

    // Get all monthly overviews for this user
    const { data: months, error: monthsError } = await supabase
      .from('monthly_overviews')
      .select('id, name, start_date, end_date, user_id')
      .order('start_date', { ascending: false });

    // Get current month's budgets count
    const febMonth = months?.find(m => m.name === 'February 2026');
    let budgetCount = 0;
    let expenseCount = 0;

    if (febMonth) {
      const { count: bCount } = await supabase
        .from('budgets')
        .select('*', { count: 'exact', head: true })
        .eq('monthly_overview_id', febMonth.id);
      budgetCount = bCount || 0;

      // Get expenses for this month's budgets
      const { data: budgets } = await supabase
        .from('budgets')
        .select('id')
        .eq('monthly_overview_id', febMonth.id);

      if (budgets?.length) {
        const { count: eCount } = await supabase
          .from('expenses')
          .select('*', { count: 'exact', head: true })
          .in('budget_id', budgets.map(b => b.id));
        expenseCount = eCount || 0;
      }
    }

    // Check the view
    const { data: viewData, error: viewError } = await supabase
      .from('monthly_overview_summary')
      .select('*')
      .eq('name', 'February 2026')
      .single();

    return NextResponse.json({
      authenticatedUser: {
        id: user.id,
        email: user.email,
      },
      dataCreatedWithUserId: '5b53d910-46ee-4873-8624-1e89bbd5a0e9',
      userIdMatch: user.id === '5b53d910-46ee-4873-8624-1e89bbd5a0e9',
      monthlyOverviews: {
        count: months?.length || 0,
        data: months,
        error: monthsError?.message,
      },
      february2026: {
        found: !!febMonth,
        budgetCount,
        expenseCount,
        viewData,
        viewError: viewError?.message,
      },
      currentDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: String(error) },
      { status: 500 }
    );
  }
}
