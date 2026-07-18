/**
 * Build the assistant's financial context server-side for a given user.
 *
 * Mirrors what AIAssistantProvider gathers in the browser, but takes an explicit
 * userId so it works under a service-role client with no session (the Telegram
 * webhook). Every query is scoped to userId.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssistantContext } from './assistant';

export async function buildFinancialContext(
  supabase: SupabaseClient,
  userId: string
): Promise<AssistantContext> {
  const today = new Date().toISOString().split('T')[0];

  // Current month by date range. limit(1) + order so a boundary overlap can't throw.
  const { data: monthRows } = await supabase
    .from('monthly_overviews')
    .select('id, name, start_date, end_date')
    .eq('user_id', userId)
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: false })
    .limit(1);

  let month = monthRows?.[0] ?? null;
  if (!month) {
    const { data: recent } = await supabase
      .from('monthly_overviews')
      .select('id, name, start_date, end_date')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(1);
    month = recent?.[0] ?? null;
  }
  if (!month) return { currentDate: today };

  const [budgets, income, goals, subs, loans, debtors, settings, prevMonth] = await Promise.all([
    supabase.from('budget_summary').select('id, name, budget_amount, amount_spent, amount_left').eq('monthly_overview_id', month.id).order('name'),
    supabase.from('income_sources').select('id, source, amount').eq('monthly_overview_id', month.id),
    supabase.from('financial_goals').select('id, name, target_amount, current_amount').eq('user_id', userId),
    supabase.from('subscriptions').select('name, amount, next_collection_date').eq('user_id', userId).eq('status', 'Active'),
    supabase.from('loans').select('id, name, current_balance, monthly_payment, next_payment_date').eq('user_id', userId).eq('status', 'Active'),
    supabase.from('debtors').select('id, debtor_name, amount_owed').eq('user_id', userId).neq('status', 'Paid Off'),
    supabase.from('app_settings').select('value').eq('user_id', userId).eq('setting_type', 'payment_method').eq('is_active', true),
    supabase.from('monthly_overview_summary').select('name, total_income, total_budgeted, total_spent').eq('user_id', userId).lt('end_date', month.start_date).order('end_date', { ascending: false }).limit(1),
  ]);

  const subItems = (subs.data ?? []).map((s) => ({ name: s.name as string, amount: Number(s.amount), next_date: (s.next_collection_date as string) ?? '' }));
  const monthlyTotal = subItems.reduce((sum, s) => sum + s.amount, 0);

  return {
    currentDate: today,
    monthName: month.name,
    monthlyOverviewId: month.id,
    monthDateRange: { start_date: month.start_date, end_date: month.end_date },
    budgets: (budgets.data ?? []).map((b) => ({ id: b.id, name: b.name, budget_amount: Number(b.budget_amount), amount_spent: Number(b.amount_spent), amount_left: Number(b.amount_left) })),
    incomeSources: (income.data ?? []).map((i) => ({ id: i.id, source: i.source, amount: Number(i.amount) })),
    goals: (goals.data ?? []).map((g) => ({ id: g.id, name: g.name, target_amount: Number(g.target_amount), current_amount: Number(g.current_amount) })),
    subscriptions: { count: subItems.length, monthlyTotal, items: subItems.slice(0, 20) },
    loans: (loans.data ?? []).map((l) => ({ id: l.id, name: l.name, current_balance: Number(l.current_balance), monthly_payment: Number(l.monthly_payment), next_payment_date: l.next_payment_date ?? null })),
    debtors: (debtors.data ?? []).map((d) => ({ id: d.id, name: d.debtor_name, amount_owed: Number(d.amount_owed) })),
    paymentMethods: (settings.data ?? []).map((s) => s.value as string),
    previousMonth: prevMonth.data?.[0]
      ? { name: prevMonth.data[0].name, total_income: Number(prevMonth.data[0].total_income), total_spent: Number(prevMonth.data[0].total_spent), total_budgeted: Number(prevMonth.data[0].total_budgeted) }
      : null,
  };
}
