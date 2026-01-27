/**
 * Reports Service
 * 
 * Handles data aggregation and analysis for reports and analytics.
 * 
 * Provides:
 * - Spending trends over time
 * - Category breakdowns
 * - Year-over-year comparisons
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { UnauthorizedError } from './errors';

export interface SpendingTrendDataPoint {
  period: string; // e.g., "2025-01", "2025-Q1", "2025"
  month?: number;
  quarter?: number;
  year: number;
  totalSpent: number;
  totalIncome: number;
  totalBudgeted: number;
  savings: number;
}

export interface CategoryBreakdownData {
  category: string;
  totalSpent: number;
  totalBudgeted: number;
  percentage: number;
  transactionCount: number;
}

export interface YearOverYearData {
  year: number;
  totalSpent: number;
  totalIncome: number;
  totalBudgeted: number;
  savings: number;
  averageMonthlySpending: number;
  topCategories: Array<{
    category: string;
    amount: number;
  }>;
}

export type TimePeriod = 'month' | 'quarter' | 'year';
export type DateRange = {
  startDate: string;
  endDate: string;
};

export class ReportsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current authenticated user ID
   * @throws UnauthorizedError if user is not authenticated
   */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return user.id;
  }

  /**
   * Get spending trends over time
   * @param period - Grouping period (month, quarter, year)
   * @param dateRange - Optional date range filter
   */
  async getSpendingTrends(
    period: TimePeriod = 'month',
    dateRange?: DateRange
  ): Promise<SpendingTrendDataPoint[]> {
    const userId = await this.getUserId();

    // Build date filter
    let dateFilter = '';
    if (dateRange) {
      dateFilter = `AND e.date >= '${dateRange.startDate}' AND e.date <= '${dateRange.endDate}'`;
    }

    // Build period grouping SQL
    let periodGroup: string;
    let periodLabel: string;
    
    switch (period) {
      case 'quarter':
        periodGroup = `DATE_TRUNC('quarter', e.date)`;
        periodLabel = `TO_CHAR(${periodGroup}, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM ${periodGroup})`;
        break;
      case 'year':
        periodGroup = `DATE_TRUNC('year', e.date)`;
        periodLabel = `TO_CHAR(${periodGroup}, 'YYYY')`;
        break;
      default: // month
        periodGroup = `DATE_TRUNC('month', e.date)`;
        periodLabel = `TO_CHAR(${periodGroup}, 'YYYY-MM')`;
    }

    // Query expenses grouped by period
    const expensesQuery = `
      SELECT 
        ${periodLabel} as period,
        EXTRACT(MONTH FROM ${periodGroup})::INTEGER as month,
        EXTRACT(QUARTER FROM ${periodGroup})::INTEGER as quarter,
        EXTRACT(YEAR FROM ${periodGroup})::INTEGER as year,
        COALESCE(SUM(e.amount), 0) as total_spent
      FROM expenses e
      INNER JOIN budgets b ON b.id = e.budget_id
      INNER JOIN monthly_overviews mo ON mo.id = b.monthly_overview_id
      WHERE mo.user_id = $1 ${dateFilter}
      GROUP BY ${periodGroup}
      ORDER BY ${periodGroup} ASC
    `;

    // Query income grouped by period
    const incomeQuery = `
      SELECT 
        ${periodLabel} as period,
        EXTRACT(MONTH FROM ${periodGroup})::INTEGER as month,
        EXTRACT(QUARTER FROM ${periodGroup})::INTEGER as quarter,
        EXTRACT(YEAR FROM ${periodGroup})::INTEGER as year,
        COALESCE(SUM(inc.amount), 0) as total_income
      FROM income_sources inc
      INNER JOIN monthly_overviews mo ON mo.id = inc.monthly_overview_id
      WHERE mo.user_id = $1 ${dateFilter}
      GROUP BY ${periodGroup}
      ORDER BY ${periodGroup} ASC
    `;

    // Query budgets grouped by period
    const budgetsQuery = `
      SELECT 
        ${periodLabel} as period,
        EXTRACT(MONTH FROM ${periodGroup})::INTEGER as month,
        EXTRACT(QUARTER FROM ${periodGroup})::INTEGER as quarter,
        EXTRACT(YEAR FROM ${periodGroup})::INTEGER as year,
        COALESCE(SUM(b.budget_amount), 0) as total_budgeted
      FROM budgets b
      INNER JOIN monthly_overviews mo ON mo.id = b.monthly_overview_id
      WHERE mo.user_id = $1 ${dateFilter}
      GROUP BY ${periodGroup}
      ORDER BY ${periodGroup} ASC
    `;

    // Use direct queries to aggregate data
    const { data: expensesData } = await this.supabase
      .from('expenses')
      .select(`
        amount,
        date,
        budget:budgets!inner(
          monthly_overview:monthly_overviews!inner(user_id)
        )
      `)
      .eq('budget.monthly_overview.user_id', userId);

    const { data: incomeData } = await this.supabase
      .from('income_sources')
      .select(`
        amount,
        date_paid,
        monthly_overview:monthly_overviews!inner(user_id)
      `)
      .eq('monthly_overview.user_id', userId);

    const { data: budgetsData } = await this.supabase
      .from('budgets')
      .select(`
        budget_amount,
        monthly_overview:monthly_overviews!inner(user_id, start_date, end_date)
      `)
      .eq('monthly_overview.user_id', userId);

    // Process and aggregate data
    const periodMap = new Map<string, SpendingTrendDataPoint>();

    // Process expenses
    if (expensesData) {
      expensesData.forEach((expense: any) => {
        if (dateRange && (expense.date < dateRange.startDate || expense.date > dateRange.endDate)) {
          return;
        }
        const date = new Date(expense.date);
        const periodLabel = this.getPeriodLabel(date, period);
        const key = periodLabel;

        if (!periodMap.has(key)) {
          periodMap.set(key, {
            period: periodLabel,
            month: date.getMonth() + 1,
            quarter: Math.floor(date.getMonth() / 3) + 1,
            year: date.getFullYear(),
            totalSpent: 0,
            totalIncome: 0,
            totalBudgeted: 0,
            savings: 0,
          });
        }

        const point = periodMap.get(key)!;
        point.totalSpent += parseFloat(expense.amount) || 0;
      });
    }

    // Process income
    if (incomeData) {
      incomeData.forEach((income: any) => {
        if (dateRange && (income.date_paid < dateRange.startDate || income.date_paid > dateRange.endDate)) {
          return;
        }
        const date = new Date(income.date_paid);
        const periodLabel = this.getPeriodLabel(date, period);
        const key = periodLabel;

        if (!periodMap.has(key)) {
          periodMap.set(key, {
            period: periodLabel,
            month: date.getMonth() + 1,
            quarter: Math.floor(date.getMonth() / 3) + 1,
            year: date.getFullYear(),
            totalSpent: 0,
            totalIncome: 0,
            totalBudgeted: 0,
            savings: 0,
          });
        }

        const point = periodMap.get(key)!;
        point.totalIncome += parseFloat(income.amount) || 0;
      });
    }

    // Process budgets
    if (budgetsData) {
      budgetsData.forEach((budget: any) => {
        const monthStart = new Date(budget.monthly_overview.start_date);
        const periodLabel = this.getPeriodLabel(monthStart, period);
        const key = periodLabel;

        if (!periodMap.has(key)) {
          periodMap.set(key, {
            period: periodLabel,
            month: monthStart.getMonth() + 1,
            quarter: Math.floor(monthStart.getMonth() / 3) + 1,
            year: monthStart.getFullYear(),
            totalSpent: 0,
            totalIncome: 0,
            totalBudgeted: 0,
            savings: 0,
          });
        }

        const point = periodMap.get(key)!;
        point.totalBudgeted += parseFloat(budget.budget_amount) || 0;
      });
    }

    // Calculate savings and sort
    const trends = Array.from(periodMap.values()).map((point) => ({
      ...point,
      savings: point.totalIncome - point.totalSpent,
    }));

    return trends.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (period === 'quarter' && a.quarter !== b.quarter) return a.quarter! - b.quarter!;
      if (period === 'month' && a.month !== b.month) return a.month! - b.month!;
      return 0;
    });
  }

  /**
   * Get category breakdown
   * @param dateRange - Optional date range filter
   */
  async getCategoryBreakdown(dateRange?: DateRange): Promise<CategoryBreakdownData[]> {
    const userId = await this.getUserId();

    let query = this.supabase
      .from('expenses')
      .select(`
        amount,
        date,
        budget:budgets!inner(
          name,
          budget_amount,
          monthly_overview:monthly_overviews!inner(user_id)
        )
      `)
      .eq('budget.monthly_overview.user_id', userId);

    if (dateRange) {
      query = query
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate);
    }

    const { data: expenses, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch expenses: ${error.message}`);
    }

    // Aggregate by category
    const categoryMap = new Map<string, { spent: number; budgeted: number; count: number }>();

    expenses?.forEach((expense: any) => {
      const category = expense.budget?.name || 'Unknown';
      const amount = parseFloat(expense.amount) || 0;
      const budgeted = parseFloat(expense.budget?.budget_amount) || 0;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { spent: 0, budgeted: 0, count: 0 });
      }

      const cat = categoryMap.get(category)!;
      cat.spent += amount;
      cat.budgeted += budgeted;
      cat.count += 1;
    });

    // Calculate total for percentages
    const totalSpent = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.spent, 0);

    // Convert to array and calculate percentages
    const breakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      totalSpent: data.spent,
      totalBudgeted: data.budgeted,
      percentage: totalSpent > 0 ? (data.spent / totalSpent) * 100 : 0,
      transactionCount: data.count,
    }));

    return breakdown.sort((a, b) => b.totalSpent - a.totalSpent);
  }

  /**
   * Get year-over-year comparison
   * @param years - Array of years to compare (defaults to last 3 years)
   */
  async getYearOverYearComparison(years?: number[]): Promise<YearOverYearData[]> {
    const userId = await this.getUserId();

    // Get all expenses with budget and month info
    const { data: expenses } = await this.supabase
      .from('expenses')
      .select(`
        amount,
        date,
        budget:budgets!inner(
          name,
          monthly_overview:monthly_overviews!inner(user_id, start_date, end_date)
        )
      `)
      .eq('budget.monthly_overview.user_id', userId);

    // Get all income
    const { data: income } = await this.supabase
      .from('income_sources')
      .select(`
        amount,
        date_paid,
        monthly_overview:monthly_overviews!inner(user_id, start_date, end_date)
      `)
      .eq('monthly_overview.user_id', userId);

    // Get all budgets
    const { data: budgets } = await this.supabase
      .from('budgets')
      .select(`
        budget_amount,
        name,
        monthly_overview:monthly_overviews!inner(user_id, start_date, end_date)
      `)
      .eq('monthly_overview.user_id', userId);

    // Determine years to analyze
    const allYears = new Set<number>();
    expenses?.forEach((e: any) => {
      const year = new Date(e.date).getFullYear();
      allYears.add(year);
    });
    income?.forEach((i: any) => {
      const year = new Date(i.date_paid).getFullYear();
      allYears.add(year);
    });

    const yearsToAnalyze = years || Array.from(allYears).sort((a, b) => b - a).slice(0, 3);

    // Aggregate by year
    const yearData = new Map<number, YearOverYearData>();

    yearsToAnalyze.forEach((year) => {
      yearData.set(year, {
        year,
        totalSpent: 0,
        totalIncome: 0,
        totalBudgeted: 0,
        savings: 0,
        averageMonthlySpending: 0,
        topCategories: [],
      });
    });

    // Process expenses
    expenses?.forEach((expense: any) => {
      const year = new Date(expense.date).getFullYear();
      if (yearData.has(year)) {
        const data = yearData.get(year)!;
        data.totalSpent += parseFloat(expense.amount) || 0;
      }
    });

    // Process income
    income?.forEach((inc: any) => {
      const year = new Date(inc.date_paid).getFullYear();
      if (yearData.has(year)) {
        const data = yearData.get(year)!;
        data.totalIncome += parseFloat(inc.amount) || 0;
      }
    });

    // Process budgets
    budgets?.forEach((budget: any) => {
      const year = new Date(budget.monthly_overview.start_date).getFullYear();
      if (yearData.has(year)) {
        const data = yearData.get(year)!;
        data.totalBudgeted += parseFloat(budget.budget_amount) || 0;
      }
    });

    // Calculate savings, averages, and top categories
    yearData.forEach((data, year) => {
      data.savings = data.totalIncome - data.totalSpent;
      
      // Count months with expenses
      const monthsWithExpenses = new Set<number>();
      expenses?.forEach((e: any) => {
        const expenseYear = new Date(e.date).getFullYear();
        if (expenseYear === year) {
          monthsWithExpenses.add(new Date(e.date).getMonth());
        }
      });
      const monthCount = monthsWithExpenses.size || 12;
      data.averageMonthlySpending = data.totalSpent / monthCount;

      // Get top categories for this year
      const categoryMap = new Map<string, number>();
      expenses?.forEach((e: any) => {
        const expenseYear = new Date(e.date).getFullYear();
        if (expenseYear === year) {
          const category = e.budget?.name || 'Unknown';
          const amount = parseFloat(e.amount) || 0;
          categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
        }
      });

      data.topCategories = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
    });

    return Array.from(yearData.values()).sort((a, b) => a.year - b.year);
  }

  /**
   * Helper to get period label
   */
  private getPeriodLabel(date: Date, period: TimePeriod): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.floor(date.getMonth() / 3) + 1;

    switch (period) {
      case 'quarter':
        return `${year}-Q${quarter}`;
      case 'year':
        return `${year}`;
      default:
        return `${year}-${String(month).padStart(2, '0')}`;
    }
  }
}
