/**
 * Custom error classes for the Family Money Tracker service layer
 * These provide meaningful error messages for business rule violations
 */

export class ServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Thrown when an expense date is outside the monthly overview range
 */
export class ExpenseDateOutOfRangeError extends ServiceError {
  constructor(expenseDate: string, startDate: string, endDate: string) {
    super(
      `The Expense Date (${expenseDate}) must be between the Start Date (${startDate}) and End Date (${endDate}) of the associated Monthly Overview.`,
      'EXPENSE_DATE_OUT_OF_RANGE'
    );
    this.name = 'ExpenseDateOutOfRangeError';
  }
}

/**
 * Thrown when an expense would cause overspending (negative budget amount left)
 */
export class OverspendingError extends ServiceError {
  public readonly budgetName: string;
  public readonly budgetAmount: number;
  public readonly currentSpent: number;
  public readonly expenseAmount: number;

  constructor(
    budgetName: string,
    budgetAmount: number,
    currentSpent: number,
    expenseAmount: number
  ) {
    const amountLeft = budgetAmount - currentSpent;
    super(
      `Cannot add expense of €${expenseAmount.toFixed(2)} to "${budgetName}". Budget would be negative. Available: €${amountLeft.toFixed(2)}`,
      'OVERSPENDING_NOT_ALLOWED'
    );
    this.name = 'OverspendingError';
    this.budgetName = budgetName;
    this.budgetAmount = budgetAmount;
    this.currentSpent = currentSpent;
    this.expenseAmount = expenseAmount;
  }
}

/**
 * Thrown when a required resource is not found
 */
export class NotFoundError extends ServiceError {
  constructor(resource: string, id: string) {
    super(`${resource} with ID "${id}" not found.`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when user is not authenticated
 */
export class UnauthorizedError extends ServiceError {
  constructor() {
    super('You must be logged in to perform this action.', 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Thrown when a validation fails
 */
export class ValidationError extends ServiceError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}
