'use client';

import { useState, useEffect, useCallback, ReactNode, createContext, useContext } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Input, Select, Textarea } from './Input';
import { Currency } from './Currency';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { GoalDrawdownService } from '@/lib/services';
import { SettingsService } from '@/lib/services';
import { filterValidPaymentMethods, DEFAULT_PAYMENT_METHODS, validateBankType } from '@/lib/utils/payment-methods';

interface GoalOption {
  id: string;
  name: string;
  current_amount: number;
}

interface DrawdownGoalDialogOptions {
  goalId?: string; // Optional - if not provided, user selects from dropdown
  goalName?: string;
  currentAmount?: number;
  monthlyOverviewId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface DrawdownGoalDialogContextValue {
  showDrawdownGoalDialog: (options: DrawdownGoalDialogOptions) => void;
}

const DrawdownGoalDialogContext = createContext<DrawdownGoalDialogContextValue | undefined>(undefined);

export function useDrawdownGoalDialog() {
  const context = useContext(DrawdownGoalDialogContext);
  if (!context) {
    throw new Error('useDrawdownGoalDialog must be used within DrawdownGoalDialogProvider');
  }
  return context;
}

export function DrawdownGoalDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DrawdownGoalDialogOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>([]);
  const [formData, setFormData] = useState({
    goalId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    bank: '',
    notes: '',
  });


  const showDrawdownGoalDialog = useCallback((newOptions: DrawdownGoalDialogOptions) => {
    setOptions(newOptions);
    setIsOpen(true);
    setError(null);
    // Reset form
    setFormData({
      goalId: newOptions.goalId || '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      bank: '',
      notes: '',
    });
  }, []);

  // Load goals and payment methods when dialog opens
  useEffect(() => {
    if (!isOpen || !options) return;

    // Capture options in a local variable for TypeScript
    const currentOptions = options;

    async function loadData() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setError('You must be logged in');
          return;
        }

        // If goalId is not provided, fetch goals with balance > 0
        if (!currentOptions.goalId) {
          const { data: goalData, error: goalError } = await supabase
            .from('financial_goals')
            .select('id, name, current_amount')
            .gt('current_amount', 0)
            .in('status', ['Not Started', 'In Progress', 'On Hold'])
            .order('name');

          if (!goalError && goalData) {
            setGoals(goalData);
            // Set default goal if available
            if (goalData.length > 0 && !formData.goalId) {
              setFormData(prev => ({ ...prev, goalId: goalData[0].id }));
            }
          }
        }

        // Fetch payment methods from settings
        const settingsService = new SettingsService(supabase);
        const methods = await settingsService.getPaymentMethods();
        // Filter to only valid bank_type enum values
        const validMethods = methods.length > 0 
          ? filterValidPaymentMethods(methods)
          : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(validMethods);
        
        // Set default bank if available (use filtered valid methods)
        if (validMethods.length > 0 && !formData.bank) {
          setFormData(prev => ({ ...prev, bank: validMethods[0].value }));
        } else if (!formData.bank) {
          setFormData(prev => ({ ...prev, bank: 'Revolut' }));
        }
      } catch (err) {
        console.error('Error loading drawdown goal dialog data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    }

    loadData();
  }, [isOpen, options]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!options) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const drawdownService = new GoalDrawdownService(supabase);

      // Determine goalId - use from options if provided, otherwise from form
      const goalId = options.goalId || formData.goalId;
      if (!goalId) {
        setError('Please select a goal');
        setIsLoading(false);
        return;
      }

      // Get current amount - use from options if provided, otherwise from selected goal
      let currentAmount = options.currentAmount;
      if (!currentAmount && formData.goalId) {
        const selectedGoal = goals.find(g => g.id === formData.goalId);
        if (!selectedGoal) {
          setError('Selected goal not found');
          setIsLoading(false);
          return;
        }
        currentAmount = selectedGoal.current_amount;
      }

