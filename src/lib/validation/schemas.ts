/**
 * Zod Validation Schemas
 *
 * Type-safe validation schemas for all entities in the application.
 * These schemas are used for both client-side and server-side validation.
 *
 * @author MoneyApp Team
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas (Reusable)
// ============================================================================

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

export const positiveNumberSchema = z.number().positive('Must be greater than zero');

export const nonNegativeNumberSchema = z.number().nonnegative('Cannot be negative');

export const currencySchema = z.number()
  .positive('Amount must be greater than zero')
  .multipleOf(0.01, 'Amount can have at most 2 decimal places');

export const uuidSchema = z.string().uuid('Invalid ID format');

// ============================================================================
// Monthly Overview Schema
// ============================================================================

export const MonthlyOverviewSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  start_date: dateSchema,
  end_date: dateSchema,
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
    .nullable(),
}).refine(
  (data) => new Date(data.end_date) >= new Date(data.start_date),
  {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  }
);

export type MonthlyOverviewInput = z.infer<typeof MonthlyOverviewSchema>;

// ============================================================================
// Budget Schema
// ============================================================================

export const BudgetSchema = z.object({
  monthly_overview_id: uuidSchema,
  name: z.string()
    .min(1, 'Budget name is required')
    .max(100, 'Budget name must be less than 100 characters'),
  budget_amount: nonNegativeNumberSchema.refine(
    (val) => val !== undefined && val !== null,
    'Budget amount is required'
  ),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .nullable(),
  master_budget_id: uuidSchema.optional().nullable(),
  override_amount: nonNegativeNumberSchema.optional().nullable(),
  override_reason: z.string()
    .max(500, 'Override reason must be less than 500 characters')
    .optional()
    .nullable(),
}).refine(
  (data) => {
    // If override_amount is set, override_reason is required
    if (data.override_amount !== null && data.override_amount !== undefined) {
      return !!data.override_reason;
    }
    return true;
  },
  {
    message: 'Override reason is required when overriding amount',
    path: ['override_reason'],
  }
);

export type BudgetInput = z.infer<typeof BudgetSchema>;

// ============================================================================
// Expense Schema
// ============================================================================

export const ExpenseSchema = z.object({
  budget_id: uuidSchema,
  amount: currencySchema,
  date: dateSchema,
  bank: z.string()
    .max(100, 'Bank name must be less than 100 characters')
    .optional()
    .nullable(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .nullable(),
  is_recurring: z.boolean().optional().default(false),
  recurring_frequency: z.enum([
    'Weekly',
    'Bi-Weekly',
    'Monthly',
    'Quarterly',
    'Bi-Annually',
    'Annually'
  ]).optional().nullable(),
});

export type ExpenseInput = z.infer<typeof ExpenseSchema>;

// ============================================================================
// Income Source Schema
// ============================================================================

export const IncomeSourceSchema = z.object({
  monthly_overview_id: uuidSchema,
  source_name: z.string()
    .min(1, 'Source name is required')
    .max(100, 'Source name must be less than 100 characters'),
  amount: currencySchema,
  frequency: z.enum(['Monthly', 'Weekly', 'Bi-Weekly', 'One-time'] as const, {
    message: 'Please select a valid frequency',
  }),
  expected_date: dateSchema.optional().nullable(),
  payment_method_id: uuidSchema.optional().nullable(),
  person_id: uuidSchema.optional().nullable(),
});

export type IncomeSourceInput = z.infer<typeof IncomeSourceSchema>;

// ============================================================================
// Financial Goal Schema
// ============================================================================

export const FinancialGoalSchema = z.object({
  name: z.string()
    .min(1, 'Goal name is required')
    .max(200, 'Goal name must be less than 200 characters'),
  target_amount: currencySchema,
  current_amount: nonNegativeNumberSchema.optional().default(0),
  start_date: dateSchema,
  end_date: dateSchema.optional().nullable(),
  status: z.enum(['Not Started', 'In Progress', 'Completed', 'On Hold'] as const, {
    message: 'Please select a valid status',
  }),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical'] as const, {
    message: 'Please select a valid priority',
  }),
  goal_type: z.string()
    .max(100, 'Goal type must be less than 100 characters')
    .optional()
    .nullable(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
    .nullable(),
  parent_goal_id: uuidSchema.optional().nullable(),
  person_id: uuidSchema.optional().nullable(),
}).refine(
  (data) => {
    if (data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
  },
  {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  }
).refine(
  (data) => {
    // Current amount cannot exceed target amount
    if (data.current_amount !== undefined && data.current_amount !== null) {
      return data.current_amount <= data.target_amount;
    }
    return true;
  },
  {
    message: 'Current amount cannot exceed target amount',
    path: ['current_amount'],
  }
);

export type FinancialGoalInput = z.infer<typeof FinancialGoalSchema>;

// ============================================================================
// Subscription Schema
// ============================================================================

export const SubscriptionSchema = z.object({
  name: z.string()
    .min(1, 'Subscription name is required')
    .max(100, 'Subscription name must be less than 100 characters'),
  amount: currencySchema,
  frequency: z.enum(['Weekly', 'Monthly', 'Quarterly', 'Annually'] as const, {
    message: 'Please select a valid frequency',
  }),
  collection_date: z.number()
    .int('Collection date must be a whole number')
    .min(1, 'Collection date must be between 1 and 31')
    .max(31, 'Collection date must be between 1 and 31')
    .optional()
    .nullable(),
  status: z.enum(['Active', 'Paused', 'Cancelled', 'Ended'] as const, {
    message: 'Please select a valid status',
  }).default('Active'),
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .nullable(),
  subscription_type_id: uuidSchema.optional().nullable(),
  payment_method_id: uuidSchema.optional().nullable(),
});

export type SubscriptionInput = z.infer<typeof SubscriptionSchema>;

// ============================================================================
// Loan Schema
// ============================================================================

export const LoanSchema = z.object({
  name: z.string()
    .min(1, 'Loan name is required')
    .max(100, 'Loan name must be less than 100 characters'),
  principal_amount: currencySchema,
  interest_rate: z.number()
    .min(0, 'Interest rate cannot be negative')
    .max(100, 'Interest rate must be less than 100%')
    .optional()
    .nullable(),
  loan_term_months: z.number()
    .int('Loan term must be a whole number')
    .positive('Loan term must be greater than zero')
    .optional()
    .nullable(),
  start_date: dateSchema,
  end_date: dateSchema.optional().nullable(),
  status: z.enum(['Active', 'Paid Off', 'Defaulted', 'Refinanced'] as const, {
    message: 'Please select a valid status',
  }).default('Active'),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
    .nullable(),
  lender: z.string()
    .max(100, 'Lender name must be less than 100 characters')
    .optional()
    .nullable(),
  person_id: uuidSchema.optional().nullable(),
  payment_method_id: uuidSchema.optional().nullable(),
}).refine(
  (data) => {
    if (data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
  },
  {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  }
);

export type LoanInput = z.infer<typeof LoanSchema>;

// ============================================================================
// Goal Contribution Schema
// ============================================================================

export const GoalContributionSchema = z.object({
  financial_goal_id: uuidSchema,
  monthly_overview_id: uuidSchema,
  amount: currencySchema,
  contribution_date: dateSchema,
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .nullable(),
  source: z.enum(['Income', 'Savings', 'Other'] as const, {
    message: 'Please select a valid source',
  }).optional().default('Other'),
});

export type GoalContributionInput = z.infer<typeof GoalContributionSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert FormData to object suitable for schema validation
 */
export function formDataToObject(formData: FormData): Record<string, any> {
  const obj: Record<string, any> = {};

  formData.forEach((value, key) => {
    // Handle checkbox values
    if (value === 'on') {
      obj[key] = true;
      return;
    }

    // Handle empty strings as null for optional fields
    if (value === '') {
      obj[key] = null;
      return;
    }

    // Handle numeric values
    if (key.includes('amount') || key.includes('rate') || key.includes('date') && typeof value === 'string' && !isNaN(Number(value))) {
      obj[key] = Number(value);
      return;
    }

    obj[key] = value;
  });

  return obj;
}

/**
 * Parse and validate form data with a Zod schema
 */
export function validateFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const obj = formDataToObject(formData);
  const result = schema.safeParse(obj);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error };
}
