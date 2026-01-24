/**
 * Pure validation functions for business rules
 * These can be unit tested without Supabase dependencies
 * 
 * Replicates Salesforce validation rules:
 * - ExpenseDate_WithinMonthlyOverview
 * - Prevent_Overspending
 * - Date range validations
 */

import { ValidationError, OverspendingError as OverspendingErrorClass } from './errors';

// Re-export a simpler OverspendingError for validator functions
class OverspendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverspendingError';
  }
}

export { OverspendingError };

/**
 * Validates that an expense date is within the monthly overview date range.
 * Replicates Salesforce validation rule: ExpenseDate_WithinMonthlyOverview
 * 
 * @param expenseDate - The date of the expense (YYYY-MM-DD)
 * @param monthStartDate - The start date of the monthly overview (YYYY-MM-DD)
 * @param monthEndDate - The end date of the monthly overview (YYYY-MM-DD)
 * @param monthName - The name of the month for error messages
 * @returns true if valid
 * @throws ValidationError if expense date is outside the month range
 */
export function validateExpenseDateWithinMonth(
  expenseDate: string,
  monthStartDate: string,
  monthEndDate: string,
  monthName: string = 'the monthly overview'
): boolean {
  const expenseDt = new Date(expenseDate);
  const startDt = new Date(monthStartDate);
  const endDt = new Date(monthEndDate);

  // Set all dates to midnight for comparison
  expenseDt.setHours(0, 0, 0, 0);
  startDt.setHours(0, 0, 0, 0);
  endDt.setHours(0, 0, 0, 0);

  if (expenseDt < startDt || expenseDt > endDt) {
    throw new ValidationError(
      `The Expense Date (${expenseDate}) must be between the Start Date (${monthStartDate}) ` +
      `and End Date (${monthEndDate}) of ${monthName}.`
    );
  }

  return true;
}

/**
 * Validates that adding an expense does not exceed the budget.
 * Replicates Salesforce validation rule: Prevent_Overspending
 * 
 * @param budgetAmount - The total budget amount
 * @param currentSpent - The amount already spent (excluding the expense being validated)
 * @param newExpenseAmount - The amount of the new expense
 * @param budgetName - The name of the budget for error messages
 * @returns true if valid
 * @throws OverspendingError if expense would cause overspending
 */
export function validateNoOverspending(
  budgetAmount: number,
  currentSpent: number,
  newExpenseAmount: number,
  budgetName: string = 'this budget'
): boolean {
  const amountLeft = budgetAmount - currentSpent - newExpenseAmount;

  if (amountLeft < 0) {
    const available = budgetAmount - currentSpent;
    throw new OverspendingError(
      `Cannot add expense of €${newExpenseAmount.toFixed(2)} to "${budgetName}" budget. ` +
      `Budget would be negative by €${Math.abs(amountLeft).toFixed(2)}. ` +
      `Available: €${available.toFixed(2)}`
    );
  }

  return true;
}

/**
 * Validates that a date range has end date on or after start date.
 * Used for monthly overviews and financial goals.
 * 
 * @param startDate - The start date (YYYY-MM-DD)
 * @param endDate - The end date (YYYY-MM-DD)
 * @param entityName - The name of the entity for error messages
 * @returns true if valid
 * @throws ValidationError if end date is before start date
 */
export function validateDateRange(
  startDate: string,
  endDate: string,
  entityName: string = 'this period'
): boolean {
  const startDt = new Date(startDate);
  const endDt = new Date(endDate);

  // Set to midnight for comparison
  startDt.setHours(0, 0, 0, 0);
  endDt.setHours(0, 0, 0, 0);

  if (endDt < startDt) {
    throw new ValidationError(
      `End date (${endDate}) cannot be before start date (${startDate}) for ${entityName}.`
    );
  }

  return true;
}

/**
 * Validates that an amount is positive.
 * Used for expenses and income.
 * 
 * @param amount - The amount to validate
 * @param fieldName - The name of the field for error messages
 * @returns true if valid
 * @throws ValidationError if amount is not positive
 */
