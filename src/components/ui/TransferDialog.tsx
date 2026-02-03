'use client';

import { useState, useEffect, useCallback, ReactNode, createContext, useContext } from 'react';
import Link from 'next/link';
import { Button } from './Button';
import { Card } from './Card';
import { Input, Select, Textarea } from './Input';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { TransferService, SettingsService } from '@/lib/services';
import { filterValidPaymentMethods, DEFAULT_PAYMENT_METHODS, validateBankType } from '@/lib/utils/payment-methods';

type TransferMode = 'transfer' | 'drawdown';

interface BudgetOption {
  id: string;
  name: string;
  amount_left: number;
}

interface BudgetOptionBasic {
  id: string;
  name: string;
}

interface GoalOption {
  id: string;
  name: string;
  current_amount: number;
}

export interface TransferDialogOptions {
  monthlyOverviewId: string;
  goalId?: string;
  goalName?: string;
  currentAmount?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface TransferDialogContextValue {
  showTransferDialog: (options: TransferDialogOptions) => void;
}

const TransferDialogContext = createContext<TransferDialogContextValue | undefined>(undefined);

export function useTransferDialog() {
  const context = useContext(TransferDialogContext);
  if (!context) {
    throw new Error('useTransferDialog must be used within TransferDialogProvider');
  }
  return context;
}

export function TransferDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<TransferDialogOptions | null>(null);
  const [mode, setMode] = useState<TransferMode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [budgets, setBudgets] = useState<BudgetOption[]>([]);
  const [allBudgetsForDestination, setAllBudgetsForDestination] = useState<BudgetOptionBasic[]>([]);
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>([]);

  const [formData, setFormData] = useState({
    sourceType: 'budget' as 'budget' | 'goal',
    fromBudgetId: '',
    fromGoalId: '',
    toBudgetId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    bank: '',
    notes: '',
  });

  const showTransferDialog = useCallback((newOptions: TransferDialogOptions) => {
    setOptions(newOptions);
    setIsOpen(true);
    setMode(null);
    setError(null);
    setFormData({
      sourceType: 'budget',
      fromBudgetId: '',
      fromGoalId: newOptions.goalId || '',
      toBudgetId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      bank: '',
      notes: '',
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !options) return;
    const currentOptions = options;
    async function loadData() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('You must be logged in');
          return;
        }
        const [budgetRes, allBudgetsRes, goalRes, settingsRes] = await Promise.all([
          supabase.from('budget_summary').select('id, name, amount_left').eq('monthly_overview_id', currentOptions.monthlyOverviewId).gt('amount_left', 0).order('name'),
          supabase.from('budgets').select('id, name').eq('monthly_overview_id', currentOptions.monthlyOverviewId).order('name'),
          supabase.from('financial_goals').select('id, name, current_amount').gt('current_amount', 0).in('status', ['Not Started', 'In Progress', 'On Hold']).order('name'),
          new SettingsService(supabase).getPaymentMethods(),
        ]);
        if (budgetRes.data) setBudgets(budgetRes.data as BudgetOption[]);
        if (allBudgetsRes.data) setAllBudgetsForDestination(allBudgetsRes.data as BudgetOptionBasic[]);
        if (goalRes.data) setGoals(goalRes.data as GoalOption[]);
        const methods = settingsRes.length > 0 ? filterValidPaymentMethods(settingsRes) : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(methods);
        setFormData(prev => ({
          ...prev,
          fromGoalId: prev.fromGoalId || (currentOptions.goalId ?? (goalRes.data?.[0] ? (goalRes.data[0] as GoalOption).id : '')),
          bank: prev.bank || (methods[0]?.value ?? 'Revolut'),
        }));
      } catch (err) {
        console.error('Error loading transfer dialog data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    }
    loadData();
  }, [isOpen, options]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!options) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const transferService = new TransferService(supabase);
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        setError('Amount must be greater than zero');
        setIsLoading(false);
        return;
      }
      const payload = {
        amount,
        date: formData.date,
        description: formData.description || undefined,
        notes: formData.notes || undefined,
        bank: validateBankType(formData.bank),
      };

