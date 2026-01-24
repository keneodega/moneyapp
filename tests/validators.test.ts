/**
 * Unit Tests for Business Rule Validators
 * 
 * Tests the three core Salesforce validation rules:
 * 1. Expense date must be within monthly overview date range
 * 2. Prevent overspending (no negative amount left)
 * 3. Date range validation (end date after start date)
 */

import { describe, it, expect } from 'vitest';
import {
  validateExpenseDateWithinMonth,
  validateNoOverspending,
  validateDateRange,
  validatePositiveAmount,
  validateNonNegativeAmount,
  calculateBudgetSummary,
  calculateMonthlyOverviewSummary,
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_TOTAL_BUDGET,
  OverspendingError,
} from '@/lib/services/validators';
import { ValidationError } from '@/lib/services/errors';

describe('Expense Date Within Month Validation', () => {
  const monthStart = '2026-01-01';
  const monthEnd = '2026-01-31';
  const monthName = 'January 2026';

  it('should pass when expense date is within the month range', () => {
    expect(
      validateExpenseDateWithinMonth('2026-01-15', monthStart, monthEnd, monthName)
    ).toBe(true);
  });

  it('should pass when expense date equals the start date', () => {
    expect(
      validateExpenseDateWithinMonth('2026-01-01', monthStart, monthEnd, monthName)
    ).toBe(true);
  });

  it('should pass when expense date equals the end date', () => {
    expect(
      validateExpenseDateWithinMonth('2026-01-31', monthStart, monthEnd, monthName)
    ).toBe(true);
  });

  it('should throw ValidationError when expense date is before the month', () => {
    expect(() =>
      validateExpenseDateWithinMonth('2025-12-31', monthStart, monthEnd, monthName)
    ).toThrow(ValidationError);
  });

  it('should throw ValidationError when expense date is after the month', () => {
    expect(() =>
      validateExpenseDateWithinMonth('2026-02-01', monthStart, monthEnd, monthName)
    ).toThrow(ValidationError);
  });

  it('should include dates in error message', () => {
    expect(() =>
      validateExpenseDateWithinMonth('2025-12-15', monthStart, monthEnd, monthName)
    ).toThrow(/2025-12-15/);
  });

  it('should include month name in error message', () => {
    expect(() =>
      validateExpenseDateWithinMonth('2025-12-15', monthStart, monthEnd, monthName)
    ).toThrow(/January 2026/);
  });
});

describe('Prevent Overspending Validation', () => {
  const budgetAmount = 500;
  const budgetName = 'Food';

  it('should pass when expense is within budget', () => {
    expect(
      validateNoOverspending(budgetAmount, 200, 100, budgetName)
    ).toBe(true);
  });

  it('should pass when expense uses entire remaining budget', () => {
    expect(
      validateNoOverspending(budgetAmount, 400, 100, budgetName)
    ).toBe(true);
  });

  it('should pass when no previous spending', () => {
    expect(
      validateNoOverspending(budgetAmount, 0, 500, budgetName)
    ).toBe(true);
  });

  it('should throw OverspendingError when expense exceeds budget', () => {
    expect(() =>
      validateNoOverspending(budgetAmount, 400, 150, budgetName)
    ).toThrow(OverspendingError);
  });

  it('should throw OverspendingError when expense on exhausted budget', () => {
    expect(() =>
      validateNoOverspending(budgetAmount, 500, 1, budgetName)
    ).toThrow(OverspendingError);
  });

  it('should include expense amount in error message', () => {
    expect(() =>
      validateNoOverspending(budgetAmount, 450, 100, budgetName)
    ).toThrow(/€100\.00/);
  });

  it('should include budget name in error message', () => {
    expect(() =>
      validateNoOverspending(budgetAmount, 450, 100, budgetName)
    ).toThrow(/Food/);
  });

  it('should include available amount in error message', () => {
    expect(() =>
      validateNoOverspending(budgetAmount, 450, 100, budgetName)
    ).toThrow(/€50\.00/);
  });

  it('should include overage amount in error message', () => {
    expect(() =>
      validateNoOverspending(budgetAmount, 450, 100, budgetName)
    ).toThrow(/€50\.00/); // 450 + 100 - 500 = 50 over
  });
});