export function validatePositiveAmount(
  amount: number,
  fieldName: string = 'Amount'
): boolean {
  if (amount <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number.`);
  }
  return true;
}

/**
 * Validates that an amount is non-negative.
 * Used for budgets (which can be zero).
 * 
 * @param amount - The amount to validate
 * @param fieldName - The name of the field for error messages
 * @returns true if valid
 * @throws ValidationError if amount is negative
 */
export function validateNonNegativeAmount(
  amount: number,
  fieldName: string = 'Amount'
): boolean {
  if (amount < 0) {
    throw new ValidationError(`${fieldName} cannot be negative.`);
  }
  return true;
}

/**
 * Calculates budget summary values.
 * Used for rollup calculations similar to Salesforce.
 * 
 * @param budgetAmount - The total budget amount
 * @param expenses - Array of expense amounts
 * @returns Budget summary with spent, left, and percent used
 */
export function calculateBudgetSummary(
  budgetAmount: number,
  expenses: number[]
): {
  amountSpent: number;
  amountLeft: number;
  percentUsed: number;
} {
  const amountSpent = expenses.reduce((sum, amount) => sum + amount, 0);
  const amountLeft = budgetAmount - amountSpent;
  const percentUsed = budgetAmount > 0 ? (amountSpent / budgetAmount) * 100 : 0;

  return {
    amountSpent,
    amountLeft,
    percentUsed,
  };
}

/**
 * Calculates monthly overview summary values.
 * Used for rollup calculations similar to Salesforce.
 * 
 * @param incomeAmounts - Array of income amounts
 * @param budgetAmounts - Array of budget amounts
 * @returns Monthly overview summary
 */
export function calculateMonthlyOverviewSummary(
  incomeAmounts: number[],
  budgetAmounts: number[]
): {
  totalIncome: number;
  totalBudgeted: number;
  amountUnallocated: number;
} {
  const totalIncome = incomeAmounts.reduce((sum, amount) => sum + amount, 0);
  const totalBudgeted = budgetAmounts.reduce((sum, amount) => sum + amount, 0);
  const amountUnallocated = totalIncome - totalBudgeted;

  return {
    totalIncome,
    totalBudgeted,
    amountUnallocated,
  };
}

/**
 * List of default budget categories created when a new month is created.
 * Replicates Salesforce Flow: Budget_Automation
 */
export const DEFAULT_BUDGET_CATEGORIES = [
  { name: 'Tithe', amount: 350.00, description: '10% of all income - giving back to God' },
  { name: 'Offering', amount: 175.00, description: '5% of main income - additional giving' },
  { name: 'Housing', amount: 2228.00, description: 'Rent, Electricity' },
  { name: 'Food', amount: 350.00, description: 'Groceries & Snacks' },
  { name: 'Transport', amount: 200.00, description: 'Toll, Parking, Fuel' },
  { name: 'Personal Care', amount: 480.00, description: 'Personal allowances, Nails' },
  { name: 'Household', amount: 130.00, description: 'Household items, Cleaning' },
  { name: 'Savings', amount: 300.00, description: 'Monthly savings' },
  { name: 'Investments', amount: 100.00, description: '401K, Stocks, Retirement contributions' },
  { name: 'Subscriptions', amount: 75.00, description: 'Netflix, Spotify, and other recurring subscriptions' },
  { name: 'Health', amount: 50.00, description: 'Medicine or health related' },
  { name: 'Travel', amount: 50.00, description: 'Travel Allowance' },
  { name: 'Miscellaneous', amount: 100.00, description: 'Unexpected expenses and other items' },
] as const;

/**
 * Total of all default budget categories
 */
export const DEFAULT_TOTAL_BUDGET = DEFAULT_BUDGET_CATEGORIES.reduce(
  (sum, cat) => sum + cat.amount,
  0
);
