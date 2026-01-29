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

interface DrawdownGoalDialogOptions {
  goalId: string;
  goalName: string;
  currentAmount: number;
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
  const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>([]);
  const [formData, setFormData] = useState({
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
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      bank: '',
      notes: '',
    });
  }, []);

  // Load payment methods when dialog opens
  useEffect(() => {
    if (!isOpen || !options) return;

    async function loadData() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setError('You must be logged in');
          return;
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

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        setError('Amount must be greater than zero');
        setIsLoading(false);
        return;
      }

      if (amount > options.currentAmount) {
        setError(`Amount exceeds available balance of ${options.currentAmount.toFixed(2)}`);
        setIsLoading(false);
        return;
      }

      await drawdownService.create(options.monthlyOverviewId, options.goalId, {
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

  const drawdownAmount = parseFloat(formData.amount) || 0;
  const remainingAfterDrawdown = options ? options.currentAmount - drawdownAmount : 0;

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
              Withdraw money from <strong>{options.goalName}</strong>.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-small text-[var(--color-danger)]">
                {error}
              </div>
            )}

            {/* Current Balance Display */}
            <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-small text-[var(--color-text-muted)]">Current Balance</span>
                <Currency amount={options.currentAmount} size="lg" showSign />
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

            <form onSubmit={handleSubmit}>
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
                  max={options.currentAmount}
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  placeholder="0.00"
                />
                <p className="mt-1 text-caption text-[var(--color-text-muted)]">
                  Maximum: {options.currentAmount.toFixed(2)}
                </p>
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
                  disabled={!formData.amount || drawdownAmount <= 0 || drawdownAmount > options.currentAmount}
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