      if (mode === 'drawdown') {
        const goalId = options.goalId || formData.fromGoalId;
        if (!goalId) {
          setError('Please select a goal');
          setIsLoading(false);
          return;
        }
        const goal = goals.find(g => g.id === goalId) || (options.goalId && options.currentAmount != null ? { current_amount: options.currentAmount } : null);
        if (goal && (goal as GoalOption).current_amount != null && (goal as GoalOption).current_amount < amount) {
          setError(`Amount exceeds available balance (${(goal as GoalOption).current_amount.toFixed(2)})`);
          setIsLoading(false);
          return;
        }
        await transferService.createGoalDrawdown(options.monthlyOverviewId, goalId, payload);
      } else {
        if (formData.sourceType === 'goal') {
          const goalId = formData.fromGoalId;
          if (!goalId || !formData.toBudgetId) {
            setError('Please select source goal and destination budget');
            setIsLoading(false);
            return;
          }
          const goal = goals.find(g => g.id === goalId);
          if (goal && goal.current_amount < amount) {
            setError(`Amount exceeds goal balance (${goal.current_amount.toFixed(2)})`);
            setIsLoading(false);
            return;
          }
          await transferService.createGoalToBudget(options.monthlyOverviewId, goalId, formData.toBudgetId, payload);
        } else {
          if (!formData.fromBudgetId || !formData.toBudgetId) {
            setError('Please select source and destination budgets');
            setIsLoading(false);
            return;
          }
          const fromBudget = budgets.find(b => b.id === formData.fromBudgetId);
          if (fromBudget && fromBudget.amount_left < amount) {
            setError(`Amount exceeds source budget (${fromBudget.amount_left.toFixed(2)} left)`);
            setIsLoading(false);
            return;
          }
          await transferService.createBudgetToBudget(
            options.monthlyOverviewId,
            formData.fromBudgetId,
            formData.toBudgetId,
            payload
          );
        }
      }
      setIsOpen(false);
      setOptions(null);
      setMode(null);
      options.onSuccess?.();
    } catch (err) {
      console.error('Error creating transfer:', err);
      setError(err instanceof Error ? err.message : 'Failed to create transfer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    options?.onCancel?.();
    setIsOpen(false);
    setOptions(null);
    setMode(null);
    setError(null);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleCancel();
  };

  const canSubmit =
    formData.amount &&
    parseFloat(formData.amount) > 0 &&
    formData.date &&
    (mode === 'drawdown'
      ? (options?.goalId || formData.fromGoalId)
      : mode === 'transfer' &&
        (formData.sourceType === 'goal'
          ? formData.fromGoalId && formData.toBudgetId
          : formData.fromBudgetId && formData.toBudgetId));

  const destinationBudgets =
    formData.sourceType === 'budget'
      ? allBudgetsForDestination.filter(b => b.id !== formData.fromBudgetId)
      : allBudgetsForDestination;

  return (
    <TransferDialogContext.Provider value={{ showTransferDialog }}>
      {children}
      {isOpen && options && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-dialog-title"
        >
          <Card
            variant="raised"
            padding="lg"
            className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 id="transfer-dialog-title" className="text-title text-[var(--color-text)]">
                Transfer
              </h2>
              <Link
                href={`/months/${options.monthlyOverviewId}/transfers`}
                className="text-small text-[var(--color-primary)] hover:underline"
                onClick={handleCancel}
              >
                View transfers
              </Link>
            </div>

            {mode === null ? (
              <>
                <p className="text-small text-[var(--color-text-muted)] mb-6">
                  Choose how you want to move money.
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-center"
                    onClick={() => setMode('transfer')}
                  >
                    Transfer between categories
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-center"
                    onClick={() => setMode('drawdown')}
                  >
                    Draw down and use (into DrawDown category)
                  </Button>
                </div>
                <div className="flex justify-end pt-4 mt-4 border-t border-[var(--color-border)]">
                  <Button type="button" variant="secondary" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-small text-[var(--color-text-muted)] mb-4">
                  {mode === 'drawdown'
                    ? 'Withdraw from a goal into the DrawDown category for use.'
                    : 'Move money between budget categories or from a goal to a category.'}
                </p>
                {error && (
                  <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-small text-[var(--color-danger)]">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {mode === 'transfer' && (
                    <>
                      <div className="mb-4">
                        <label className="block text-small font-medium text-[var(--color-text)] mb-2">From budget</label>
                        <Select
                          name="fromBudgetId"
                          value={formData.fromBudgetId}
                          onChange={handleChange}
                          options={budgets.map(b => ({ value: b.id, label: `${b.name} (€${b.amount_left.toFixed(0)} left)` }))}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-small font-medium text-[var(--color-text)] mb-2">To budget</label>
                        <Select
                          name="toBudgetId"
                          value={formData.toBudgetId}
                          onChange={handleChange}
                          options={destinationBudgets.map(b => ({ value: b.id, label: b.name }))}
                          disabled={isLoading}
                        />
                      </div>
                    </>
                  )}
                  {mode === 'drawdown' && (
                    <>
                      <div className="mb-4">
                        <label className="block text-small font-medium text-[var(--color-text)] mb-2">From goal</label>
                        <Select
                          name="fromGoalId"
                          value={options.goalId || formData.fromGoalId}
                          onChange={e => setFormData(prev => ({ ...prev, fromGoalId: e.target.value }))}
                          options={goals.map(g => ({ value: g.id, label: `${g.name} (€${g.current_amount.toFixed(0)})` }))}
                          disabled={isLoading || !!options.goalId}
                        />
                      </div>
                      <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] text-small text-[var(--color-text-muted)]">
                        Destination: <strong className="text-[var(--color-text)]">DrawDown</strong> (variable category)
                      </div>
                    </>
                  )}

                  <div className="mb-4">
                    <label className="block text-small font-medium text-[var(--color-text)] mb-2">Amount *</label>
                    <Input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-small font-medium text-[var(--color-text)] mb-2">Date *</label>
                    <Input name="date" type="date" value={formData.date} onChange={handleChange} required disabled={isLoading} />
                  </div>
                  <div className="mb-4">
                    <label className="block text-small font-medium text-[var(--color-text)] mb-2">Payment method</label>
                    <Select name="bank" value={formData.bank} onChange={handleChange} options={paymentMethods} disabled={isLoading} />
                  </div>
                  <div className="mb-4">
                    <label className="block text-small font-medium text-[var(--color-text)] mb-2">Description</label>
                    <Input name="description" type="text" value={formData.description} onChange={handleChange} disabled={isLoading} placeholder="Optional" />
                  </div>
                  <div className="mb-6">
                    <label className="block text-small font-medium text-[var(--color-text)] mb-2">Notes</label>
                    <Textarea name="notes" value={formData.notes} onChange={handleChange} disabled={isLoading} placeholder="Optional" rows={2} />
                  </div>
                  <div className="flex gap-3 justify-end pt-4 border-t border-[var(--color-border)]">
                    <Button type="button" variant="secondary" onClick={() => setMode(null)} disabled={isLoading}>
                      Back
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleCancel} disabled={isLoading}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" isLoading={isLoading} disabled={!canSubmit}>
                      {mode === 'drawdown' ? 'Draw down' : 'Transfer'}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </Card>
        </div>
      )}
    </TransferDialogContext.Provider>
  );
}