      if (!currentAmount || currentAmount <= 0) {
        setError('Selected goal has no available balance');
        setIsLoading(false);
        return;
      }

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        setError('Amount must be greater than zero');
        setIsLoading(false);
        return;
      }

      if (amount > currentAmount) {
        setError(`Amount exceeds available balance of ${currentAmount.toFixed(2)}`);
        setIsLoading(false);
        return;
      }

      await drawdownService.create(options.monthlyOverviewId, goalId, {
        amount,
        date: formData.date,
        description: formData.description || undefined,
        bank: validateBankType(formData.bank),
        notes: formData.notes || undefined,
      });

      // Success - close dialog and call callback
      setIsOpen(false);
      setOptions(null);
      if (options.onSuccess) {
        options.onSuccess();
      }
    } catch (err) {
      console.error('Error creating goal drawdown:', err);
      setError(err instanceof Error ? err.message : 'Failed to drawdown from goal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (options?.onCancel) {
      options.onCancel();
    }
    setIsOpen(false);
    setOptions(null);
    setError(null);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  // Get selected goal's current amount
  const selectedGoal = options?.goalId 
    ? { id: options.goalId, current_amount: options.currentAmount || 0 }
    : goals.find(g => g.id === formData.goalId);
  const currentAmount = selectedGoal?.current_amount || 0;
  
  const drawdownAmount = parseFloat(formData.amount) || 0;
  const remainingAfterDrawdown = currentAmount - drawdownAmount;

  return (
    <DrawdownGoalDialogContext.Provider value={{ showDrawdownGoalDialog }}>
      {children}
      {isOpen && options && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawdown-goal-dialog-title"
        >
          <Card
            variant="raised"
            padding="lg"
            className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="drawdown-goal-dialog-title"
              className="text-title text-[var(--color-text)] mb-2"
            >
              Drawdown from Goal
            </h2>
            <p className="text-small text-[var(--color-text-muted)] mb-6">
              {options.goalName 
                ? `Withdraw money from ${options.goalName}.`
                : 'Withdraw money from a goal.'}
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-small text-[var(--color-danger)]">
                {error}
              </div>
            )}

            {/* Current Balance Display */}
            {currentAmount > 0 && (
              <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-small text-[var(--color-text-muted)]">Current Balance</span>
                  <Currency amount={currentAmount} size="lg" showSign />
                </div>
                {drawdownAmount > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                    <span className="text-small text-[var(--color-text-muted)]">Remaining After Drawdown</span>
                    <Currency 
                      amount={remainingAfterDrawdown} 
                      size="md" 
                      showSign 
                      colorCode={remainingAfterDrawdown < 0}
                    />
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Goal Selection (only show if goalId not provided) */}
              {!options.goalId && (
                <div className="mb-4">
                  <label htmlFor="goalId" className="block text-small font-medium text-[var(--color-text)] mb-2">
                    Goal <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <Select
                    id="goalId"
                    name="goalId"
                    value={formData.goalId}
                    onChange={handleChange}
                    options={goals.map(goal => ({
                      value: goal.id,
                      label: `${goal.name} (${goal.current_amount.toFixed(2)})`,
                    }))}
                    disabled={isLoading}
                    required
                  />
                </div>
              )}

              {/* Amount */}
              <div className="mb-4">
                <label htmlFor="amount" className="block text-small font-medium text-[var(--color-text)] mb-2">
                  Amount <span className="text-[var(--color-danger)]">*</span>
                </label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={currentAmount}
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  disabled={isLoading || currentAmount <= 0}
                  placeholder="0.00"
                />
                {currentAmount > 0 && (
                  <p className="mt-1 text-caption text-[var(--color-text-muted)]">
                    Maximum: {currentAmount.toFixed(2)}
                  </p>
                )}
                {currentAmount <= 0 && formData.goalId && (
                  <p className="mt-1 text-caption text-[var(--color-danger)]">
                    Selected goal has no available balance
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="mb-4">
                <label htmlFor="date" className="block text-small font-medium text-[var(--color-text)] mb-2">
                  Date <span className="text-[var(--color-danger)]">*</span>
                </label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Payment Method/Bank */}
              <div className="mb-4">
                <label htmlFor="bank" className="block text-small font-medium text-[var(--color-text)] mb-2">
                  Payment Method
                </label>
                <Select
                  id="bank"
                  name="bank"
                  value={formData.bank}
                  onChange={handleChange}
                  options={paymentMethods}
                  disabled={isLoading}
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label htmlFor="description" className="block text-small font-medium text-[var(--color-text)] mb-2">
                  Description
                </label>
                <Input
                  id="description"
                  name="description"
                  type="text"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={isLoading}
                  placeholder="Optional description"
                />
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label htmlFor="notes" className="block text-small font-medium text-[var(--color-text)] mb-2">
                  Notes
                </label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  disabled={isLoading}
                  placeholder="Optional notes"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-[var(--color-border)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  isLoading={isLoading}
                  disabled={!formData.amount || drawdownAmount <= 0 || drawdownAmount > currentAmount || currentAmount <= 0 || (!options.goalId && !formData.goalId)}
                >
                  Drawdown
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </DrawdownGoalDialogContext.Provider>
  );
}
