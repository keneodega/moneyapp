'use client';

import { useState, useEffect } from 'react';
import { Card, Button, useToast } from '@/components/ui';
import { Currency } from '@/components/ui/Currency';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SubscriptionService } from '@/lib/services';
import type { Subscription } from '@/lib/supabase/database.types';

interface AddSubscriptionsToBudgetProps {
  monthId: string;
  startDate: string;
  endDate: string;
  onSuccess?: () => void;
}

export function AddSubscriptionsToBudget({
  monthId,
  startDate,
  endDate,
  onSuccess,
}: AddSubscriptionsToBudgetProps) {
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [totalMonthlyCost, setTotalMonthlyCost] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const service = new SubscriptionService(supabase);
      
      const subs = await service.getByDateRange(startDate, endDate, 'Active');
      setSubscriptions(subs);
      
      // Calculate total monthly cost
      const total = subs.reduce((sum, sub) => {
        return sum + SubscriptionService.calculateMonthlyCost(sub.amount, sub.frequency);
      }, 0);
      setTotalMonthlyCost(total);
      
      // Pre-select all subscriptions
      setSelectedIds(new Set(subs.map(s => s.id)));
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load subscriptions';
      setError(errorMessage);
      try {
        toast.showToast(errorMessage, 'error');
      } catch {
        // Toast might not be available
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(subscriptions.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleCreateBudgets = async () => {
    if (selectedIds.size === 0) {
      if (toast && toast.showToast) {
        toast.showToast('Please select at least one subscription', 'error');
      }
      return;
    }

    setCreating(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const service = new SubscriptionService(supabase);
      
      const result = await service.createBudgetsFromSubscriptions(
        monthId,
        startDate,
        endDate,
        Array.from(selectedIds)
      );

      if (toast && toast.showToast) {
        if (result.errors.length > 0) {
          toast.showToast(
            `Created ${result.created} budgets. ${result.skipped} skipped. Some errors occurred.`,
            'error'
          );
        } else {
          toast.showToast(
            `Successfully created ${result.created} budget${result.created !== 1 ? 's' : ''} from subscriptions`,
            'success'
          );
        }
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to create budgets:', error);
      if (toast && toast.showToast) {
        toast.showToast(
          error instanceof Error ? error.message : 'Failed to create budgets from subscriptions',
          'error'
        );
      }
    } finally {
      setCreating(false);
    }
  };

  const selectedTotal = subscriptions
    .filter(s => selectedIds.has(s.id))
    .reduce((sum, sub) => {
      return sum + SubscriptionService.calculateMonthlyCost(sub.amount, sub.frequency);
    }, 0);

  if (loading) {
    return (
      <Card variant="outlined" padding="lg">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-body text-[var(--color-text-muted)]">Loading subscriptions...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined" padding="lg">
        <div className="text-center py-8">
          <p className="text-body text-[var(--color-text-muted)] mb-2">
            Unable to load subscriptions: {error}
          </p>
          <Button onClick={loadSubscriptions} variant="secondary" size="sm">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <Card variant="outlined" padding="lg">
        <div className="text-center py-8">
          <p className="text-body text-[var(--color-text-muted)]">
            No active subscriptions due between {new Date(startDate).toLocaleDateString('en-IE', { dateStyle: 'medium' })} and {new Date(endDate).toLocaleDateString('en-IE', { dateStyle: 'medium' })}.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="outlined" padding="lg">
      <div className="space-y-4">
        <div>
          <h3 className="text-title text-[var(--color-text)] mb-2">
            Add Subscriptions as Budget Categories
          </h3>
          <p className="text-small text-[var(--color-text-muted)]">
            Select subscriptions due in this period to add them as budget categories. Each subscription will be converted to its monthly equivalent cost.
          </p>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-small text-[var(--color-text-muted)]">Total Monthly Cost (All):</span>
            <span className="text-body font-medium text-[var(--color-text)]">
              <Currency amount={totalMonthlyCost} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-small text-[var(--color-text-muted)]">Selected Total:</span>
            <span className="text-body font-medium text-[var(--color-primary)]">
              <Currency amount={selectedTotal} />
            </span>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-small text-[var(--color-primary)] hover:underline"
          >
            Select All
          </button>
          <span className="text-[var(--color-text-muted)]">|</span>
          <button
            onClick={deselectAll}
            className="text-small text-[var(--color-primary)] hover:underline"
          >
            Deselect All
          </button>
          <span className="ml-auto text-small text-[var(--color-text-muted)]">
            {selectedIds.size} of {subscriptions.length} selected
          </span>
        </div>

        {/* Subscription List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {subscriptions.map((subscription) => {
            const monthlyCost = SubscriptionService.calculateMonthlyCost(
              subscription.amount,
              subscription.frequency
            );
            const isSelected = selectedIds.has(subscription.id);

            return (
              <label
                key={subscription.id}
                className={`flex items-start gap-3 p-3 rounded-[var(--radius-md)] cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30'
                    : 'hover:bg-[var(--color-surface-sunken)] border border-transparent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelection(subscription.id)}
                  className="mt-1 w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-small font-medium text-[var(--color-text)]">
                        {subscription.name}
                      </div>
                      <div className="text-caption text-[var(--color-text-muted)]">
                        {subscription.frequency} · Due: {subscription.next_collection_date ? new Date(subscription.next_collection_date).toLocaleDateString('en-IE', { dateStyle: 'short' }) : 'N/A'}
                        {(subscription as any).is_essential !== undefined && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-caption ${
                            (subscription as any).is_essential
                              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                              : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                          }`}>
                            {(subscription as any).is_essential ? 'Essential' : 'Non-Essential'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-small font-medium text-[var(--color-text)]">
                        <Currency amount={subscription.amount} />/{subscription.frequency.toLowerCase()}
                      </div>
                      <div className="text-caption text-[var(--color-text-muted)]">
                        → <Currency amount={monthlyCost} />/month
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-[var(--color-border)]">
          <Button
            onClick={handleCreateBudgets}
            disabled={selectedIds.size === 0 || creating}
            isLoading={creating}
            className="w-full"
          >
            {creating
              ? 'Creating Budgets...'
              : `Add ${selectedIds.size} Subscription${selectedIds.size !== 1 ? 's' : ''} as Budget${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Card>
  );
}
