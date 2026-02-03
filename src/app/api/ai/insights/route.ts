import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Schema for a single insight
const InsightSchema = z.object({
  type: z.enum(['warning', 'success', 'info', 'tip']).describe('The type of insight'),
  title: z.string().describe('Short title for the insight (max 10 words)'),
  message: z.string().describe('The insight message with specific numbers (max 25 words)'),
  category: z.string().describe('Related budget category if applicable, or empty string if not applicable'),
  priority: z.number().min(1).max(5).describe('Priority 1-5, where 1 is most important'),
});

// Schema for all insights
const InsightsResponseSchema = z.object({
  insights: z.array(InsightSchema).max(5).describe('List of 3-5 actionable financial insights'),
});

export async function GET(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current and previous month dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    console.log('AI Insights - Date range:', { currentMonthStart, currentMonthEnd, userId: user.id });

    // Fetch current month data
    const { data: currentMonth, error: monthError } = await supabase
      .from('monthly_overview_summary')
      .select('*')
      .gte('start_date', currentMonthStart)
      .lte('start_date', currentMonthEnd)
      .single();

    console.log('AI Insights - Current month query result:', { currentMonth, monthError });

    // If no current month found by date, try by name (e.g., "February 2026")
    let currentMonthData = currentMonth;
    if (!currentMonthData) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const expectedName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      console.log('AI Insights - Trying name fallback:', expectedName);

      const { data: monthByName, error: nameError } = await supabase
        .from('monthly_overview_summary')
        .select('*')
        .eq('name', expectedName)
        .single();

      console.log('AI Insights - Name fallback result:', { monthByName, nameError });
      currentMonthData = monthByName;
    }

    // Fetch previous month data
    const { data: prevMonth } = await supabase
      .from('monthly_overview_summary')
      .select('*')
      .gte('start_date', prevMonthStart)
      .lte('start_date', prevMonthEnd)
      .single();

    // Fetch current month budgets with spending
    const { data: budgets } = await supabase
      .from('budget_summary')
      .select('*')
      .eq('monthly_overview_id', currentMonthData?.id || '')
      .order('name');

    // Fetch previous month budgets for comparison
    const { data: prevBudgets } = await supabase
      .from('budget_summary')
      .select('*')
      .eq('monthly_overview_id', prevMonth?.id || '')
      .order('name');

    // Fetch active subscriptions
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active');

    // Fetch financial goals
    const { data: goals } = await supabase
      .from('financial_goals')
      .select('*')
      .in('status', ['not_started', 'in_progress']);

    // Calculate days remaining in month
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();
    const daysRemaining = daysInMonth - daysPassed;
    const monthProgress = (daysPassed / daysInMonth) * 100;

    // Prepare summary for AI
    const financialSummary = {
      currentMonth: currentMonthData ? {
        name: currentMonthData.name,
        totalIncome: currentMonthData.total_income || 0,
        totalBudgeted: currentMonthData.total_budgeted || 0,
        totalSpent: currentMonthData.total_spent || 0,
        unallocated: currentMonthData.amount_unallocated || 0,
      } : null,
      previousMonth: prevMonth ? {
        name: prevMonth.name,
        totalIncome: prevMonth.total_income || 0,
        totalBudgeted: prevMonth.total_budgeted || 0,
        totalSpent: prevMonth.total_spent || 0,
      } : null,
      budgets: (budgets || []).map(b => ({
        name: b.name,
        budgeted: b.budget_amount,
        spent: b.amount_spent || 0,
        remaining: b.amount_left || 0,
        utilizationPercent: b.budget_amount > 0 ? Math.round(((b.amount_spent || 0) / b.budget_amount) * 100) : 0,
      })),
      previousBudgets: (prevBudgets || []).map(b => ({
        name: b.name,
        spent: b.amount_spent || 0,
      })),
      subscriptions: {
        count: subscriptions?.length || 0,
        monthlyTotal: subscriptions?.reduce((sum, s) => {
          const amount = s.amount || 0;
          switch (s.frequency) {
            case 'weekly': return sum + (amount * 4.33);
            case 'bi_weekly': return sum + (amount * 2.17);
            case 'monthly': return sum + amount;
            case 'quarterly': return sum + (amount / 3);
            case 'bi_annually': return sum + (amount / 6);
            case 'annually': return sum + (amount / 12);
            default: return sum + amount;
          }
        }, 0) || 0,
      },
      goals: (goals || []).map(g => ({
        name: g.name,
        targetAmount: g.target_amount,
        currentAmount: g.current_amount || 0,
        progressPercent: g.target_amount > 0 ? Math.round(((g.current_amount || 0) / g.target_amount) * 100) : 0,
      })),
      timing: {
        daysPassed,
        daysRemaining,
        monthProgressPercent: Math.round(monthProgress),
      },
    };

    // If no data, return empty insights
    if (!currentMonthData) {
      console.log('AI Insights - No current month data found');
      return NextResponse.json({
        insights: [{
          type: 'info',
          title: 'No data yet',
          message: 'Create your first monthly budget to get personalized insights.',
          priority: 1,
        }],
      });
    }

    console.log('AI Insights - Found data, generating insights for:', currentMonthData.name);

    // Generate insights with AI
    console.log('AI Insights - Calling OpenAI API...');
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: InsightsResponseSchema,
      prompt: `You are a personal finance advisor analyzing a user's budget data. Generate 3-5 actionable, specific insights based on their financial situation.

Financial Data:
${JSON.stringify(financialSummary, null, 2)}

Guidelines:
- Be specific with numbers (use € currency, round to whole numbers)
- Compare current month vs previous month when relevant
- Flag budgets that are overspent or on track to overspend
- Highlight unallocated funds that could go to savings/goals
- Note positive trends (under budget, good savings progress)
- Consider the timing (${daysPassed} days passed, ${daysRemaining} days remaining)
- For budgets, if utilizationPercent > monthProgressPercent, they're spending faster than expected

Insight types:
- "warning": Overspending, budget at risk, negative trends
- "success": Good progress, under budget, positive trends
- "info": Neutral observations, comparisons
- "tip": Actionable suggestions for improvement

Prioritize the most impactful insights. Be concise and actionable.`,
    });

    return NextResponse.json({
      insights: object.insights.sort((a, b) => a.priority - b.priority),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('AI insights error:', error);
    // Return more detailed error in development
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = process.env.NODE_ENV === 'development' ? errorMessage : 'Failed to generate insights';
    return NextResponse.json(
      { error: errorDetails },
      { status: 500 }
    );
  }
}
