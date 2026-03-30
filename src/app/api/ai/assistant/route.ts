import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const AssistantResponseSchema = z.object({
  intent: z.enum([
    'add_expense', 'add_income', 'add_debtor', 'create_transfer',
    'budget_check', 'month_overview', 'compare_months', 'top_expenses',
    'subscription_summary', 'loan_summary', 'goal_progress',
    'forecast', 'upcoming_bills', 'debtor_summary', 'general',
  ]).describe('The detected intent of the user message'),
  has_action: z.boolean().describe('True if this is a data entry intent with a parsed action, false for read-only intents'),
  action_type: z.string().describe('The action type: "expense", "income", "debtor", "transfer", or empty string if read-only'),
  action_amount: z.number().describe('The monetary amount in euros, or 0 if read-only'),
  action_target_id: z.string().describe('The UUID of the matched entity (budget_id, goal_id, etc.), or empty string'),
  action_target_name: z.string().describe('The display name of the matched entity, or empty string'),
  action_date: z.string().describe('The date in YYYY-MM-DD format, or empty string if read-only'),
  action_description: z.string().describe('A brief description of the transaction, or empty string'),
  action_bank: z.string().describe('Payment method if mentioned, or empty string'),
  action_secondary_target_id: z.string().describe('For transfers: the second entity UUID, or empty string'),
  action_secondary_target_name: z.string().describe('For transfers: the second entity display name, or empty string'),
  action_confidence: z.number().describe('Confidence in the match (0-1). Below 0.7 means ambiguous. 0 if read-only.'),
  message: z.string().describe('A friendly, concise response message to show the user. Use euro currency symbol. Keep under 200 words.'),
  data_points: z.array(z.object({
    label: z.string().describe('The metric label (e.g., "Food Budget", "Total Spent")'),
    value: z.string().describe('The formatted value (e.g., "€232.50", "72%")'),
    status: z.enum(['good', 'warning', 'danger', 'neutral']).describe('Visual status indicator'),
  })).describe('Structured data points for read-only intents. Empty array for data entry intents.'),
  warnings: z.array(z.string()).describe('Any warnings (overspending risk, approaching limits, etc.). Empty array if none.'),
  suggestions: z.array(z.string()).describe('1-2 follow-up suggestions the user might want to do next'),
});

// Restructure the flat response into the nested format the UI expects
export interface AssistantResponse {
  intent: string;
  action: {
    type: string;
    amount: number;
    target_id: string;
    target_name: string;
    date: string;
    description: string | null;
    bank: string | null;
    secondary_target_id: string | null;
    secondary_target_name: string | null;
    confidence: number;
  } | null;
  message: string;
  data_points: Array<{ label: string; value: string; status: string }> | null;
  warnings: string[];
  suggestions: string[];
}