describe('Date Range Validation', () => {
  it('should pass when end date is after start date', () => {
    expect(
      validateDateRange('2026-01-01', '2026-01-31', 'January 2026')
    ).toBe(true);
  });

  it('should pass when end date equals start date', () => {
    expect(
      validateDateRange('2026-01-15', '2026-01-15', 'Single day period')
    ).toBe(true);
  });

  it('should throw ValidationError when end date is before start date', () => {
    expect(() =>
      validateDateRange('2026-01-31', '2026-01-01', 'Invalid period')
    ).toThrow(ValidationError);
  });

  it('should include dates in error message', () => {
    expect(() =>
      validateDateRange('2026-02-28', '2026-02-01', 'February')
    ).toThrow(/2026-02-28/);
  });

  it('should include entity name in error message', () => {
    expect(() =>
      validateDateRange('2026-02-28', '2026-02-01', 'Financial Goal')
    ).toThrow(/Financial Goal/);
  });
});

describe('Positive Amount Validation', () => {
  it('should pass for positive amounts', () => {
    expect(validatePositiveAmount(100, 'Expense')).toBe(true);
    expect(validatePositiveAmount(0.01, 'Expense')).toBe(true);
  });

  it('should throw ValidationError for zero', () => {
    expect(() => validatePositiveAmount(0, 'Expense')).toThrow(ValidationError);
  });

  it('should throw ValidationError for negative amounts', () => {
    expect(() => validatePositiveAmount(-50, 'Expense')).toThrow(ValidationError);
  });

  it('should include field name in error message', () => {
    expect(() => validatePositiveAmount(0, 'Income')).toThrow(/Income/);
  });
});

describe('Non-Negative Amount Validation', () => {
  it('should pass for positive amounts', () => {
    expect(validateNonNegativeAmount(100, 'Budget')).toBe(true);
  });

  it('should pass for zero', () => {
    expect(validateNonNegativeAmount(0, 'Budget')).toBe(true);
  });

  it('should throw ValidationError for negative amounts', () => {
    expect(() => validateNonNegativeAmount(-50, 'Budget')).toThrow(ValidationError);
  });

  it('should include field name in error message', () => {
    expect(() => validateNonNegativeAmount(-1, 'Budget amount')).toThrow(/Budget amount/);
  });
});

describe('Budget Summary Calculation', () => {
  it('should calculate spent, left, and percent correctly', () => {
    const result = calculateBudgetSummary(500, [100, 150, 50]);

    expect(result.amountSpent).toBe(300);
    expect(result.amountLeft).toBe(200);
    expect(result.percentUsed).toBe(60);
  });

  it('should handle no expenses', () => {
    const result = calculateBudgetSummary(500, []);

    expect(result.amountSpent).toBe(0);
    expect(result.amountLeft).toBe(500);
    expect(result.percentUsed).toBe(0);
  });

  it('should handle fully spent budget', () => {
    const result = calculateBudgetSummary(500, [500]);

    expect(result.amountSpent).toBe(500);
    expect(result.amountLeft).toBe(0);
    expect(result.percentUsed).toBe(100);
  });

  it('should calculate negative amount left when overspent', () => {
    const result = calculateBudgetSummary(500, [300, 300]);

    expect(result.amountSpent).toBe(600);
    expect(result.amountLeft).toBe(-100);
    expect(result.percentUsed).toBe(120);
  });

  it('should handle zero budget', () => {
    const result = calculateBudgetSummary(0, [100]);

    expect(result.amountSpent).toBe(100);
    expect(result.amountLeft).toBe(-100);
    expect(result.percentUsed).toBe(0); // Avoid division by zero
  });
});

describe('Monthly Overview Summary Calculation', () => {
  it('should calculate income, budgeted, and unallocated correctly', () => {
    const result = calculateMonthlyOverviewSummary(
      [3200, 2000], // Income
      [350, 2228, 350, 200] // Budget amounts
    );

    expect(result.totalIncome).toBe(5200);
    expect(result.totalBudgeted).toBe(3128);
    expect(result.amountUnallocated).toBe(2072);
  });

  it('should handle no income', () => {
    const result = calculateMonthlyOverviewSummary([], [500, 300]);

    expect(result.totalIncome).toBe(0);
    expect(result.totalBudgeted).toBe(800);
    expect(result.amountUnallocated).toBe(-800);
  });

  it('should handle no budgets', () => {
    const result = calculateMonthlyOverviewSummary([5000], []);

    expect(result.totalIncome).toBe(5000);
    expect(result.totalBudgeted).toBe(0);
    expect(result.amountUnallocated).toBe(5000);
  });

  it('should show negative unallocated when over-budgeted', () => {
    const result = calculateMonthlyOverviewSummary([3000], [2000, 2000]);

    expect(result.totalIncome).toBe(3000);
    expect(result.totalBudgeted).toBe(4000);
    expect(result.amountUnallocated).toBe(-1000);
  });
});

