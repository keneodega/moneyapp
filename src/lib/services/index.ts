/**
 * Family Money Tracker - Service Layer
 * 
 * This module exports all services that enforce business rules.
 * 
 * IMPORTANT: All data operations should go through these services
 * to ensure business rules are enforced. Do not bypass the service
 * layer by calling Supabase directly for create/update operations.
 * 
 * Business Rules Enforced:
 * 
 * 1. MonthlyOverviewService:
 *    - Auto-creates 12 default budget categories when a month is created
 * 
 * 2. ExpenseService:
 *    - Expense date must be within the monthly overview date range
 *    - Expense cannot cause overspending (negative budget amount left)
 * 
 * 3. BudgetService:
 *    - Budget amounts must be non-negative
 * 
 * 4. IncomeSourceService:
 *    - Income amounts must be positive
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

// Export services
export { MonthlyOverviewService, DEFAULT_BUDGET_CATEGORIES } from './monthly-overview.service';
export { ExpenseService } from './expense.service';
export { BudgetService } from './budget.service';
export { IncomeSourceService } from './income-source.service';
export { FinancialGoalService } from './financial-goal.service';
export { SubscriptionService } from './subscription.service';

// Export error types for handling
export {
  ServiceError,
  ExpenseDateOutOfRangeError,
  OverspendingError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors';

// Export pure validation functions for testing and reuse
export {
  validateExpenseDateWithinMonth,
  validateNoOverspending,
  validateDateRange,
  validatePositiveAmount,
  validateNonNegativeAmount,
  calculateBudgetSummary,
  calculateMonthlyOverviewSummary,
  DEFAULT_BUDGET_CATEGORIES as DEFAULT_CATEGORIES,
  DEFAULT_TOTAL_BUDGET,
} from './validators';

// Export types
export type { } from './errors';

/**
 * Factory function to create all services with a Supabase client
 * Use this for convenience when you need multiple services
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { MonthlyOverviewService } from './monthly-overview.service';
import { ExpenseService } from './expense.service';
import { BudgetService } from './budget.service';
import { IncomeSourceService } from './income-source.service';
import { FinancialGoalService } from './financial-goal.service';
import { SubscriptionService } from './subscription.service';

export interface Services {
  monthlyOverview: MonthlyOverviewService;
  expense: ExpenseService;
  budget: BudgetService;
  incomeSource: IncomeSourceService;
  financialGoal: FinancialGoalService;
  subscription: SubscriptionService;
}

export function createServices(supabase: SupabaseClient): Services {
  return {
    monthlyOverview: new MonthlyOverviewService(supabase),
    expense: new ExpenseService(supabase),
    budget: new BudgetService(supabase),
    incomeSource: new IncomeSourceService(supabase),
    financialGoal: new FinancialGoalService(supabase),
    subscription: new SubscriptionService(supabase),
  };
}
