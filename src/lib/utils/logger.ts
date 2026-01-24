/**
 * Lightweight Logging Utility
 * 
 * Provides structured logging for key money events.
 * Logs are sent to Sentry for error tracking and monitoring.
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import * as Sentry from '@sentry/nextjs';
import { getAppEnvironment } from '@/lib/config/env';

type LogLevel = 'info' | 'warn' | 'error';

interface MoneyEvent {
  event: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a key money event
 * 
 * This creates a structured log entry and sends it to Sentry
 * for monitoring and error tracking.
 * 
 * @param event - Event name (e.g., 'expense.created', 'income.created')
 * @param metadata - Additional context about the event
 */
export function logMoneyEvent(
  event: string,
  metadata?: Record<string, unknown>
): void {
  const userId = metadata?.userId as string | undefined;
  
  // Create structured log entry
  const logEntry: MoneyEvent = {
    event,
    userId,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
      environment: getAppEnvironment(),
    },
  };

  // Log to console in development
  if (getAppEnvironment() === 'development') {
    console.log(`[Money Event] ${event}`, logEntry);
  }

  // Send to Sentry as a breadcrumb for context
  Sentry.addBreadcrumb({
    category: 'money.event',
    message: event,
    level: 'info',
    data: logEntry.metadata,
  });

  // For critical events, also send as a message to Sentry
  // This helps track event frequency and patterns
  Sentry.captureMessage(`Money Event: ${event}`, {
    level: 'info',
    tags: {
      event_type: 'money_event',
      event_name: event,
    },
    extra: logEntry.metadata,
  });
}

/**
 * Log an expense creation event
 */
export function logExpenseCreated(data: {
  expenseId: string;
  userId: string;
  amount: number;
  budgetId: string;
  budgetName: string;
  monthlyOverviewId: string;
  date: string;
}): void {
  logMoneyEvent('expense.created', {
    expenseId: data.expenseId,
    userId: data.userId,
    amount: data.amount,
    budgetId: data.budgetId,
    budgetName: data.budgetName,
    monthlyOverviewId: data.monthlyOverviewId,
    date: data.date,
  });
}

/**
 * Log an income creation event
 */
export function logIncomeCreated(data: {
  incomeId: string;
  userId: string;
  amount: number;
  monthlyOverviewId: string;
  source: string;
  person: string;
  datePaid: string;
  titheDeduction?: boolean;
}): void {
  logMoneyEvent('income.created', {
    incomeId: data.incomeId,
    userId: data.userId,
    amount: data.amount,
    monthlyOverviewId: data.monthlyOverviewId,
    source: data.source,
    person: data.person,
    datePaid: data.datePaid,
    titheDeduction: data.titheDeduction,
  });
}

/**
 * Log a month creation event
 */
export function logMonthCreated(data: {
  monthlyOverviewId: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  budgetsCreated: number;
}): void {
  logMoneyEvent('month.created', {
    monthlyOverviewId: data.monthlyOverviewId,
    userId: data.userId,
    name: data.name,
    startDate: data.startDate,
    endDate: data.endDate,
    budgetsCreated: data.budgetsCreated,
  });
}

/**
 * Log a goal creation event
 */
export function logGoalCreated(data: {
  goalId: string;
  userId: string;
  name: string;
  targetAmount: number;
  startDate: string;
  endDate?: string | null;
  goalType?: string | null;
}): void {
  logMoneyEvent('goal.created', {
    goalId: data.goalId,
    userId: data.userId,
    name: data.name,
    targetAmount: data.targetAmount,
    startDate: data.startDate,
    endDate: data.endDate,
    goalType: data.goalType,
  });
}

/**
 * Log a goal update event
 */
export function logGoalUpdated(data: {
  goalId: string;
  metadata?: Record<string, unknown>;
}): void {
  logMoneyEvent('goal.updated', {
    goalId: data.goalId,
    ...data.metadata,
  });
}

/**
 * Log a sub-goal creation event
 */
export function logSubGoalCreated(data: {
  subGoalId: string;
  goalId: string;
  name: string;
  estimatedCost?: number | null;
}): void {
  logMoneyEvent('subgoal.created', {
    subGoalId: data.subGoalId,
    goalId: data.goalId,
    name: data.name,
    estimatedCost: data.estimatedCost,
  });
}

/**
 * Log an error with context
 */
export function logError(
  error: Error,
  context?: {
    event?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  // Log to console in development
  if (getAppEnvironment() === 'development') {
    console.error('[Error]', error, context);
  }

  // Send to Sentry with context
  Sentry.captureException(error, {
    tags: {
      event_type: context?.event || 'error',
    },
    extra: {
      ...context?.metadata,
      userId: context?.userId,
    },
  });
}