function toNestedResponse(flat: z.infer<typeof AssistantResponseSchema>): AssistantResponse {
  return {
    intent: flat.intent,
    action: flat.has_action ? {
      type: flat.action_type,
      amount: flat.action_amount,
      target_id: flat.action_target_id,
      target_name: flat.action_target_name,
      date: flat.action_date,
      description: flat.action_description || null,
      bank: flat.action_bank || null,
      secondary_target_id: flat.action_secondary_target_id || null,
      secondary_target_name: flat.action_secondary_target_name || null,
      confidence: flat.action_confidence,
    } : null,
    message: flat.message,
    data_points: flat.data_points.length > 0 ? flat.data_points : null,
    warnings: flat.warnings,
    suggestions: flat.suggestions,
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, context } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const now = new Date();
    const daysInMonth = context?.monthDateRange
      ? Math.ceil((new Date(context.monthDateRange.end_date).getTime() - new Date(context.monthDateRange.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 30;
    const daysPassed = context?.monthDateRange
      ? Math.ceil((now.getTime() - new Date(context.monthDateRange.start_date).getTime()) / (1000 * 60 * 60 * 24))
      : now.getDate();
    const daysRemaining = Math.max(0, daysInMonth - daysPassed);

    const systemPrompt = `You are a helpful financial assistant for a personal budgeting app. You help users track expenses, income, and manage their finances through natural language.

CURRENT DATE: ${context?.currentDate || now.toISOString().split('T')[0]}
CURRENT MONTH: ${context?.monthName || 'Unknown'}
MONTH DATE RANGE: ${context?.monthDateRange?.start_date || 'N/A'} to ${context?.monthDateRange?.end_date || 'N/A'}
DAYS PASSED: ${daysPassed} | DAYS REMAINING: ${daysRemaining} | MONTH PROGRESS: ${Math.round((daysPassed / daysInMonth) * 100)}%

AVAILABLE BUDGETS (with remaining amounts):
${context?.budgets?.map((b: { id: string; name: string; budget_amount: number; amount_spent: number; amount_left: number }) =>
  `- "${b.name}" (ID: ${b.id}) | Budgeted: €${b.budget_amount} | Spent: €${b.amount_spent} | Remaining: €${b.amount_left}`
).join('\n') || 'No budgets available'}

INCOME SOURCES THIS MONTH:
${context?.incomeSources?.map((i: { id: string; source: string; amount: number }) =>
  `- ${i.source}: €${i.amount}`
).join('\n') || 'No income recorded yet'}

SAVINGS GOALS:
${context?.goals?.map((g: { id: string; name: string; target_amount: number; current_amount: number }) =>
  `- "${g.name}" (ID: ${g.id}) | Target: €${g.target_amount} | Current: €${g.current_amount} | Progress: ${g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0}%`
).join('\n') || 'No goals set'}

SUBSCRIPTIONS:
Count: ${context?.subscriptions?.count || 0} | Monthly total: €${context?.subscriptions?.monthlyTotal?.toFixed(2) || '0.00'}
${context?.subscriptions?.items?.map((s: { name: string; amount: number; next_date: string }) =>
  `- ${s.name}: €${s.amount} (next: ${s.next_date})`
).join('\n') || ''}

LOANS:
${context?.loans?.map((l: { id: string; name: string; current_balance: number; monthly_payment: number; next_payment_date: string | null }) =>
  `- "${l.name}" (ID: ${l.id}) | Balance: €${l.current_balance} | Payment: €${l.monthly_payment}/mo${l.next_payment_date ? ` | Next: ${l.next_payment_date}` : ''}`
).join('\n') || 'No loans'}

DEBTORS (people who owe the user money):
${context?.debtors?.map((d: { id: string; name: string; amount_owed: number }) =>
  `- "${d.name}" (ID: ${d.id}) | Owes: €${d.amount_owed}`
).join('\n') || 'No debtors'}

PAYMENT METHODS: ${context?.paymentMethods?.join(', ') || 'Revolut, AIB, Cash'}

PREVIOUS MONTH: ${context?.previousMonth ? `${context.previousMonth.name} — Income: €${context.previousMonth.total_income}, Spent: €${context.previousMonth.total_spent}, Budgeted: €${context.previousMonth.total_budgeted}` : 'No previous month data'}

RULES:
1. For expense entry: match the user's description to the closest budget category from AVAILABLE BUDGETS. Use the budget's UUID as action_target_id. If the match is ambiguous (confidence < 0.7), ask the user to clarify in the message. Set has_action to true.
2. For income entry: set action_target_id to the monthly overview ID "${context?.monthlyOverviewId || ''}". Parse source type from context (Salary, Freelance, Gift, Investment, Rental, Business, Government, Other). Set has_action to true.
3. For debtor entry: set action_target_id to empty string (new debtor). Parse the person's name into action_target_name and amount. Set has_action to true.
4. For transfers: set action_target_id as the source and action_secondary_target_id as the destination. Set has_action to true.
5. Default date to today (${context?.currentDate || now.toISOString().split('T')[0]}) unless the user specifies otherwise. "Yesterday" = subtract 1 day. "Last Friday" = calculate the date.
6. If user mentions a payment method, set action_bank to the closest match from PAYMENT METHODS. Otherwise empty string.
7. For read-only intents (budget_check, month_overview, etc.): set has_action to false, all action_ fields to empty/0, and populate data_points with relevant metrics.
8. For budget_check: provide specific numbers about the requested budget's spending, remaining amount, and pace.
9. For forecast: calculate if current spending pace will exceed budget by month end.
10. Always use € currency. Be concise and friendly. No more than 200 words in message.
11. If the amount exceeds the budget's remaining amount, include a warning about overspending.
12. Always include 1-2 helpful follow-up suggestions.`;

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: AssistantResponseSchema,
      prompt: `${systemPrompt}\n\nUser message: "${message}"`,
    });

    return NextResponse.json(toNestedResponse(object));
  } catch (error) {
    console.error('AI assistant error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
