/**
 * Financial Goal Service
 * 
 * Handles all business logic for financial goals and sub-goals.
 * 
 * Key Business Rules:
 * 1. End Date must be after Start Date (for both goals and sub-goals)
 *    (Replicates Salesforce Validation Rule)
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  FinancialGoal, 
  FinancialGoalInsert, 
  FinancialGoalUpdate,
  FinancialSubGoal,
  FinancialSubGoalInsert,
  FinancialSubGoalUpdate,
  FinancialGoalWithSubGoals
} from '@/lib/supabase/database.types';
import { 
  NotFoundError, 
  UnauthorizedError,
  ValidationError 
} from './errors';
import { logGoalCreated, logGoalUpdated, logSubGoalCreated, logError } from '@/lib/utils/logger';

export class FinancialGoalService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current authenticated user ID
   * @throws UnauthorizedError if user is not authenticated
   */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if ( !user) {
      throw new UnauthorizedError();
    }
    return user.id;
  }

  /**
   * Validate that end date is after start date
   * @throws ValidationError if dates are invalid
   */
  private validateDateRange(startDate: string, endDate: string | null | undefined, fieldName: string = 'end_date'): void {
    if (endDate && new Date(endDate) < new Date(startDate)) {
      throw new ValidationError('End Date must be after Start Date', fieldName);
    }
  }

  /**
   * Create a new financial goal
   * 
   * Validates:
   * 1. End Date must be after Start Date
   * 
   * @param data - Financial goal data
   * @returns The created financial goal
   */
  async create(data: Omit<FinancialGoalInsert, 'user_id'>): Promise<FinancialGoal> {
    const userId = await this.getUserId();

    // Validate date range
    this.validateDateRange(data.start_date, data.end_date);

    // Validate target amount is positive
    if (data.target_amount <= 0) {
      throw new ValidationError('Target amount must be greater than zero', 'target_amount');
    }

    // Create the financial goal
    // Store the initial current_amount as base_amount, and set current_amount to the same value
    // (expenses will be added to this later)
    const initialAmount = data.current_amount || 0;
    const { data: goal, error } = await this.supabase
      .from('financial_goals')
      .insert({
        ...data,
        user_id: userId,
        current_amount: initialAmount,
        base_amount: initialAmount, // Store initial amount as base
      })
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to create financial goal: ${error.message}`), {
        event: 'goal.create.failed',
        userId,
        metadata: { name: data.name, targetAmount: data.target_amount },
      });
      throw new Error(`Failed to create financial goal: ${error.message}`);
    }

    // Log successful goal creation
    logGoalCreated({
      goalId: goal.id,
      userId,
      name: goal.name,
      targetAmount: goal.target_amount,
      startDate: goal.start_date,
      endDate: goal.end_date,
      goalType: goal.goal_type,
    });

    return goal;
  }

  /**
   * Get all financial goals for the current user
   * @param status - Optional filter by status
   */
  async getAll(status?: string): Promise<FinancialGoal[]> {
    await this.getUserId();

    let query = this.supabase
      .from('financial_goals')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch financial goals: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Recalculate and update the goal's current_amount based on base_amount + linked expenses
   * @param id - Financial goal ID
   */
  async recalculateCurrentAmount(id: string): Promise<void> {
    await this.getUserId();

    // Get the current goal to get base_amount
    const { data: goal, error: goalError } = await this.supabase
      .from('financial_goals')
      .select('base_amount, current_amount')
      .eq('id', id)
      .single();

    if (goalError || !goal) {
      console.error(`Error fetching goal ${id}:`, goalError);
      return;
    }

    // Get all expenses linked to this goal
    const { data: expenses, error: expensesError } = await this.supabase
      .from('expenses')
      .select('amount')
      .eq('financial_goal_id', id);

    if (expensesError) {
      console.error(`Error fetching expenses for goal ${id}:`, expensesError);
      return;
    }

    // Calculate total from linked expenses
    const totalFromExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount || 0), 0) || 0;

    // Get base_amount (initial/manual amount)
    // If base_amount doesn't exist (migration not run), calculate it from current_amount - expenses
    let baseAmount: number;
    if (goal.base_amount !== null && goal.base_amount !== undefined) {
      // base_amount exists, use it
      baseAmount = Number(goal.base_amount);
    } else {
      // base_amount doesn't exist yet, calculate it from current_amount - expenses
      // This handles the case where migration hasn't been run
      const currentAmount = Number(goal.current_amount || 0);
      baseAmount = Math.max(0, currentAmount - totalFromExpenses);
    }

    // New current_amount = base_amount + sum of linked expenses
    const newCurrentAmount = baseAmount + totalFromExpenses;

    console.log(`Recalculating goal ${id}:`, {
      baseAmount,
      totalFromExpenses,
      newCurrentAmount,
      oldCurrentAmount: goal.current_amount,
    });

    // Update the goal's current_amount and base_amount (in case base_amount was null)
    const { error: updateError } = await this.supabase
      .from('financial_goals')
      .update({ 
        current_amount: newCurrentAmount,
        base_amount: baseAmount // Ensure base_amount is set
      })
      .eq('id', id);

    if (updateError) {
      console.error(`Error updating current_amount for goal ${id}:`, updateError);
    } else {
      console.log(`Successfully updated goal ${id} current_amount to ${newCurrentAmount}`);
    }
  }

  /**
   * Get a single financial goal by ID with sub-goals
   * @param id - Financial goal ID
   * @param recalculate - If true, recalculate current_amount from linked expenses before returning
   */
  async getById(id: string, recalculate: boolean = true): Promise<FinancialGoalWithSubGoals> {
    await this.getUserId();

    // Recalculate current_amount from actual linked expenses to ensure accuracy
    if (recalculate) {
      await this.recalculateCurrentAmount(id);
    }

    // Get the goal
    const { data: goal, error: goalError } = await this.supabase
      .from('financial_goals')
      .select('*')
      .eq('id', id)
      .single();

    if (goalError || !goal) {
      throw new NotFoundError('Financial Goal', id);
    }

    // Get sub-goals
    const { data: subGoals, error: subGoalsError } = await this.supabase
      .from('financial_sub_goals')
      .select('*')
      .eq('financial_goal_id', id)
      .order('created_at', { ascending: true });

    if (subGoalsError) {
      throw new Error(`Failed to fetch sub-goals: ${subGoalsError.message}`);
    }

    // Calculate progress
    const progressPercent = goal.target_amount > 0 
      ? (goal.current_amount / goal.target_amount) * 100 
      : 0;

    return {
      ...goal,
      sub_goals: subGoals || [],
      progress_percent: Math.min(100, Math.max(0, progressPercent)),
    };
  }

  /**
   * Update a financial goal
   * @param id - Financial goal ID
   * @param data - Fields to update
   */
  async update(id: string, data: FinancialGoalUpdate): Promise<FinancialGoal> {
    await this.getUserId();

    // Get existing goal to validate dates and get current expenses
    const existingGoal = await this.getById(id, false); // Don't recalculate yet

    // Validate date range if dates are provided
    const startDate = data.start_date || existingGoal.start_date;
    const endDate = data.end_date !== undefined ? data.end_date : existingGoal.end_date;
    
    this.validateDateRange(startDate, endDate);

    // Validate target amount if provided
    if (data.target_amount !== undefined && data.target_amount <= 0) {
      throw new ValidationError('Target amount must be greater than zero', 'target_amount');
    }

    // If current_amount is being updated manually, we need to update base_amount
    // Get sum of linked expenses to calculate the new base_amount
    if (data.current_amount !== undefined) {
      const { data: expenses } = await this.supabase
        .from('expenses')
        .select('amount')
        .eq('financial_goal_id', id);

      const totalFromExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount || 0), 0) || 0;
      
      // When user manually sets current_amount, the base_amount = current_amount - expenses
      // This ensures that when we recalculate, we get: base_amount + expenses = current_amount
      const newBaseAmount = Math.max(0, data.current_amount - totalFromExpenses);
      
      // Update both current_amount and base_amount
      data = {
        ...data,
        base_amount: newBaseAmount,
      } as any; // Type assertion needed because base_amount might not be in FinancialGoalUpdate type
    }

    const { data: updated, error } = await this.supabase
      .from('financial_goals')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to update financial goal: ${error.message}`), {
        event: 'goal.update.failed',
        metadata: { goalId: id },
      });
      throw new Error(`Failed to update financial goal: ${error.message}`);
    }

    if ( !updated) {
      throw new NotFoundError('Financial Goal', id);
    }

    // Log successful update
    logGoalUpdated({
      goalId: updated.id,
      metadata: data as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * Delete a financial goal
   * This will cascade delete all related sub-goals
   * 
   * @param id - Financial goal ID
   */
  async delete(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('financial_goals')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete financial goal: ${error.message}`);
    }
  }

  /**
   * Create a sub-goal
   * 
   * Validates:
   * 1. End Date must be after Start Date (if both provided)
   * 
   * @param goalId - Parent financial goal ID
   * @param data - Sub-goal data
   * @returns The created sub-goal
   */
  async createSubGoal(goalId: string, data: Omit<FinancialSubGoalInsert, 'financial_goal_id'>): Promise<FinancialSubGoal> {
    await this.getUserId();

    // Verify parent goal exists and belongs to user
    await this.getById(goalId);

    // Validate date range if both dates are provided
    if (data.start_date && data.end_date) {
      this.validateDateRange(data.start_date, data.end_date);
    }

    // Create the sub-goal
    const { data: subGoal, error } = await this.supabase
      .from('financial_sub_goals')
      .insert({
        ...data,
        financial_goal_id: goalId,
        progress: data.progress || 0,
      })
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to create sub-goal: ${error.message}`), {
        event: 'subgoal.create.failed',
        metadata: { goalId, name: data.name },
      });
      throw new Error(`Failed to create sub-goal: ${error.message}`);
    }

    // Update parent goal's has_sub_goals flag
    await this.supabase
      .from('financial_goals')
      .update({ has_sub_goals: true })
      .eq('id', goalId);

    // Log successful sub-goal creation
    logSubGoalCreated({
      subGoalId: subGoal.id,
      goalId,
      name: subGoal.name,
      estimatedCost: subGoal.estimated_cost,
    });

    return subGoal;
  }

  /**
   * Update a sub-goal
   * @param subGoalId - Sub-goal ID
   * @param data - Fields to update
   */
  async updateSubGoal(subGoalId: string, data: FinancialSubGoalUpdate): Promise<FinancialSubGoal> {
    await this.getUserId();

    // Get existing sub-goal to validate dates
    const { data: existing, error: fetchError } = await this.supabase
      .from('financial_sub_goals')
      .select('*')
      .eq('id', subGoalId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('Financial Sub-Goal', subGoalId);
    }

    // Validate date range if dates are provided
    const startDate = data.start_date !== undefined ? data.start_date : existing.start_date;
    const endDate = data.end_date !== undefined ? data.end_date : existing.end_date;
    
    if (startDate && endDate) {
      this.validateDateRange(startDate, endDate);
    }

    // Validate progress is between 0 and 100
    if (data.progress !== undefined && (data.progress < 0 || data.progress > 100)) {
      throw new ValidationError('Progress must be between 0 and 100', 'progress');
    }

    const { data: updated, error } = await this.supabase
      .from('financial_sub_goals')
      .update(data)
      .eq('id', subGoalId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update sub-goal: ${error.message}`);
    }

    if ( !updated) {
      throw new NotFoundError('Financial Sub-Goal', subGoalId);
    }

    return updated;
  }

  /**
   * Delete a sub-goal
   * @param subGoalId - Sub-goal ID
   */
  async deleteSubGoal(subGoalId: string): Promise<void> {
    await this.getUserId();

    // Get sub-goal to check if we need to update parent goal
    const { data: subGoal } = await this.supabase
      .from('financial_sub_goals')
      .select('financial_goal_id')
      .eq('id', subGoalId)
      .single();

    const { error } = await this.supabase
      .from('financial_sub_goals')
      .delete()
      .eq('id', subGoalId);

    if (error) {
      throw new Error(`Failed to delete sub-goal: ${error.message}`);
    }

    // Check if parent goal has any remaining sub-goals
    if (subGoal) {
      const { count } = await this.supabase
        .from('financial_sub_goals')
        .select('*', { count: 'exact', head: true })
        .eq('financial_goal_id', subGoal.financial_goal_id);

      // Update parent goal's has_sub_goals flag
      await this.supabase
        .from('financial_goals')
        .update({ has_sub_goals: (count || 0) > 0 })
        .eq('id', subGoal.financial_goal_id);
    }
  }
}
