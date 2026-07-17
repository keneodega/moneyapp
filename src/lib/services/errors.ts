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
