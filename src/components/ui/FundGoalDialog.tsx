'use client';

import { useState, useEffect, useCallback, ReactNode, createContext, useContext } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Input, Select, Textarea } from './Input';
import { Currency } from './Currency';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { GoalContributionService } from '@/lib/services';
import { SettingsService } from '@/lib/services';
import { DEFAULT_PAYMENT_METHODS, validateBankType } from '@/lib/utils/payment-methods';

interface FundGoalDialogOptions {
  monthlyOverviewId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface FundGoalDialogContextValue {
  showFundGoalDialog: (options: FundGoalDialogOptions) => void;
}

const FundGoalDialogContext = createContext<FundGoalDialogContextValue | undefined>(undefined);

export function useFundGoalDialog() {
  const context = useContext(FundGoalDialogContext);
  if (!context) {
    throw new Error('useFundGoalDialog must be used within FundGoalDialogProvider');
  }
  return context;
}

interface GoalOption {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
}

export function FundGoalDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<FundGoalDialogOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>([]);
  const [availableIncome, setAvailableIncome] = useState<number>(0);
  const [formData, setFormData] = useState({
    goalId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    bank: '',
    notes: '',
  });


  const showFundGoalDialog = useCallback((newOptions: FundGoalDialogOptions) => {
    setOptions(newOptions);
    setIsOpen(true);
    setError(null);
    // Reset form
    setFormData({
      goalId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      bank: '',
      notes: '',
    });
  }, []);

  // Load goals, payment methods, and available income when dialog opens
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

        // Fetch active goals
        const { data: goalData, error: goalError } = await supabase
          .from('financial_goals')
          .select('id, name, target_amount, current_amount')
          .in('status', ['Not Started', 'In Progress', 'On Hold'])
          .order('name');

        if (!goalError && goalData) {
          setGoals(goalData);
        }

        // Fetch payment methods from settings
        const settingsService = new SettingsService(supabase);
        const methods = await settingsService.getPaymentMethods();
        // Use payment methods from settings directly, fall back to defaults if none
        const userMethods = methods.length > 0 ? methods : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(userMethods);

        // Set default bank if available
        if (userMethods.length > 0 && !formData.bank) {
          setFormData(prev => ({ ...prev, bank: userMethods[0].value }));
        } else if (!formData.bank) {
          setFormData(prev => ({ ...prev, bank: 'Revolut' }));
        }

        // Get available income
        const contributionService = new GoalContributionService(supabase);
        const available = await contributionService.getAvailableIncome(currentOptions.monthlyOverviewId);
        setAvailableIncome(available);
      } catch (err) {
        console.error('Error loading fund goal dialog data:', err);
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
      const contributionService = new GoalContributionService(supabase);

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        setError('Amount must be greater than zero');
        setIsLoading(false);
        return;
      }

      if (amount > availableIncome) {
        setError(`Amount exceeds available income of ${availableIncome.toFixed(2)}`);
        setIsLoading(false);
        return;
      }

      if (!formData.goalId) {
        setError('Please select a savings goal');
        setIsLoading(false);
        return;
      }

      await contributionService.create(options.monthlyOverviewId, formData.goalId, {
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
      console.error('Error creating goal contribution:', err);
      setError(err instanceof Error ? err.message : 'Failed to fund savings');
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

  const selectedGoal = goals.find(g => g.id === formData.goalId);
  const contributionAmount = parseFloat(formData.amount) || 0;
  const remainingAfterContribution = availableIncome - contributionAmount;
  const goalProgress = selectedGoal
    ? ((selectedGoal.current_amount + contributionAmount) / selectedGoal.target_amount) * 100
    : 0;

  const goalOptions = goals.map(g => ({
    value: g.id,
    label: `${g.name} (${g.current_amount.toFixed(2)} / ${g.target_amount.toFixed(2)})`,
  }));

  return (
    <FundGoalDialogContext.Provider value={{ showFundGoalDialog }}>
      {children}
      {isOpen && options && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="fund-goal-dialog-title"
        >
          <Card
            variant="raised"
            padding="lg"
            className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="fund-goal-dialog-title"
              className="text-title text-[var(--color-text)] mb-2"
            >
              Fund Savings
            </h2>
            <p className="text-small text-[var(--color-text-muted)] mb-6">
              Add money to a savings goal from your available income.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-small text-[var(--color-danger)]">
                {error}
              </div>
            )}

            {/* Available Income Display */}
            <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-small text-[var(--color-text-muted)]">Available Income</span>
                <Currency amount={availableIncome} size="lg" showSign />
              </div>
              {contributionAmount > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                  <span className="text-small text-[var(--color-text-muted)]">Remaining After Contribution</span>
                  <Currency 
                    amount={remainingAfterContribution} 
                    size="md" 
                    showSign 
                    colorCode={remainingAfterContribution < 0}
                  />
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              {/* Savings Selection */}
              <div className="mb-4">
                <label htmlFor="goalId" className="block text-small font-medium text-[var(--color-text)] mb-2">
                  Savings Goal <span className="text-[var(--color-danger)]">*</span>
                </label>
                <Select
                  id="goalId"
                  name="goalId"
                  value={formData.goalId}
                  onChange={handleChange}
                  options={goalOptions}
                  required
                  disabled={isLoading}
                />
                {selectedGoal && (
                  <div className="mt-2 text-caption text-[var(--color-text-muted)]">
                    Progress: {selectedGoal.current_amount.toFixed(2)} / {selectedGoal.target_amount.toFixed(2)} 
                    {contributionAmount > 0 && (
                      <span className="ml-2">
                        → {(selectedGoal.current_amount + contributionAmount).toFixed(2)} 
                        ({goalProgress.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                )}
              </div>

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
                  max={availableIncome}
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  placeholder="0.00"
                />
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
                  variant="primary"
                  isLoading={isLoading}
                  disabled={!formData.goalId || !formData.amount || contributionAmount <= 0 || contributionAmount > availableIncome}
                >
                  Fund Savings
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </FundGoalDialogContext.Provider>
  );
}
