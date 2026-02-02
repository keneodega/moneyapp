import Link from 'next/link';
import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, BudgetProgress, PieChart } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SubscriptionService } from '@/lib/services';

// Code splitting: Load these components dynamically
const IncomeList = dynamic(() => import('./IncomeList').then(mod => ({ default: mod.IncomeList })), {
  loading: () => <div className="p-8 text-center text-small text-[var(--color-text-muted)]">Loading income...</div>,
});

const MonthActions = dynamic(() => import('./MonthActions').then(mod => ({ default: mod.MonthActions })), {
  loading: () => <div className="text-small text-[var(--color-text-muted)]">Loading actions...</div>,
});

const FundGoalButton = dynamic(() => import('./FundGoalButton').then(mod => ({ default: mod.FundGoalButton })), {
  loading: () => <div className="text-small text-[var(--color-text-muted)]">Loading...</div>,
});

const TransferButton = dynamic(() => import('./TransferButton').then(mod => ({ default: mod.TransferButton })), {
  loading: () => <div className="text-small text-[var(--color-text-muted)]">Loading...</div>,
});

const BudgetCategoriesList = dynamic(
  () => import('./BudgetCategoriesList').then(mod => ({ default: mod.BudgetCategoriesList })),
  { loading: () => <div className="p-4 text-small text-[var(--color-text-muted)]">Loading budgets...</div> },
);

interface MonthData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  total_income?: number;
  total_budgeted?: number;
  amount_unallocated?: number;
}

interface BudgetData {
  id: string;
  name: string;
  budget_amount: number;
  amount_spent: number;
  amount_left: number;
  percent_used?: number;
  override_amount?: number | null;
  master_budget?: { budget_amount: number; name: string } | null;
}

interface IncomeData {
  id: string;
  source: string;
  person?: string;
  amount: number;
  date_paid: string;
}

interface PreviousMonthData {
  id: string;
  name: string;
  total_income: number;
  total_budgeted: number;
  total_spent: number;
  budgetsByName: Record<string, { amount_spent: number; budget_amount: number }>;
}

