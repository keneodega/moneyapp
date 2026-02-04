/**
 * Financial Health Service
 *
 * Calculates and manages Financial Health Scores based on:
 * - Savings Rate (40 points max)
 * - Debt-to-Income Ratio (30 points max)
 * - Budget Adherence (30 points max)
 *
 * Total possible score: 100 points
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  FinancialHealthScore,
  FinancialHealthScoreInsert,
  HealthScoreLabel,
  BudgetSummary,
  FrequencyType,
} from '@/lib/supabase/database.types';
import { UnauthorizedError } from './errors';
import { LoanService } from './loan.service';

interface MetricScore {
  score: number;
  rawValue: number | null;
}

interface CalculatedScore {
  overallScore: number;
  scoreLabel: HealthScoreLabel;
  savingsRate: MetricScore;
  debtToIncome: MetricScore;
  budgetAdherence: MetricScore;
  totalIncome: number;
  totalSpent: number;
  totalDebtPayments: number;
  monthlyOverviewId: string | null;
}

interface MonthlyFinancialData {
  monthlyOverviewId: string | null;
  totalIncome: number;
  totalSpent: number;
  budgets: BudgetSummary[];
}

export class FinancialHealthService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current authenticated user ID
   */
  private async getUserId(): Promise<string> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return user.id;
  }

  /**
   * Get score label based on overall score
   */
  static getScoreLabel(score: number): HealthScoreLabel {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Very Good';
    if (score >= 60) return 'Good';
    if (score >= 45) return 'Fair';
    if (score >= 30) return 'Needs Improvement';
    return 'Critical';
  }

  /**
   * Get tone/color for score display
   */
  static getScoreTone(
    score: number
  ): 'success' | 'primary' | 'warning' | 'danger' {
    if (score >= 75) return 'success';
    if (score >= 60) return 'primary';
    if (score >= 30) return 'warning';
    return 'danger';
  }

  /**
   * Calculate savings rate score (0-40 points)
   * Savings rate = (income - spent) / income * 100
   */
  private calculateSavingsRateScore(
    income: number,
    spent: number
  ): MetricScore {
    if (income <= 0) {
      return { score: 0, rawValue: null };
    }

    const savingsRate = ((income - spent) / income) * 100;

    let score: number;
    if (savingsRate >= 20) score = 40;
    else if (savingsRate >= 15) score = 35;
    else if (savingsRate >= 10) score = 30;
    else if (savingsRate >= 5) score = 20;
    else if (savingsRate >= 0) score = 10;
    else score = 0; // Negative savings (spending more than earning)

    return {
      score,
      rawValue: Math.round(savingsRate * 100) / 100,
    };
  }

  /**
   * Calculate debt-to-income score (0-30 points)
   * DTI = monthly debt payments / monthly income * 100
   */
  private calculateDebtToIncomeScore(
    income: number,
    debtPayments: number
  ): MetricScore {
    // No debt = full points
    if (debtPayments <= 0) {
      return { score: 30, rawValue: 0 };
    }

    // No income but has debt = worst score
    if (income <= 0) {
      return { score: 0, rawValue: null };
    }

    const dti = (debtPayments / income) * 100;

    let score: number;
    if (dti <= 15) score = 30;
    else if (dti <= 25) score = 25;
    else if (dti <= 35) score = 20;
    else if (dti <= 43) score = 10;
    else score = 0; // Above typical lending threshold

    return {
      score,
      rawValue: Math.round(dti * 100) / 100,
    };
  }

  /**
   * Calculate budget adherence score (0-30 points)
   * Adherence = average of (min(1, budgeted/spent) per budget) * 100
   */
  private calculateBudgetAdherenceScore(budgets: BudgetSummary[]): MetricScore {
    if (budgets.length === 0) {
      return { score: 0, rawValue: null };
    }

    const adherenceRates = budgets.map((budget) => {
      if (budget.amount_spent <= 0) return 1; // No spending = perfect adherence
      if (budget.budget_amount <= 0) return 0; // No budget set = worst adherence
      return Math.min(1, budget.budget_amount / budget.amount_spent);
    });

    const avgAdherence =
      (adherenceRates.reduce((sum, rate) => sum + rate, 0) /
        adherenceRates.length) *
      100;

    let score: number;
    if (avgAdherence >= 95) score = 30;
    else if (avgAdherence >= 85) score = 25;
    else if (avgAdherence >= 75) score = 20;
    else if (avgAdherence >= 60) score = 15;
    else if (avgAdherence >= 50) score = 10;
    else score = 5;

    return {
      score,
      rawValue: Math.round(avgAdherence * 100) / 100,
    };
  }

  /**
   * Get monthly financial data for the current month
   */
  private async getMonthlyFinancialData(
    targetMonth?: Date
  ): Promise<MonthlyFinancialData> {
    const userId = await this.getUserId();
    const month = targetMonth || new Date();

    // Find the monthly overview for the target month
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const expectedName = `${monthNames[month.getMonth()]} ${month.getFullYear()}`;

    const { data: monthlyOverview, error: monthError } = await this.supabase
      .from('monthly_overview_summary')
      .select('*')
      .eq('name', expectedName)
      .single();

    if (monthError || !monthlyOverview) {
      return {
        monthlyOverviewId: null,
        totalIncome: 0,
        totalSpent: 0,
        budgets: [],
      };
    }

    // Get budget details
    const { data: budgets } = await this.supabase
      .from('budget_summary')
      .select('*')
      .eq('monthly_overview_id', monthlyOverview.id);

    return {
      monthlyOverviewId: monthlyOverview.id,
      totalIncome: monthlyOverview.total_income || 0,
      totalSpent: monthlyOverview.total_spent || 0,
      budgets: budgets || [],
    };
  }

  /**
   * Get total monthly debt payments from active loans
   */
  private async getTotalMonthlyDebtPayments(): Promise<number> {
    const loanService = new LoanService(this.supabase);
    return loanService.getTotalMonthlyPayments();
  }

  /**
   * Calculate the financial health score for a given month
   */
  async calculateScore(targetMonth?: Date): Promise<CalculatedScore> {
    const financialData = await this.getMonthlyFinancialData(targetMonth);
    const totalDebtPayments = await this.getTotalMonthlyDebtPayments();

    const savingsRate = this.calculateSavingsRateScore(
      financialData.totalIncome,
      financialData.totalSpent
    );

    const debtToIncome = this.calculateDebtToIncomeScore(
      financialData.totalIncome,
      totalDebtPayments
    );

    const budgetAdherence = this.calculateBudgetAdherenceScore(
      financialData.budgets
    );

    const overallScore =
      savingsRate.score + debtToIncome.score + budgetAdherence.score;

    return {
      overallScore,
      scoreLabel: FinancialHealthService.getScoreLabel(overallScore),
      savingsRate,
      debtToIncome,
      budgetAdherence,
      totalIncome: financialData.totalIncome,
      totalSpent: financialData.totalSpent,
      totalDebtPayments,
      monthlyOverviewId: financialData.monthlyOverviewId,
    };
  }

  /**
   * Get the stored score for a specific month
   */
  async getScoreForMonth(month: Date): Promise<FinancialHealthScore | null> {
    const userId = await this.getUserId();
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await this.supabase
      .from('financial_health_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('calculated_for_month', monthStr)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Get score history for the last N months
   */
  async getScoreHistory(months: number = 12): Promise<FinancialHealthScore[]> {
    const userId = await this.getUserId();

    const { data, error } = await this.supabase
      .from('financial_health_scores')
      .select('*')
      .eq('user_id', userId)
      .order('calculated_for_month', { ascending: false })
      .limit(months);

    if (error) {
      console.error('Error fetching score history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Save or update a health score
   */
  async saveScore(
    score: Omit<FinancialHealthScoreInsert, 'user_id'>
  ): Promise<FinancialHealthScore> {
    const userId = await this.getUserId();

    const { data, error } = await this.supabase
      .from('financial_health_scores')
      .upsert(
        {
          ...score,
          user_id: userId,
        },
        {
          onConflict: 'user_id,calculated_for_month',
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save health score: ${error.message}`);
    }

    return data;
  }

  /**
   * Update AI recommendations for a score
   */
  async updateRecommendations(
    scoreId: string,
    recommendations: FinancialHealthScore['ai_recommendations']
  ): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('financial_health_scores')
      .update({
        ai_recommendations: recommendations,
        recommendations_generated_at: new Date().toISOString(),
      })
      .eq('id', scoreId);

    if (error) {
      throw new Error(`Failed to update recommendations: ${error.message}`);
    }
  }

  /**
   * Check if we need to regenerate recommendations
   * Returns true if no recommendations exist or they're older than 24 hours
   */
  static shouldRegenerateRecommendations(
    score: FinancialHealthScore
  ): boolean {
    if (!score.ai_recommendations || !score.recommendations_generated_at) {
      return true;
    }

    const generatedAt = new Date(score.recommendations_generated_at);
    const now = new Date();
    const hoursSinceGeneration =
      (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceGeneration > 24;
  }
}
