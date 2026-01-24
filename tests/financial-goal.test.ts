/**
 * Unit Tests for Financial Goal Service
 * 
 * Tests the validation rules for financial goals and sub-goals:
 * - End Date must be after Start Date
 * - Target amount must be positive
 * - Progress must be between 0 and 100
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinancialGoalService } from '@/lib/services/financial-goal.service';
import { ValidationError, NotFoundError, UnauthorizedError } from '@/lib/services/errors';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const createMockSupabaseClient = (): Partial<SupabaseClient> => {
  const mockUser = { id: 'test-user-id' };
  
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
    } as any,
    from: vi.fn(() => createQueryBuilder()),
  } as any;
};

// Helper to create query builder
// In Supabase, query chains are awaitable and return { data, error }
const createQueryBuilder = (defaultData: any = [], defaultError: any = null) => {
  const result = { data: defaultData, error: defaultError };
  const builder: any = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockReturnThis(),
  };
  // Make the builder itself awaitable (thenable)
  builder.then = (onResolve: any) => Promise.resolve(result).then(onResolve);
  builder.catch = (onReject: any) => Promise.resolve(result).catch(onReject);
  return builder;
};

describe('FinancialGoalService', () => {
  let service: FinancialGoalService;
  let mockSupabase: Partial<SupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new FinancialGoalService(mockSupabase as SupabaseClient);
  });

  describe('create', () => {
    it('should create a goal with valid data', async () => {
      const goalData = {
        name: 'Emergency Fund',
        target_amount: 10000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
      };

      const mockGoal = { id: 'goal-1', ...goalData, current_amount: 0, user_id: 'test-user-id' };

      (mockSupabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockGoal, error: null }),
      });

      const result = await service.create(goalData);

      expect(result).toEqual(mockGoal);
      expect(mockSupabase.from).toHaveBeenCalledWith('financial_goals');
    });

    it('should throw ValidationError if end date is before start date', async () => {
      const goalData = {
        name: 'Emergency Fund',
        target_amount: 10000,
        start_date: '2026-12-31',
        end_date: '2026-01-01', // End date before start date
        status: 'Not Started' as const,
        priority: 'Medium' as const,
      };

      await expect(service.create(goalData)).rejects.toThrow(ValidationError);
      await expect(service.create(goalData)).rejects.toThrow('End Date must be after Start Date');
    });

    it('should throw ValidationError if target amount is zero', async () => {
      const goalData = {
        name: 'Emergency Fund',
        target_amount: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
      };

      await expect(service.create(goalData)).rejects.toThrow(ValidationError);
      await expect(service.create(goalData)).rejects.toThrow('Target amount must be greater than zero');
    });

    it('should throw ValidationError if target amount is negative', async () => {
      const goalData = {
        name: 'Emergency Fund',
        target_amount: -1000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
      };

      await expect(service.create(goalData)).rejects.toThrow(ValidationError);
      await expect(service.create(goalData)).rejects.toThrow('Target amount must be greater than zero');
    });

    it('should allow end date to be null', async () => {
      const goalData = {
        name: 'Emergency Fund',
        target_amount: 10000,
        start_date: '2026-01-01',
        end_date: null,
        status: 'Not Started' as const,
        priority: 'Medium' as const,
      };

      const mockGoal = { id: 'goal-1', ...goalData, current_amount: 0, user_id: 'test-user-id' };

      (mockSupabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockGoal, error: null }),
      });

      const result = await service.create(goalData);

      expect(result).toEqual(mockGoal);
    });

    it('should throw UnauthorizedError if user is not authenticated', async () => {
      const mockSupabaseUnauth = {
        ...mockSupabase,
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        } as any,
      };

      const serviceUnauth = new FinancialGoalService(mockSupabaseUnauth as SupabaseClient);

      const goalData = {
        name: 'Emergency Fund',
        target_amount: 10000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
      };

      await expect(serviceUnauth.create(goalData)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('update', () => {
    it('should throw ValidationError if updated end date is before start date', async () => {
      const existingGoal = {
        id: 'goal-1',
        name: 'Emergency Fund',
        target_amount: 10000,
        current_amount: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
        user_id: 'test-user-id',
        sub_goals: [],
        progress_percent: 0,
      };

      // Mock getById - goal query
      const goalQuery = createQueryBuilder();
      goalQuery.single.mockResolvedValue({ data: existingGoal, error: null });
      
      // Mock getById - sub-goals query (already returns { data: [], error: null } by default)
      const subGoalsQuery = createQueryBuilder();

      (mockSupabase.from as any)
        .mockReturnValueOnce(goalQuery) // getById - goal
        .mockReturnValueOnce(subGoalsQuery); // getById - sub-goals

      const updateData = {
        start_date: '2026-12-31',
        end_date: '2026-01-01', // End date before start date
      };

      await expect(service.update('goal-1', updateData)).rejects.toThrow(ValidationError);
      await expect(service.update('goal-1', updateData)).rejects.toThrow('End Date must be after Start Date');
    });

    it('should throw ValidationError if target amount is set to zero', async () => {
      const existingGoal = {
        id: 'goal-1',
        name: 'Emergency Fund',
        target_amount: 10000,
        current_amount: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
        user_id: 'test-user-id',
        sub_goals: [],
        progress_percent: 0,
      };

      // Mock getById - goal query
      const goalQuery = createQueryBuilder();
      goalQuery.single.mockResolvedValue({ data: existingGoal, error: null });
      
      // Mock getById - sub-goals query (already returns { data: [], error: null } by default)
      const subGoalsQuery = createQueryBuilder();

      (mockSupabase.from as any)
        .mockReturnValueOnce(goalQuery) // getById - goal
        .mockReturnValueOnce(subGoalsQuery); // getById - sub-goals

      const updateData = {
        target_amount: 0,
      };

      await expect(service.update('goal-1', updateData)).rejects.toThrow(ValidationError);
      await expect(service.update('goal-1', updateData)).rejects.toThrow('Target amount must be greater than zero');
    });
  });

  describe('createSubGoal', () => {
    it('should throw ValidationError if sub-goal end date is before start date', async () => {
      const parentGoal = {
        id: 'goal-1',
        name: 'Emergency Fund',
        target_amount: 10000,
        current_amount: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
        user_id: 'test-user-id',
        sub_goals: [],
        progress_percent: 0,
      };

      // Mock getById - first call for goal, second for sub-goals
      const goalQuery = createQueryBuilder();
      goalQuery.single.mockResolvedValue({ data: parentGoal, error: null });
      
      // Mock getById - sub-goals query (already returns { data: [], error: null } by default)
      const subGoalsQuery = createQueryBuilder();

      (mockSupabase.from as any)
        .mockReturnValueOnce(goalQuery) // getById - goal
        .mockReturnValueOnce(subGoalsQuery); // getById - sub-goals

      const subGoalData = {
        name: 'Save first 1000',
        start_date: '2026-12-31',
        end_date: '2026-01-01', // End date before start date
        status: 'Not Started' as const,
        priority: 'Medium' as const,
      };

      await expect(service.createSubGoal('goal-1', subGoalData)).rejects.toThrow(ValidationError);
      await expect(service.createSubGoal('goal-1', subGoalData)).rejects.toThrow('End Date must be after Start Date');
    });

    it('should allow sub-goal with no dates', async () => {
      const parentGoal = {
        id: 'goal-1',
        name: 'Emergency Fund',
        target_amount: 10000,
        current_amount: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
        user_id: 'test-user-id',
        sub_goals: [],
        progress_percent: 0,
      };

      const mockSubGoal = {
        id: 'subgoal-1',
        financial_goal_id: 'goal-1',
        name: 'Save first 1000',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
        progress: 0,
      };

      // Mock getById calls - goal query
      const goalQuery = createQueryBuilder();
      goalQuery.single.mockResolvedValue({ data: parentGoal, error: null });
      
      // Mock getById - sub-goals query
      const subGoalsQuery = createQueryBuilder();
      subGoalsQuery.single.mockResolvedValue({ data: [], error: null });

      // Mock insert chain
      const insertChain = createQueryBuilder();
      insertChain.single.mockResolvedValue({ data: mockSubGoal, error: null });

      // Mock update chain for has_sub_goals
      const updateChain = createQueryBuilder();
      updateChain.eq.mockResolvedValue({ data: null, error: null });

      (mockSupabase.from as any)
        .mockReturnValueOnce(goalQuery) // getById - goal query
        .mockReturnValueOnce(subGoalsQuery) // getById - sub-goals query
        .mockReturnValueOnce(insertChain) // createSubGoal - insert
        .mockReturnValueOnce(updateChain); // createSubGoal - update has_sub_goals

      const subGoalData = {
        name: 'Save first 1000',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
      };

      const result = await service.createSubGoal('goal-1', subGoalData);

      expect(result).toEqual(mockSubGoal);
    });
  });

  describe('updateSubGoal', () => {
    it('should throw ValidationError if progress is greater than 100', async () => {
      const existingSubGoal = {
        id: 'subgoal-1',
        financial_goal_id: 'goal-1',
        name: 'Save first 1000',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
        progress: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      };

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: existingSubGoal, error: null }),
        update: vi.fn().mockReturnThis(),
      });

      const updateData = {
        progress: 150, // Progress > 100
      };

      await expect(service.updateSubGoal('subgoal-1', updateData)).rejects.toThrow(ValidationError);
      await expect(service.updateSubGoal('subgoal-1', updateData)).rejects.toThrow('Progress must be between 0 and 100');
    });

    it('should throw ValidationError if progress is negative', async () => {
      const existingSubGoal = {
        id: 'subgoal-1',
        financial_goal_id: 'goal-1',
        name: 'Save first 1000',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
        progress: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      };

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: existingSubGoal, error: null }),
        update: vi.fn().mockReturnThis(),
      });

      const updateData = {
        progress: -10, // Negative progress
      };

      await expect(service.updateSubGoal('subgoal-1', updateData)).rejects.toThrow(ValidationError);
      await expect(service.updateSubGoal('subgoal-1', updateData)).rejects.toThrow('Progress must be between 0 and 100');
    });

    it('should throw ValidationError if updated end date is before start date', async () => {
      const existingSubGoal = {
        id: 'subgoal-1',
        financial_goal_id: 'goal-1',
        name: 'Save first 1000',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
        progress: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      };

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: existingSubGoal, error: null }),
        update: vi.fn().mockReturnThis(),
      });

      const updateData = {
        start_date: '2026-12-31',
        end_date: '2026-01-01', // End date before start date
      };

      await expect(service.updateSubGoal('subgoal-1', updateData)).rejects.toThrow(ValidationError);
      await expect(service.updateSubGoal('subgoal-1', updateData)).rejects.toThrow('End Date must be after Start Date');
    });
  });
});