async function getMonthData(id: string): Promise<{
  month: MonthData;
  budgets: BudgetData[];
  income: IncomeData[];
  totalGoalContributions: number;
  previousMonth: PreviousMonthData | null;
  totalFixed: number;
  totalVariable: number;
  totalSubscriptions: number;
} | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    // Parallelize independent queries for better performance
    const [baseMonthResult, incomeResult, budgetResult, contributionsResult] = await Promise.all([
      supabase
        .from('monthly_overviews')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('income_sources')
        .select('amount')
        .eq('monthly_overview_id', id),
      supabase
        .from('budgets')
        .select('budget_amount')
        .eq('monthly_overview_id', id),
      supabase
        .from('goal_contributions')
        .select('amount')
        .eq('monthly_overview_id', id),
    ]);

    const { data: baseMonth, error: baseError } = baseMonthResult;
    const { data: incomeAmounts, error: incomeError } = incomeResult;
    const { data: budgetAmounts, error: budgetsError } = budgetResult;
    const { data: contributions, error: contributionsError } = contributionsResult;

    if (baseError || !baseMonth) {
      return null;
    }

    // Calculate totals manually
    if (incomeError) {
      console.error(`Error fetching income for month ${id}:`, incomeError);
    }
    
    const totalIncome = incomeAmounts && !incomeError
      ? incomeAmounts.reduce((sum, i) => {
          const amount = typeof i.amount === 'string' ? parseFloat(i.amount) : Number(i.amount || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0)
      : 0;
    
    if (budgetsError) {
      console.error(`Error fetching budgets for month ${id}:`, budgetsError);
    }
    
    const totalBudgeted = budgetAmounts && !budgetsError
      ? budgetAmounts.reduce((sum, b) => {
          const amount = typeof b.budget_amount === 'string' ? parseFloat(b.budget_amount) : Number(b.budget_amount || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0)
      : 0;

    const month = {
      ...baseMonth,
      total_income: totalIncome,
      total_budgeted: totalBudgeted,
      total_spent: 0, // Will be calculated from budget_summary below
      amount_unallocated: totalIncome - totalBudgeted,
    };

    // Fetch budget_summary (transfer-aware amount_spent, amount_left) and budgets with master_budget
    const [summaryResult, budgetsWithMasterResult] = await Promise.all([
      supabase
        .from('budget_summary')
        .select('id, amount_spent, amount_left, percent_used')
        .eq('monthly_overview_id', id),
      supabase
        .from('budgets')
        .select(`
          *,
          master_budget:master_budgets(budget_amount, name, budget_type)
        `)
        .eq('monthly_overview_id', id)
        .order('name'),
    ]);

    const { data: summaryRows } = summaryResult;
    const { data: budgetsWithMaster, error: budgetsWithMasterError } = budgetsWithMasterResult;

    let budgetsData: any[] | null = null;
    if (budgetsWithMasterError) {
      console.error(`Error fetching budgets with master_budget join for month ${id}:`, budgetsWithMasterError);
      const { data: budgetsWithoutMaster, error: noJoinErr } = await supabase
        .from('budgets')
        .select('*')
        .eq('monthly_overview_id', id)
        .order('name');
      if (!noJoinErr && budgetsWithoutMaster) budgetsData = budgetsWithoutMaster;
    } else {
      budgetsData = budgetsWithMaster;
    }

    const summaryByBudgetId = new Map<string, { amount_spent: number; amount_left: number; percent_used: number }>();
    for (const row of summaryRows || []) {
      const spent = typeof row.amount_spent === 'string' ? parseFloat(row.amount_spent) : Number(row.amount_spent ?? 0);
      const left = typeof row.amount_left === 'string' ? parseFloat(row.amount_left) : Number(row.amount_left ?? 0);
      const pct = typeof row.percent_used === 'string' ? parseFloat(row.percent_used) : Number(row.percent_used ?? 0);
      summaryByBudgetId.set(row.id, {
        amount_spent: isNaN(spent) ? 0 : spent,
        amount_left: isNaN(left) ? 0 : left,
        percent_used: isNaN(pct) ? 0 : pct,
      });
    }

    const budgets = (budgetsData || []).map((budget) => {
      const summary = summaryByBudgetId.get(budget.id);
      const amount_spent = summary?.amount_spent ?? 0;
      const amount_left = summary != null ? summary.amount_left : Number(budget.budget_amount) - amount_spent;
      const percent_used = summary?.percent_used ?? (Number(budget.budget_amount) > 0 ? (amount_spent / Number(budget.budget_amount)) * 100 : 0);
      const effectiveAmount = Number(budget.override_amount ?? budget.budget_amount ?? 0);
      return {
        id: budget.id,
        monthly_overview_id: budget.monthly_overview_id,
        name: budget.name,
        budget_amount: budget.budget_amount,
        amount_spent,
        amount_left,
        percent_used,
        description: budget.description,
        master_budget_id: budget.master_budget_id,
        override_amount: budget.override_amount,
        override_reason: budget.override_reason,
        master_budget: budget.master_budget,
        created_at: budget.created_at,
        updated_at: budget.updated_at,
        effectiveAmount,
        budget_type: budget.master_budget?.budget_type ?? 'Variable',
      };
    });

    // Compute fixed vs variable totals
    let totalFixed = 0;
    let totalVariable = 0;
    for (const b of budgets) {
      const amt = b.effectiveAmount;
      if (b.budget_type === 'Fixed') {
        totalFixed += amt;
      } else {
        totalVariable += amt;
      }
    }

    // Fetch income
    const { data: income } = await supabase
      .from('income_sources')
      .select('*')
      .eq('monthly_overview_id', id)
      .order('date_paid', { ascending: false });

    // Calculate total spent from budgets
    const totalSpent = budgets && budgets.length > 0
      ? budgets.reduce((sum, b) => {
          const amount = typeof b.amount_spent === 'string' ? parseFloat(b.amount_spent) : Number(b.amount_spent || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0)
      : 0;

    // Calculate total goal contributions
    if (contributionsError) {
      console.error(`Error fetching goal contributions for month ${id}:`, contributionsError);
    }
    
    const totalGoalContributions = contributions && !contributionsError
      ? contributions.reduce((sum, c) => {
          const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : Number(c.amount || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0)
      : 0;

    // Update month with total_spent
    month.total_spent = totalSpent;

    // Fetch previous month for comparison (same user, start_date < current)
    let previousMonth: PreviousMonthData | null = null;
    const { data: prevMonthRow } = await supabase
      .from('monthly_overviews')
      .select('id, name, start_date, end_date')
      .lt('start_date', baseMonth.start_date)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (prevMonthRow) {
      const prevId = prevMonthRow.id;
      const [prevIncomeRes, prevBudgetsRes, prevSummaryRes] = await Promise.all([
        supabase
          .from('income_sources')
          .select('amount')
          .eq('monthly_overview_id', prevId),
        supabase
          .from('budgets')
          .select('id, name, budget_amount')
          .eq('monthly_overview_id', prevId),
        supabase
          .from('budget_summary')
          .select('id, amount_spent')
          .eq('monthly_overview_id', prevId),
      ]);

      const prevTotalIncome =
        prevIncomeRes.data && !prevIncomeRes.error
          ? prevIncomeRes.data.reduce((s, i) => s + Number(i.amount || 0), 0)
          : 0;
      const prevTotalBudgeted =
        prevBudgetsRes.data && !prevBudgetsRes.error
          ? prevBudgetsRes.data.reduce((s, b) => s + Number(b.budget_amount || 0), 0)
          : 0;
      const prevSummaryMap = new Map<string, number>();
      for (const row of prevSummaryRes.data || []) {
        prevSummaryMap.set(row.id, Number(row.amount_spent || 0));
      }
      const prevBudgetsByName: Record<string, { amount_spent: number; budget_amount: number }> = {};
      let prevTotalSpent = 0;
      for (const b of prevBudgetsRes.data || []) {
        const spent = prevSummaryMap.get(b.id) ?? 0;
        prevTotalSpent += spent;
        prevBudgetsByName[b.name] = {
          amount_spent: spent,
          budget_amount: Number(b.budget_amount || 0),
        };
      }

      previousMonth = {
        id: prevMonthRow.id,
        name: prevMonthRow.name,
        total_income: prevTotalIncome,
        total_budgeted: prevTotalBudgeted,
        total_spent: prevTotalSpent,
        budgetsByName: prevBudgetsByName,
      };
    }

    // Total subscriptions due this month (monthly equivalent cost)
    let totalSubscriptions = 0;
    try {
      const subscriptionService = new SubscriptionService(supabase);
      totalSubscriptions = await subscriptionService.getTotalMonthlyCostForDateRange(
        baseMonth.start_date,
        baseMonth.end_date
      );
    } catch {
      // Non-fatal; leave at 0
    }

    return {
      month,
      budgets: budgets || [],
      income: income || [],
      totalGoalContributions,
      previousMonth,
      totalFixed,
      totalVariable,
      totalSubscriptions,
    };
  } catch {
    return null;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IE', {
    month: 'short',
    day: 'numeric',
  });
}

export default async function MonthDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMonthData(id);
  
  if ( !data) {
    notFound();
  }

  const { month, budgets, income, totalGoalContributions, previousMonth, totalFixed, totalVariable, totalSubscriptions } = data;
  
  // Use totals from view (more accurate than manual calculation)
  const totalIncome = month.total_income || 0;
  const totalBudgeted = month.total_budgeted || 0;
  // Unallocated = income minus budgets minus subscriptions minus goal contributions
  const unallocated = (month.total_income || 0) - (month.total_budgeted || 0) - (totalSubscriptions || 0) - (totalGoalContributions || 0);
  
  // Calculate spent from budgets (view provides this per budget)
  const totalSpent = (budgets || []).reduce((sum, b) => sum + Number(b?.amount_spent || 0), 0);
  const spentPercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  // Month-over-month changes
  const pctChange = (curr: number, prev: number) =>
    prev !== 0 ? (((curr - prev) / prev) * 100) : (curr !== 0 ? 100 : 0);
  const overallIncomeChange = previousMonth ? pctChange(totalIncome, previousMonth.total_income) : null;
  const overallBudgetedChange = previousMonth ? pctChange(totalBudgeted, previousMonth.total_budgeted) : null;
  const overallSpentChange = previousMonth ? pctChange(totalSpent, previousMonth.total_spent) : null;

  // Pie chart data: budget amounts (allocation) per category
  const pieData = (budgets || []).map((b) => ({
    name: b.name,
    value: Number(b.override_amount ?? b.budget_amount ?? 0),
  })).filter((d) => d.value > 0);

  // Fixed budgets + subscriptions: total budget minus Tithe, Offering, Drawdown, plus subscriptions
  const EXCLUDE_FROM_FIXED_BUDGETS = ['tithe', 'offering', 'drawdown'];
  const excludedFromFixed = (budgets || []).reduce((sum, b) => {
    const name = (b.name || '').trim().toLowerCase();
    if (EXCLUDE_FROM_FIXED_BUDGETS.includes(name)) {
      return sum + Number(b.override_amount ?? b.budget_amount ?? 0);
    }
    return sum;
  }, 0);
  const fixedBudgetsPlusSubscriptions = totalBudgeted - excludedFromFixed + (totalSubscriptions ?? 0);

  // Income breakdown: budget, subscriptions, goal contributions, unallocated
  const subsTotal = totalSubscriptions ?? 0;
  const goalTotal = totalGoalContributions ?? 0;
  const unallocatedTotal = totalIncome - totalBudgeted - subsTotal - goalTotal;
  const incomeBreakdownData = [
    { name: 'Budget', value: totalBudgeted },
    { name: 'Subscriptions', value: subsTotal },
    { name: 'Goal contributions', value: goalTotal },
    { name: 'Unallocated', value: Math.max(0, unallocatedTotal) },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/months"
            className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
          </Link>
          <div>
            <h1 className="text-display text-[var(--color-text)]">{month.name}</h1>
            <p className="text-body text-[var(--color-text-muted)] mt-1">
              {formatDate(month.start_date)} - {formatDate(month.end_date)}
            </p>
          </div>
        </div>
        <MonthActions monthId={id} monthName={month.name} />
      </div>

      {/* Dashboard Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {/* Total Income */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Total Income</p>
              <p className="text-headline text-[var(--color-success)] mt-1 tabular-nums">
                {formatCurrency(totalIncome)}
              </p>
              {overallIncomeChange != null && (
                <p className={`text-caption mt-0.5 ${overallIncomeChange > 0 ? 'text-[var(--color-success)]' : overallIncomeChange < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                  {overallIncomeChange > 0 ? '↑' : overallIncomeChange < 0 ? '↓' : ''} {overallIncomeChange > 0 ? '+' : ''}{overallIncomeChange.toFixed(1)}% vs {previousMonth?.name}
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-success)]/10 flex items-center justify-center">
              <ArrowUpIcon className="w-5 h-5 text-[var(--color-success)]" />
            </div>
          </div>
        </Card>

        {/* Total Budgeted */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Total Budgeted</p>
              <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
                {formatCurrency(totalBudgeted)}
              </p>
              {overallBudgetedChange != null && (
                <p className={`text-caption mt-0.5 ${overallBudgetedChange > 0 ? 'text-[var(--color-warning)]' : overallBudgetedChange < 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                  {overallBudgetedChange > 0 ? '↑' : overallBudgetedChange < 0 ? '↓' : ''} {overallBudgetedChange > 0 ? '+' : ''}{overallBudgetedChange.toFixed(1)}% vs {previousMonth?.name}
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 flex items-center justify-center">
              <PieChartIcon className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
          </div>
        </Card>

        {/* Fixed budgets + Subscriptions (excludes Tithe, Offering, Drawdown) */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Budget + Subscriptions</p>
              <p className="text-caption text-[var(--color-text-subtle)] mt-0.5">Fixed categories + subscriptions</p>
              <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
                {formatCurrency(fixedBudgetsPlusSubscriptions)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 flex items-center justify-center">
              <PieChartIcon className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
          </div>
        </Card>

        {/* Budget breakdown: Fixed + Variable */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-2">
          <p className="text-small text-[var(--color-text-muted)] mb-2">Budget breakdown</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-body text-[var(--color-text-muted)]">Fixed</span>
              <span className="text-body font-medium text-[var(--color-text)] tabular-nums">
                {formatCurrency(totalFixed ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-[var(--color-text-muted)]">Variable</span>
              <span className="text-body font-medium text-[var(--color-text)] tabular-nums">
                {formatCurrency(totalVariable ?? 0)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
              <span className="text-small font-medium text-[var(--color-text)]">Total</span>
              <span className="text-small font-semibold text-[var(--color-text)] tabular-nums">
                {formatCurrency(totalBudgeted)}
              </span>
            </div>
          </div>
        </Card>

        {/* Total Spent */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Total Spent</p>
              <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
                {formatCurrency(totalSpent)}
              </p>
              <p className="text-caption text-[var(--color-text-subtle)] mt-1">
                {spentPercent.toFixed(0)}% of budget
              </p>
              {overallSpentChange != null && (
                <p className={`text-caption mt-0.5 ${overallSpentChange > 0 ? 'text-[var(--color-warning)]' : overallSpentChange < 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                  {overallSpentChange > 0 ? '↑' : overallSpentChange < 0 ? '↓' : ''} {overallSpentChange > 0 ? '+' : ''}{overallSpentChange.toFixed(1)}% vs {previousMonth?.name}
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 flex items-center justify-center">
              <CreditCardIcon className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
          </div>
        </Card>

        {/* Total Subscriptions */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Subscriptions</p>
              <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
                {formatCurrency(totalSubscriptions ?? 0)}
              </p>
              <p className="text-caption text-[var(--color-text-subtle)] mt-1">
                Due this month
              </p>
            </div>
            <Link href="/subscriptions" className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 flex items-center justify-center hover:bg-[var(--color-primary)]/20 transition-colors">
              <RepeatIcon className="w-5 h-5 text-[var(--color-primary)]" />
            </Link>
          </div>
        </Card>

        {/* Unallocated */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Unallocated</p>
              <p className={`text-headline mt-1 tabular-nums ${
                unallocated >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'
              }`}>
                {formatCurrency(unallocated)}
              </p>
              <p className="text-caption text-[var(--color-text-subtle)] mt-1">
                {unallocated >= 0 ? 'Available to budget' : 'Over-budgeted'}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center ${
              unallocated >= 0 ? 'bg-[var(--color-accent)]/10' : 'bg-[var(--color-danger)]/10'
            }`}>
              <BanknoteIcon className={`w-5 h-5 ${
                unallocated >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'
              }`} />
            </div>
          </div>
        </Card>

        {/* Goal Contributions */}
        <Link href="/goals">
          <Card variant="raised" padding="md" className="animate-slide-up stagger-5 hover:border-[var(--color-primary)]/30 transition-colors cursor-pointer">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-small text-[var(--color-text-muted)]">Goal Contributions</p>
                <p className="text-headline text-[var(--color-primary)] mt-1 tabular-nums">
                  {formatCurrency(totalGoalContributions)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 flex items-center justify-center">
                <TargetIcon className="w-5 h-5 text-[var(--color-primary)]" />
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Budget Categories + Pie Chart */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-title text-[var(--color-text)]">Budget Categories</h2>
              <p className="text-small text-[var(--color-text-muted)] mt-1">
                Select budgets from <Link href="/master-budgets" className="text-[var(--color-primary)] hover:underline">Master Budgets</Link>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/months/${id}/budgets/select`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] text-small font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Budget
              </Link>
              <Link
                href={`/months/${id}/expense/new`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-small font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Expense
              </Link>
            </div>
          </div>

          {/* Budget allocation pie chart */}
          {pieData.length > 0 && (
            <Card variant="outlined" padding="md">
              <h3 className="text-small font-medium text-[var(--color-text-muted)] mb-4">
                Budget allocation
              </h3>
              <PieChart
                data={pieData}
                showLegend={true}
                showLabels={false}
                height={360}
                innerRadius={70}
                outerRadius={120}
              />
            </Card>
          )}

          {/* Income breakdown pie chart */}
          {incomeBreakdownData.length > 0 && totalIncome > 0 && (
            <Card variant="outlined" padding="md">
              <h3 className="text-small font-medium text-[var(--color-text-muted)] mb-4">
                Income breakdown
              </h3>
              <PieChart
                data={incomeBreakdownData}
                showLegend={true}
                showLabels={false}
                height={360}
                innerRadius={70}
                outerRadius={120}
              />
            </Card>
          )}
          
          {budgets && budgets.length > 0 ? (
            <BudgetCategoriesList
              budgets={budgets}
              monthId={id}
              previousBudgetsByName={previousMonth?.budgetsByName ?? undefined}
            />
          ) : (
            <Card variant="outlined" padding="lg" className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
                <PieChartIcon className="w-6 h-6 text-[var(--color-text-subtle)]" />
              </div>
              <h3 className="text-title text-[var(--color-text)] mb-2">No budgets yet</h3>
              <p className="text-body text-[var(--color-text-muted)] mb-4">
                Create budget categories to start tracking your spending.
              </p>
              <Link
                href={`/months/${id}/budgets/select`}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Select Budgets
              </Link>
            </Card>
          )}
        </div>

        {/* Income Sidebar */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-title text-[var(--color-text)]">Income</h2>
            </div>
            
            {/* Action Buttons - Grouped by category */}
            <div className="flex flex-col gap-3">
              {/* Goal Actions - Grouped together with visual separator */}
              <div className="flex items-center gap-2 flex-wrap">
                <FundGoalButton monthId={id} />
                <TransferButton monthId={id} />
              </div>
              
              {/* Add Income Action - Full width on mobile, auto on larger screens */}
              <Link
                href={`/months/${id}/income/new`}
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-small font-medium hover:bg-[var(--color-accent-dark)] transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Income
              </Link>
            </div>
          </div>
          
          <Card variant="outlined" padding="none">
            <IncomeList income={income} monthId={id} />
          </Card>

          {/* Quick Stats */}
          <Card variant="default" padding="md" className="bg-gradient-warm">
            <h3 className="text-small font-medium text-[var(--color-text-muted)] mb-4">
              Month Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Days remaining</span>
                <span className="text-small font-medium text-[var(--color-text)]">
                  {Math.max(0, Math.ceil((new Date(month.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Budgets on track</span>
                <span className="text-small font-medium text-[var(--color-success)]">
                  {(budgets || []).filter((b: any) => (b?.amount_left || 0) >= 0).length} / {budgets?.length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Avg. daily spend</span>
                <span className="text-small font-medium text-[var(--color-text)]">
                  {formatCurrency(totalSpent / Math.max(1, Math.ceil((new Date().getTime() - new Date(month.start_date).getTime()) / (1000 * 60 * 60 * 24))))}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Icons
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
    </svg>
  );
}

function PieChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

function BanknoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
    </svg>
  );
}