describe('Default Budget Categories', () => {
  it('should have exactly 13 categories', () => {
    expect(DEFAULT_BUDGET_CATEGORIES).toHaveLength(13);
  });

  it('should have correct total budget amount', () => {
    expect(DEFAULT_TOTAL_BUDGET).toBe(4588);
  });

  it('should include all expected category names', () => {
    const names = DEFAULT_BUDGET_CATEGORIES.map((cat) => cat.name);

    expect(names).toContain('Tithe');
    expect(names).toContain('Offering');
    expect(names).toContain('Housing');
    expect(names).toContain('Food');
    expect(names).toContain('Transport');
    expect(names).toContain('Personal Care');
    expect(names).toContain('Household');
    expect(names).toContain('Savings');
    expect(names).toContain('Investments');
    expect(names).toContain('Subscriptions');
    expect(names).toContain('Health');
    expect(names).toContain('Travel');
    expect(names).toContain('Miscellaneous');
  });

  it('should have Housing as the largest category', () => {
    const housing = DEFAULT_BUDGET_CATEGORIES.find((cat) => cat.name === 'Housing');
    const maxAmount = Math.max(...DEFAULT_BUDGET_CATEGORIES.map((cat) => cat.amount));

    expect(housing?.amount).toBe(maxAmount);
    expect(housing?.amount).toBe(2228);
  });

  it('should have separate Tithe and Offering categories', () => {
    const tithe = DEFAULT_BUDGET_CATEGORIES.find((cat) => cat.name === 'Tithe');
    const offering = DEFAULT_BUDGET_CATEGORIES.find((cat) => cat.name === 'Offering');

    expect(tithe).toBeDefined();
    expect(offering).toBeDefined();
    expect(tithe?.amount).toBe(350); // 10% of typical income
    expect(offering?.amount).toBe(175); // 5% of typical income
  });

  it('should have all positive amounts', () => {
    DEFAULT_BUDGET_CATEGORIES.forEach((cat) => {
      expect(cat.amount).toBeGreaterThan(0);
    });
  });

  it('should have descriptions for all categories', () => {
    DEFAULT_BUDGET_CATEGORIES.forEach((cat) => {
      expect(cat.description).toBeDefined();
      expect(cat.description.length).toBeGreaterThan(0);
    });
  });
});

describe('Edge Cases and Combined Scenarios', () => {
  it('should handle decimal amounts correctly in overspending check', () => {
    // Budget: 100.00, Spent: 99.99, New expense: 0.02
    expect(() =>
      validateNoOverspending(100, 99.99, 0.02, 'Test')
    ).toThrow(OverspendingError);
  });

  it('should allow exact remaining in overspending check', () => {
    // Budget: 100.00, Spent: 99.99, New expense: 0.01
    expect(
      validateNoOverspending(100, 99.99, 0.01, 'Test')
    ).toBe(true);
  });

  it('should validate February dates correctly', () => {
    // February 2026 is not a leap year
    expect(
      validateExpenseDateWithinMonth('2026-02-28', '2026-02-01', '2026-02-28', 'February')
    ).toBe(true);

    expect(() =>
      validateExpenseDateWithinMonth('2026-02-29', '2026-02-01', '2026-02-28', 'February')
    ).toThrow(ValidationError);
  });

  it('should validate leap year February correctly', () => {
    // 2024 was a leap year
    expect(
      validateExpenseDateWithinMonth('2024-02-29', '2024-02-01', '2024-02-29', 'February 2024')
    ).toBe(true);
  });

  it('should handle year boundary correctly', () => {
    expect(
      validateExpenseDateWithinMonth('2025-12-31', '2025-12-01', '2025-12-31', 'December 2025')
    ).toBe(true);

    expect(() =>
      validateExpenseDateWithinMonth('2026-01-01', '2025-12-01', '2025-12-31', 'December 2025')
    ).toThrow(ValidationError);
  });
});
