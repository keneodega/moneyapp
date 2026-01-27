'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Button, useToast, useConfirmDialog } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ExpenseService } from '@/lib/services';
import { SkeletonList } from '@/components/ui';

interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  frequency: string;
  budget_name: string;
  month_name: string;
  last_created?: string;
  next_due?: string;
}

export default function RecurringExpensesPage() {
  const toast = useToast();
  const confirmDialog = useConfirmDialog();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const loadRecurringExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return;
      }

      // Fetch all recurring expenses
      const { data: expensesData, error } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          recurring_frequency,
          date,
          budgets!inner(
            id,
            name,
            monthly_overview_id,
            monthly_overviews!inner(id, name)
          )
        `)
        .eq('user_id', user.id)
        .eq('is_recurring', true)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform data
      const transformed = (expensesData || []).map((exp: any) => ({
        id: exp.id,
        description: exp.description || 'Recurring Expense',
        amount: Number(exp.amount),
        frequency: exp.recurring_frequency || 'Monthly',
        budget_name: exp.budgets?.name || '',
        month_name: exp.budgets?.monthly_overviews?.name || '',
        last_created: exp.date,
      }));

      setExpenses(transformed);
    } catch (error) {
      console.error('Failed to load recurring expenses:', error);
      toast.showToast('Failed to load recurring expenses', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRecurringExpenses();
  }, [loadRecurringExpenses]);

  const handleCreateExpense = useCallback(async (expenseId: string) => {
    setIsProcessing(expenseId);
    try {
      const supabase = createSupabaseBrowserClient();
      const expenseService = new ExpenseService(supabase);
      
      // Get the expense details
      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) {
        throw new Error('Expense not found');
      }

      // Get current month
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Find or create current month's budget
      const { data: budgets } = await supabase
        .from('budgets')
        .select('id, monthly_overview_id, monthly_overviews!inner(id, name, start_date, end_date)')
        .eq('name', expense.budget_name)
        .gte('monthly_overviews.start_date', currentMonth.toISOString().split('T')[0])
        .lte('monthly_overviews.end_date', nextMonth.toISOString().split('T')[0])
        .limit(1)
        .single();

      if (!budgets) {
        toast.showToast('Current month budget not found. Please create the month first.', 'error');
        return;
      }

      // Create the expense for current month
      await expenseService.create({
        budget_id: budgets.id,
        amount: expense.amount,
        date: new Date().toISOString().split('T')[0],
        description: expense.description,
        is_recurring: true,
        recurring_frequency: expense.frequency as any,
      });

      toast.showToast('Recurring expense created successfully', 'success');
      await loadRecurringExpenses();
    } catch (error) {
      console.error('Failed to create expense:', error);
      toast.showToast(
        error instanceof Error ? error.message : 'Failed to create expense',
        'error'
      );
    } finally {
      setIsProcessing(null);
    }
  }, [expenses, toast, loadRecurringExpenses]);

  const handleDelete = useCallback((expenseId: string) => {
    confirmDialog.showConfirm({
      title: 'Delete Recurring Expense',
      message: 'Are you sure you want to delete this recurring expense template? This will not delete existing expenses.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          const expenseService = new ExpenseService(supabase);
          await expenseService.delete(expenseId);
          toast.showToast('Recurring expense deleted', 'success');
          await loadRecurringExpenses();
        } catch (error) {
          toast.showToast('Failed to delete recurring expense', 'error');
        }
      },
    });
  }, [confirmDialog, toast, loadRecurringExpenses]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <SkeletonList items={5} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-display text-[var(--color-text)]">Recurring Expenses</h1>
        <p className="text-body text-[var(--color-text-muted)] mt-1">
          Manage your recurring expenses and create them automatically each month
        </p>
      </div>

      {/* Info Card */}
      <Card variant="outlined" padding="md">
        <p className="text-small text-[var(--color-text-muted)]">
          Recurring expenses are templates that can be automatically created each month. 
          Mark an expense as recurring when creating it, then manage and create instances here.
        </p>
      </Card>

      {/* Expenses List */}
      {expenses.length === 0 ? (
        <Card variant="raised" padding="lg">
          <div className="text-center space-y-4">
            <p className="text-body text-[var(--color-text-muted)]">
              No recurring expenses found.
            </p>
            <p className="text-small text-[var(--color-text-muted)]">
              Mark expenses as recurring when creating them to manage them here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <Card key={expense.id} variant="raised" padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-body font-medium text-[var(--color-text)]">
                      {expense.description}
                    </h3>
                    <span className="text-caption px-2 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      {expense.frequency}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-small text-[var(--color-text-muted)]">
                    <span>
                      <strong>Amount:</strong> {formatCurrency(expense.amount)}
                    </span>
                    <span>
                      <strong>Category:</strong> {expense.budget_name}
                    </span>
                    {expense.last_created && (
                      <span>
                        <strong>Last Created:</strong> {new Date(expense.last_created).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleCreateExpense(expense.id)}
                    isLoading={isProcessing === expense.id}
                    disabled={!!isProcessing}
                    className="min-h-[44px]"
                  >
                    Create This Month
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(expense.id)}
                    disabled={!!isProcessing}
                    className="min-h-[44px]"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
